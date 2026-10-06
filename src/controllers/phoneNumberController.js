const PhoneNumber = require('../models/PhoneNumber');
const IndianNumber = require('../models/IndianNumber');
const PasswordFormatter = require('../models/PasswordFormatter');
const PhoneCredential = require('../models/PhoneCredential');
const IndianPhoneCredential = require('../models/IndianPhoneCredential');
const InactiveRdp = require('../models/InactiveRdp');
const cache = require('../utils/cache');

const parseFormatterIds = (password_formatters) => {
    if (!password_formatters) return [];

    let formatters = password_formatters;

    if (typeof formatters === 'string') {
        try {
            formatters = JSON.parse(formatters);
        } catch {
            return [];
        }
    }

    if (!Array.isArray(formatters)) return [];

    return formatters.map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null) {
            return item._id || item.id || null;
        }
        return null;
    }).filter(Boolean);
};

const getPhoneNumbers = async (req, res) => {
    try {
        const { search = '', is_active, country_code } = req.query;
        const cacheKey = `${req.query.userId || req.user.id}_${country_code || 'all'}`;

        if (!search && !is_active && req.user.role === 'superadmin') {
            const cached = cache.getPhoneNumbersCache(cacheKey);
            if (cached) {
                return res.status(200).json(cached);
            }
        }

        let query = {};
        if (req.user.role !== 'superadmin') {
            query.$or = [{ userId: req.user.id }, { userId: null }];
        } else if (req.query.userId && req.query.userId !== 'all') {
            query.userId = req.query.userId;
        }

        if (country_code && country_code !== 'all') {
            query.country_code = country_code;
        }

        if (search) {
            const cleanSearch = search.trim();
            const orConditions = [
                { number: { $regex: cleanSearch, $options: 'i' } },
                { country_code: { $regex: cleanSearch, $options: 'i' } },
                { rdp_id: { $regex: cleanSearch, $options: 'i' } }
            ];

            const numericSearch = parseInt(cleanSearch, 10);
            if (!isNaN(numericSearch)) {
                orConditions.push({ bro_id: numericSearch });
                if (cleanSearch.length === 10) {
                    const baseBlockNum = Math.floor(numericSearch / 100000) * 100000;
                    orConditions.push({ number: { $regex: baseBlockNum.toString(), $options: 'i' } });
                }
            }

            query.$or = orConditions;
        }

        if (is_active && is_active !== 'all') {
            query.is_active = is_active;
        }

        const phoneNumbers = await PhoneNumber.find(query)
            .select('country_code number last_scanned_number is_active password_formatters rdp_id limit bro_id updatedAt')
            .populate('password_formatters', 'start_add start_index end_index end_add')
            .sort({ _id: -1 })
            .lean();

        const responseData = {
            success: true,
            data: phoneNumbers,
            total: phoneNumbers.length
        };

        if (!search && !is_active && req.user.role === 'superadmin') {
            cache.setPhoneNumbersCache(cacheKey, responseData, 10000);
        }

        res.status(200).json(responseData);

    } catch (error) {
        res.status(200).json({
            success: false,
            error: 'Server Error',
            message: error.message
        });
    }
};

const getPhoneNumberById = async (req, res) => {
    try {
        const query = { _id: req.params.id };
        if (req.user.role !== 'superadmin') {
            query.userId = req.user.id;
        }
        const phoneNumber = await PhoneNumber.findOne(query)
            .populate('password_formatters')
            .lean();

        if (!phoneNumber) {
            const indianController = require('./indianNumberController');
            return indianController.getIndianNumberById(req, res);
        }

        res.status(200).json({
            success: true,
            data: phoneNumber
        });
    } catch (error) {
        res.status(200).json({
            success: false,
            message: error.message
        });
    }
};

const getRandomInactivePhoneNumber = async (req, res) => {
    try {
        const { country_code, rdp_id, bro_id } = req.query;

        if (!country_code && !rdp_id) {
            return res.status(200).json({
                success: false,
                message: "country_code or rdp_id is required"
            });
        }

        const broIdNum = bro_id !== undefined && bro_id !== null && bro_id !== "" ? Number(bro_id) : null;
        let selected = null;

        // Special Mode: If bot called fallback without rdp_id, provide an unassigned inactive number
        if (!rdp_id) {
            selected = await PhoneNumber.findOneAndUpdate(
                { country_code, is_active: "inactive", rdp_id: { $in: [null, ""] }, limit: { $gt: 0 } },
                { $set: { is_active: "running", updatedAt: new Date() } },
                { new: true }
            ).populate("password_formatters");
            if (selected) {
                cache.clearPhoneNumbersCache();
                return res.json({ success: true, data: selected });
            }
            return res.status(200).json({
                success: false,
                message: "No unassigned inactive numbers available"
            });
        }

        // If rdp_id communicates, immediately ensure it is cleared from InactiveRdp
        if (rdp_id) {
            InactiveRdp.deleteOne({ rdp_id: String(rdp_id).trim() }).catch(() => {});
        }

        // 1. Priority 1: Exact Resume — Check for number assigned to this exact rdp_id and bro_id
        if (broIdNum !== null) {
            selected = await PhoneNumber.findOneAndUpdate(
                { is_active: { $in: ["inactive", "running"] }, rdp_id, bro_id: broIdNum, limit: { $gt: 0 } },
                { $set: { is_active: "running", updatedAt: new Date() } },
                { new: true }
            ).populate("password_formatters");
        }

        if (selected) {
            cache.clearPhoneNumbersCache();
            return res.json({ success: true, data: selected });
        }

        // 2. Priority 2: Orphan / Same-RDP Slot Adoption
        // If this specific bro_id has no assigned number, adopt any orphan number on this same RDP
        // that is NOT already bound to another active browser (e.g. bro_id is null or unassigned)
        const otherAssignedBroIds = await PhoneNumber.find({
            rdp_id,
            limit: { $gt: 0 },
            bro_id: { $ne: null, $nin: [broIdNum] }
        }).distinct('bro_id');

        selected = await PhoneNumber.findOneAndUpdate(
            {
                rdp_id,
                limit: { $gt: 0 },
                is_active: { $in: ["inactive", "running"] },
                bro_id: { $nin: otherAssignedBroIds }
            },
            { $set: { is_active: "running", bro_id: broIdNum, updatedAt: new Date() } },
            { sort: { updatedAt: 1 }, new: true }
        ).populate("password_formatters");

        if (selected) {
            cache.clearPhoneNumbersCache();
            console.log(`[Same-RDP Adoption] Adopted orphan number ${selected.number} for RDP: ${rdp_id}, bro_id: ${broIdNum}`);
            return res.json({ success: true, data: selected });
        }

        // 3. Priority 3: 10-Task Cap Safety Check
        // Count how many OTHER browsers on this RDP currently hold tasks
        const activeOtherCount = await PhoneNumber.countDocuments({
            rdp_id,
            is_active: { $in: ["running", "inactive"] },
            limit: { $gt: 0 },
            bro_id: { $ne: null, $nin: [broIdNum] }
        });

        if (activeOtherCount >= 10) {
            return res.status(200).json({
                success: false,
                message: `RDP worker load limit reached (10/10 assigned tasks for RDP ${rdp_id})`
            });
        }

        // 4. Priority 4: Assign a NEW unassigned inactive number from requested country pool
        const countryFilter = country_code ? { country_code } : {};
        selected = await PhoneNumber.findOneAndUpdate(
            { ...countryFilter, is_active: "inactive", rdp_id: { $in: [null, ""] }, limit: { $gt: 0 } },
            { $set: { is_active: "running", rdp_id, bro_id: broIdNum, updatedAt: new Date() } },
            { sort: { updatedAt: 1 }, new: true }
        ).populate("password_formatters");

        if (selected) {
            cache.clearPhoneNumbersCache();
            return res.json({
                success: true,
                data: selected
            });
        }

        // 5. Priority 5: Smart Cross-Country Fallback (Zero-Idling 24/7 Resilience)
        // When the requested country pool is exhausted, automatically assign an unassigned inactive number from ANY available country
        selected = await PhoneNumber.findOneAndUpdate(
            { is_active: "inactive", rdp_id: { $in: [null, ""] }, limit: { $gt: 0 } },
            { $set: { is_active: "running", rdp_id, bro_id: broIdNum, updatedAt: new Date() } },
            { sort: { updatedAt: 1 }, new: true }
        ).populate("password_formatters");

        if (selected) {
            cache.clearPhoneNumbersCache();
            console.log(`[Cross-Country Fallback] Country ${country_code} pool exhausted. Assigned fallback number ${selected.number} (Country: ${selected.country_code}) to RDP: ${rdp_id}, bro_id: ${broIdNum}`);
            return res.json({
                success: true,
                data: selected
            });
        }

        return res.status(200).json({
            success: false,
            message: "No inactive numbers available"
        });

    } catch (err) {
        return res.status(200).json({
            success: false,
            message: err.message
        });
    }
};


const createPhoneNumber = async (req, res) => {
    try {
        const { country_code, number, password_formatters, limit } = req.body;
        const userId = req.user.id;

        const exists = await PhoneNumber.findOne({ number });

        if (exists) {
            return res.status(200).json({
                success: true,
                data: exists,
                message: 'Phone number already exists'
            });
        }

        let formatterIds = parseFormatterIds(password_formatters);
        if (formatterIds.length === 0 && country_code) {
            let fQuery = { country_code };
            if (userId) fQuery.userId = userId;
            formatterIds = await PasswordFormatter.find(fQuery).sort({ createdAt: 1 }).distinct('_id');
            if (formatterIds.length === 0) {
                formatterIds = await PasswordFormatter.find({ country_code }).sort({ createdAt: 1 }).distinct('_id');
            }
        }

        const phoneNumber = await PhoneNumber.create({
            country_code,
            number,
            password_formatters: formatterIds,
            is_active: 'inactive',
            limit: limit || null,
            userId
        });

        await phoneNumber.populate('password_formatters');

        res.status(201).json({
            success: true,
            data: phoneNumber,
            message: 'Phone number created successfully'
        });
    } catch (error) {
        res.status(200).json({
            success: false,
            message: error.message
        });
    }
};

const bulkCreatePhoneNumbers = async (req, res) => {
    try {
        const { country_code, numbers, password_formatters, limit } = req.body;
        const userId = req.user.id;

        if (!country_code) {
            return res.status(200).json({
                success: false,
                message: 'Country code is required'
            });
        }

        if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
            return res.status(200).json({
                success: false,
                message: 'At least one phone number is required'
            });
        }

        // Check for duplicates within the request
        const uniqueNumbers = [...new Set(numbers)];
        if (uniqueNumbers.length !== numbers.length) {
            return res.status(200).json({
                success: false,
                message: 'Duplicate numbers found in the request',
                duplicates: numbers.filter((num, index) => numbers.indexOf(num) !== index)
            });
        }

        // Find existing numbers
        const existingNumbers = await PhoneNumber.find({
            number: { $in: numbers }
        }).select('number');

        const existingNumberSet = new Set(existingNumbers.map(n => n.number));

        if (existingNumberSet.size > 0) {
            return res.status(200).json({
                success: false,
                message: 'Some phone numbers already exist',
                existingNumbers: Array.from(existingNumberSet)
            });
        }

        let formatterIds = parseFormatterIds(password_formatters);
        if (formatterIds.length === 0 && country_code) {
            let fQuery = { country_code };
            if (userId) fQuery.userId = userId;
            formatterIds = await PasswordFormatter.find(fQuery).sort({ createdAt: 1 }).distinct('_id');
            if (formatterIds.length === 0) {
                formatterIds = await PasswordFormatter.find({ country_code }).sort({ createdAt: 1 }).distinct('_id');
            }
        }

        // Prepare all phone number documents
        const phoneNumbersToCreate = numbers.map(number => ({
            country_code,
            number,
            password_formatters: formatterIds,
            is_active: 'inactive',
            limit: limit || null,
            userId
        }));

        // Bulk insert
        const createdPhoneNumbers = await PhoneNumber.insertMany(phoneNumbersToCreate, { ordered: true });

        // Populate formatters for response
        const populatedNumbers = await PhoneNumber.find({
            _id: { $in: createdPhoneNumbers.map(p => p._id) }
        }).populate('password_formatters');

        res.status(201).json({
            success: true,
            data: populatedNumbers,
            message: `${createdPhoneNumbers.length} phone number(s) created successfully`,
            count: createdPhoneNumbers.length
        });

    } catch (error) {
        // Handle bulk write errors
        if (error.code === 11000) {
            // Duplicate key error
            return res.status(200).json({
                success: false,
                message: 'Duplicate phone number detected',
                error: error.message
            });
        }

        res.status(200).json({
            success: false,
            message: error.message
        });
    }
};

const updatePhoneNumber = async (req, res) => {
    try {
        const { country_code, number, password_formatters, is_active, limit, rdp_id } = req.body;

        const formatterIds = parseFormatterIds(password_formatters);

        const query = { _id: req.params.id };
        if (req.user.role !== 'superadmin') {
            query.userId = req.user.id;
        }

        let phoneNumber = await PhoneNumber.findOne(query);

        if (!phoneNumber) {
            return res.status(200).json({
                success: false,
                message: 'Phone number not found'
            });
        }

        // Check if the new number already exists (but not on this document)
        if (number !== undefined && number !== phoneNumber.number) {
            const exists = await PhoneNumber.findOne({
                number,
                _id: { $ne: req.params.id }
            });

            if (exists) {
                await PhoneNumber.deleteOne({ _id: exists._id });
            }
        }

        phoneNumber.country_code = country_code;
        phoneNumber.number = number;
        phoneNumber.password_formatters = formatterIds;
        if (is_active !== undefined) {
            phoneNumber.is_active = is_active;
        }

        if (limit !== undefined) {
            phoneNumber.limit = limit;
        }

        // Handle RDP ID - set to null if empty string or undefined
        if (rdp_id !== undefined) {
            phoneNumber.rdp_id = rdp_id ? rdp_id.trim() : null;
        }

        await phoneNumber.save();
        await phoneNumber.populate('password_formatters');

        res.status(200).json({
            success: true,
            data: phoneNumber,
            message: 'Phone number updated successfully'
        });
    } catch (error) {
        res.status(200).json({
            success: false,
            message: error.message
        });
    }
};

const patchPhoneNumber = async (req, res) => {
    try {
        const { country_code, number, password_formatters, is_active, limit, rdp_id, bro_id } = req.body;

        const query = { _id: req.params.id };

        let phoneNumber = await PhoneNumber.findOne(query);

        if (!phoneNumber) {
            // Intelligent Fallback: Check if document exists in IndianNumber collection!
            const indianController = require('./indianNumberController');
            return indianController.patchIndianNumber(req, res);
        }

        // Save last_scanned_number from finder progress payload (Preserve series root number)
        if (number !== undefined && number !== null && number !== "") {
            phoneNumber.last_scanned_number = number.toString().trim();
        }

        // Only overwrite fields that were actually sent
        if (country_code !== undefined) phoneNumber.country_code = country_code;
        if (is_active !== undefined) {
            let status = is_active;
            if (status === 'completed' && phoneNumber.limit > 0) {
                status = 'inactive';
            }
            phoneNumber.is_active = status;
        }

        // Active Progress Resume Guard: If bot is actively sending progress updates with limit > 0 and not dead/completed, force status = 'running'
        if (phoneNumber.limit > 0 && phoneNumber.is_active !== 'dead' && phoneNumber.is_active !== 'completed') {
            phoneNumber.is_active = 'running';
        }

        if (limit !== undefined) phoneNumber.limit = limit;

        if (password_formatters !== undefined) {
            phoneNumber.password_formatters = parseFormatterIds(password_formatters);
        }

        const currentFormatterCount = phoneNumber.password_formatters ? phoneNumber.password_formatters.length : 0;

        if (currentFormatterCount > 0) {
            phoneNumber.consecutive_zero_checks = 0;
        }

        // Rule 1 Enforcement: limit <= 0 required for completed.
        // Status is ONLY 'dead' if explicitly set as 'dead' by the bot after 5,000 checks.
        if (phoneNumber.limit <= 0) {
            phoneNumber.is_active = 'completed';
        } else if (is_active === 'dead') {
            phoneNumber.is_active = 'dead';
        }

        if (phoneNumber.is_active === 'dead' || phoneNumber.is_active === 'completed') {
            phoneNumber.rdp_id = null;
            phoneNumber.bro_id = null;
        } else {
            // Only update rdp_id if explicitly passed as a valid string in req.body
            if (rdp_id !== undefined && rdp_id !== null && rdp_id !== "" && rdp_id !== "null" && rdp_id !== "None") {
                phoneNumber.rdp_id = rdp_id.trim();
            }

            if (bro_id !== undefined && bro_id !== null && bro_id !== "" && bro_id !== "null") {
                phoneNumber.bro_id = Number(bro_id);
            }
        }

        const savedRdpId = phoneNumber.rdp_id || (rdp_id ? rdp_id.trim() : null);
        const savedBroId = phoneNumber.bro_id !== null ? phoneNumber.bro_id : ((bro_id !== undefined && bro_id !== null && bro_id !== "") ? Number(bro_id) : null);
        const savedUserId = phoneNumber.userId;

        // Deduplication Guard: Check if another document on this same RDP is running the exact same number
        let isDuplicateOnRdp = false;
        if (savedRdpId && phoneNumber.number) {
            const existingDuplicate = await PhoneNumber.findOne({
                _id: { $ne: phoneNumber._id },
                number: phoneNumber.number,
                rdp_id: savedRdpId,
                is_active: "running"
            });
            if (existingDuplicate) {
                isDuplicateOnRdp = true;
                phoneNumber.is_active = "inactive";
                phoneNumber.rdp_id = null;
                phoneNumber.bro_id = null;
            }
        }

        await phoneNumber.save();
        await phoneNumber.populate('password_formatters');

        // Instant Auto-Recovery: If number is running, immediately clear this RDP from InactiveRdp
        if (phoneNumber.is_active === 'running' && savedRdpId) {
            InactiveRdp.deleteOne({ rdp_id: savedRdpId }).catch(() => {});
        }

        // Automatically assign replacement unique number to same RDP IP + Browser ID if completed, dead, or duplicate
        let replacement = null;
        if ((phoneNumber.is_active === 'dead' || phoneNumber.is_active === 'completed' || isDuplicateOnRdp) && savedRdpId) {
            const otherAssigned = await PhoneNumber.find({
                rdp_id: savedRdpId,
                is_active: { $in: ["running", "inactive"] },
                bro_id: { $ne: savedBroId, $nin: [null] }
            }).select("_id").lean();
            const excludeIds = otherAssigned.map(d => d._id);

            replacement = await PhoneNumber.findOneAndUpdate(
                { country_code: phoneNumber.country_code, is_active: "inactive", limit: { $gt: 0 }, _id: { $nin: excludeIds }, $or: [{ rdp_id: savedRdpId }, { rdp_id: { $in: [null, ""] } }] },
                { $set: { is_active: "running", rdp_id: savedRdpId, bro_id: savedBroId } },
                { new: true }
            ).populate("password_formatters");
        }

        cache.clearPhoneNumbersCache();

        res.status(200).json({
            success: true,
            data: phoneNumber,
            replacement: replacement || null,
            message: 'Phone number patched successfully'
        });
    } catch (error) {
        res.status(200).json({
            success: false,
            message: error.message
        });
    }
};

const deletePhoneNumber = async (req, res) => {
    try {
        const query = { _id: req.params.id };
        if (req.user.role !== 'superadmin') {
            query.userId = req.user.id;
        }

        const phoneNumber = await PhoneNumber.findOne(query);

        if (!phoneNumber) {
            return res.status(200).json({
                success: false,
                message: 'Phone number not found'
            });
        }

        await phoneNumber.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Phone number deleted successfully'
        });
    } catch (error) {
        res.status(200).json({
            success: false,
            message: error.message
        });
    }
};

const bulkDeletePhoneNumbers = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(200).json({
                success: false,
                message: 'At least one ID is required'
            });
        }

        const query = { _id: { $in: ids } };
        if (req.user.role !== 'superadmin') {
            query.userId = req.user.id;
        }

        const result = await PhoneNumber.deleteMany(query);

        res.status(200).json({
            success: true,
            message: `${result.deletedCount} phone number(s) deleted successfully`,
            deletedCount: result.deletedCount
        });

    } catch (error) {
        res.status(200).json({
            success: false,
            message: error.message
        });
    }
};


const bulkUpdatePhoneNumberStatus = async (req, res) => {
    try {
        const { ids, is_active } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(200).json({
                success: false,
                message: 'At least one ID is required'
            });
        }

        if (!is_active || !['inactive', 'running', 'completed'].includes(is_active)) {
            return res.status(200).json({
                success: false,
                message: 'Valid status is required (inactive, running, completed)'
            });
        }

        const query = { _id: { $in: ids } };
        if (req.user.role !== 'superadmin') {
            query.userId = req.user.id;
        }

        let updatePayload = { is_active };

        if (is_active === 'completed') {
            // Rule 1 enforcement: limit <= 0 required for completed. If limit > 0, set inactive.
            const resultCompleted = await PhoneNumber.updateMany(
                { ...query, limit: { $lte: 0 } },
                { $set: { is_active: 'completed', rdp_id: null, bro_id: null } }
            );
            const resultInactive = await PhoneNumber.updateMany(
                { ...query, limit: { $gt: 0 } },
                { $set: { is_active: 'inactive' } }
            );
            const totalModified = resultCompleted.modifiedCount + resultInactive.modifiedCount;
            return res.status(200).json({
                success: true,
                message: `${totalModified} phone number(s) updated cleanly obeying Rule 1`,
                modifiedCount: totalModified
            });
        }

        const result = await PhoneNumber.updateMany(
            query,
            { $set: updatePayload }
        );

        res.status(200).json({
            success: true,
            message: `${result.modifiedCount} phone number(s) updated successfully`,
            modifiedCount: result.modifiedCount
        });

    } catch (error) {
        res.status(200).json({
            success: false,
            message: error.message
        });
    }
};

const bulkUpdatePhoneNumbers = async (req, res) => {
    try {
        const { ids, data } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(200).json({
                success: false,
                message: 'At least one ID is required'
            });
        }

        if (!data || typeof data !== 'object') {
            return res.status(200).json({
                success: false,
                message: 'Update data is required'
            });
        }

        const updateFields = {};
        if (data.limit !== undefined) updateFields.limit = data.limit;
        if (data.rdp_id !== undefined) {
            updateFields.rdp_id = data.rdp_id ? data.rdp_id.trim() : null;
            if (!updateFields.rdp_id) {
                updateFields.bro_id = null;
            }
        }
        if (data.bro_id !== undefined) {
            updateFields.bro_id = (data.bro_id !== null && data.bro_id !== "") ? Number(data.bro_id) : null;
        }
        if (data.is_active !== undefined) updateFields.is_active = data.is_active;
        if (data.password_formatters !== undefined) {
            updateFields.password_formatters = parseFormatterIds(data.password_formatters);
        }

        if (Object.keys(updateFields).length === 0) {
            return res.status(200).json({
                success: false,
                message: 'No valid update fields provided'
            });
        }

        const query = { _id: { $in: ids } };
        if (req.user.role !== 'superadmin') {
            query.userId = req.user.id;
        }

        const result = await PhoneNumber.updateMany(
            query,
            { $set: updateFields }
        );

        res.status(200).json({
            success: true,
            message: `${result.modifiedCount} phone number(s) updated successfully`,
            modifiedCount: result.modifiedCount
        });

    } catch (error) {
        res.status(200).json({
            success: false,
            message: error.message
        });
    }
};

const _dashboardCache = new Map();

const getDashboardStats = async (req, res) => {
    try {
        const filter = {};
        const credFilter = {};
        const formatterFilter = {};

        if (req.user.role !== 'superadmin') {
            filter.$or = [{ userId: req.user.id }, { userId: null }];
            credFilter.userId = req.user.id;
            formatterFilter.userId = req.user.id;
        } else if (req.query.userId && req.query.userId !== 'all') {
            filter.userId = req.query.userId;
            credFilter.userId = req.query.userId;
            formatterFilter.userId = req.query.userId;
        }

        const cacheKey = JSON.stringify({ u: req.user.id, r: req.user.role, q: req.query.userId });
        const cached = _dashboardCache.get(cacheKey);
        const now = Date.now();
        if (cached && (now - cached.timestamp < 3000)) {
            return res.status(200).json(cached.data);
        }

        const [
            phoneNumbersTotal,
            phoneNumbersInactive,
            phoneNumbersRunning,
            phoneNumbersCompleted,
            phoneNumbersDead,

            indianNumbersTotal,
            indianNumbersInactive,
            indianNumbersRunning,
            indianNumbersCompleted,
            indianNumbersDead,

            passwordFormattersCount,
            phoneCredentialsCount,
            indianPhoneCredentialsCount,

            genericTypeCounts,
            indianTypeCounts,
            indianRunningRdps,
            globalRunningRdps
        ] = await Promise.all([
            PhoneNumber.countDocuments(filter),
            PhoneNumber.countDocuments({ ...filter, is_active: 'inactive' }),
            PhoneNumber.countDocuments({ ...filter, is_active: 'running' }),
            PhoneNumber.countDocuments({ ...filter, is_active: 'completed' }),
            PhoneNumber.countDocuments({ ...filter, is_active: 'dead' }),

            IndianNumber.countDocuments(filter),
            IndianNumber.countDocuments({ ...filter, is_active: 'inactive' }),
            IndianNumber.countDocuments({ ...filter, is_active: 'running' }),
            IndianNumber.countDocuments({ ...filter, is_active: 'completed' }),
            IndianNumber.countDocuments({ ...filter, is_active: 'dead' }),

            PasswordFormatter.countDocuments(formatterFilter),
            PhoneCredential.countDocuments(credFilter),
            IndianPhoneCredential.countDocuments(credFilter),

            PhoneCredential.aggregate([
                { $match: { ...credFilter, country_code: { $ne: '91' } } },
                { $group: { _id: "$type", count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]),
            IndianPhoneCredential.aggregate([
                { $match: { ...credFilter, circle: { $ne: null, $exists: true }, operator: { $ne: null, $exists: true } } },
                { $group: { _id: "$type", count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]),

            IndianNumber.distinct('rdp_id', { ...filter, is_active: 'running', rdp_id: { $nin: [null, ''] } }),
            PhoneNumber.distinct('rdp_id', { ...filter, is_active: 'running', rdp_id: { $nin: [null, ''] } })
        ]);

        const allRunningRdps = Array.from(new Set([...(indianRunningRdps || []), ...(globalRunningRdps || [])]));

        // 🛡️ Auto-Recovery Guard: Any RDP that is currently running MUST NEVER be in InactiveRdp!
        if (allRunningRdps.length > 0) {
            InactiveRdp.deleteMany({ rdp_id: { $in: allRunningRdps } }).catch(() => {});
        }

        const totalInactiveRdp = await InactiveRdp.countDocuments({ rdp_id: { $nin: allRunningRdps } });

        const globalTypeSummary = genericTypeCounts.map(item => ({
            type: item._id || 'Unknown',
            count: item.count
        }));

        const indianTypeSummary = indianTypeCounts.map(item => ({
            type: item._id || 'Unknown',
            count: item.count
        }));

        const responsePayload = {
            success: true,
            data: {
                counts: {
                    phoneNumbers: phoneNumbersTotal,
                    phoneNumbersInactive,
                    phoneNumbersRunning,
                    phoneNumbersCompleted,
                    phoneNumbersDead,

                    indianNumbers: indianNumbersTotal,
                    indianNumbersInactive,
                    indianNumbersRunning,
                    indianNumbersCompleted,
                    indianNumbersDead,

                    passwordFormatters: passwordFormattersCount,
                    phoneCredentials: phoneCredentialsCount,
                    indianPhoneCredentials: indianPhoneCredentialsCount,
                },
                runningRdpSummary: {
                    totalRunningRdp: allRunningRdps.length,
                    indianRunningRdp: (indianRunningRdps || []).length,
                    globalRunningRdp: (globalRunningRdps || []).length,
                    totalInactiveRdp: totalInactiveRdp || 0
                },
                globalTypeSummary,
                indianTypeSummary
            }
        };

        _dashboardCache.set(cacheKey, { timestamp: now, data: responsePayload });
        res.status(200).json(responsePayload);
    } catch (error) {
        res.status(200).json({
            success: false,
            message: error.message
        });
    }
};

const resetRdpNumbers = async (req, res) => {
    try {
        const { rdp_id } = req.query;
        if (!rdp_id) {
            return res.status(200).json({
                success: false,
                message: "rdp_id is required"
            });
        }

        const query = { rdp_id, is_active: "running" };
        if (req.user.role !== 'superadmin') {
            query.userId = req.user.id;
        } else if (req.query.userId) {
            if (req.query.userId !== 'all') {
                query.userId = req.query.userId;
            }
        } else {
            query.userId = req.user.id;
        }

        // Reset all running numbers for this RDP immediately
        const result = await PhoneNumber.updateMany(
            query,
            { $set: { is_active: "inactive" } }
        );

        res.status(200).json({
            success: true,
            modifiedCount: result.modifiedCount,
            message: `Reset ${result.modifiedCount} running number(s) to inactive for RDP ${rdp_id}`
        });
    } catch (error) {
        res.status(200).json({
            success: false,
            message: error.message
        });
    }
};

const getPhoneNumberGroups = async (req, res) => {
    try {
        const { is_active } = req.query;

        const matchFilter = {};
        if (req.user.role !== 'superadmin') {
            matchFilter.$or = [{ userId: req.user.id }, { userId: null }];
        } else if (req.query.userId && req.query.userId !== 'all') {
            matchFilter.userId = req.query.userId;
        }

        if (is_active && is_active !== 'all') {
            matchFilter.is_active = is_active;
        }

        const groupsResult = await PhoneNumber.aggregate([
            { $match: matchFilter },
            {
                $group: {
                    _id: "$country_code",
                    inactive: {
                        $sum: { $cond: [{ $eq: ["$is_active", "inactive"] }, 1, 0] }
                    },
                    running: {
                        $sum: { $cond: [{ $eq: ["$is_active", "running"] }, 1, 0] }
                    },
                    completed: {
                        $sum: { $cond: [{ $eq: ["$is_active", "completed"] }, 1, 0] }
                    },
                    dead: {
                        $sum: { $cond: [{ $eq: ["$is_active", "dead"] }, 1, 0] }
                    },
                    total: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    country_code: "$_id",
                    inactive: 1,
                    running: 1,
                    completed: 1,
                    dead: 1,
                    total: 1,
                    items: { $literal: [] }
                }
            },
            { $sort: { total: -1 } }
        ]);

        res.status(200).json({
            success: true,
            groups: groupsResult
        });

    } catch (error) {
        res.status(200).json({
            success: false,
            error: 'Server Error',
            message: error.message
        });
    }
};

const syncCountryFormatters = async (req, res) => {
    try {
        const { country_code } = req.body;
        if (!country_code) {
            return res.status(200).json({
                success: false,
                message: 'Country code is required'
            });
        }

        const formatters = await PasswordFormatter.find({ country_code }).distinct('_id');
        const result = await PhoneNumber.updateMany(
            { country_code },
            { $set: { password_formatters: formatters } }
        );

        cache.clearPhoneNumbersCache();

        return res.status(200).json({
            success: true,
            message: `Successfully synced ${result.modifiedCount} numbers for country ${country_code} with ${formatters.length} active formatters.`,
            count: result.modifiedCount,
            formattersCount: formatters.length
        });
    } catch (error) {
        return res.status(200).json({
            success: false,
            message: error.message
        });
    }
};

const getRunningRdpsList = async (req, res) => {
    try {
        const filter = {};
        if (req.user && req.user.role !== 'superadmin') {
            filter.$or = [{ userId: req.user.id }, { userId: null }];
        } else if (req.query.userId && req.query.userId !== 'all') {
            filter.userId = req.query.userId;
        }

        const type = (req.query.type || 'all').toLowerCase();

        let indianList = [];
        let globalList = [];

        if (type === 'indian' || type === 'all') {
            indianList = await IndianNumber.distinct('rdp_id', { ...filter, is_active: 'running', rdp_id: { $nin: [null, ''] } });
        }
        if (type === 'global' || type === 'all') {
            globalList = await PhoneNumber.distinct('rdp_id', { ...filter, is_active: 'running', rdp_id: { $nin: [null, ''] } });
        }

        let rdpIds = [];
        if (type === 'indian') {
            rdpIds = indianList;
        } else if (type === 'global') {
            rdpIds = globalList;
        } else {
            rdpIds = Array.from(new Set([...indianList, ...globalList]));
        }

        // Clean & sort IPs
        rdpIds = rdpIds.filter(Boolean);
        rdpIds.sort((a, b) => {
            const numA = a.split('.').map(Number);
            const numB = b.split('.').map(Number);
            for (let i = 0; i < 4; i++) {
                if ((numA[i] || 0) !== (numB[i] || 0)) {
                    return (numA[i] || 0) - (numB[i] || 0);
                }
            }
            return a.localeCompare(b);
        });

        res.status(200).json({
            success: true,
            data: {
                type,
                total: rdpIds.length,
                indianCount: indianList.length,
                globalCount: globalList.length,
                rdpIds
            }
        });
    } catch (error) {
        res.status(200).json({
            success: false,
            message: error.message
        });
    }
};

const getInactiveRdpsList = async (req, res) => {
    try {
        const runningIndian = await IndianNumber.distinct('rdp_id', { is_active: 'running', rdp_id: { $nin: [null, ''] } });
        const runningGlobal = await PhoneNumber.distinct('rdp_id', { is_active: 'running', rdp_id: { $nin: [null, ''] } });
        const allRunningSet = new Set([...runningIndian, ...runningGlobal]);

        const inactiveDocs = await InactiveRdp.find({ rdp_id: { $nin: Array.from(allRunningSet) } }).sort({ updatedAt: -1 });
        const rdpIds = inactiveDocs.map(d => d.rdp_id).filter(Boolean);

        res.status(200).json({
            success: true,
            data: {
                total: rdpIds.length,
                rdpIds,
                details: inactiveDocs
            }
        });
    } catch (error) {
        res.status(200).json({
            success: false,
            message: error.message
        });
    }
};

const clearInactiveRdps = async (req, res) => {
    try {
        const result = await InactiveRdp.deleteMany({});
        _dashboardCache.clear();
        res.status(200).json({
            success: true,
            message: 'All inactive RDPs cleared successfully',
            deletedCount: result.deletedCount
        });
    } catch (error) {
        res.status(200).json({
            success: false,
            message: error.message
        });
    }
};

const deleteInactiveRdpById = async (req, res) => {
    try {
        const { rdp_id } = req.params;
        const result = await InactiveRdp.deleteOne({ rdp_id });
        _dashboardCache.clear();
        res.status(200).json({
            success: true,
            message: `RDP ${rdp_id} deleted successfully from inactive list`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        res.status(200).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getPhoneNumbers,
    getPhoneNumberById,
    getRandomInactivePhoneNumber,
    createPhoneNumber,
    bulkCreatePhoneNumbers,
    updatePhoneNumber,
    patchPhoneNumber,
    deletePhoneNumber,
    bulkDeletePhoneNumbers,
    bulkUpdatePhoneNumberStatus,
    bulkUpdatePhoneNumbers,
    getDashboardStats,
    getRunningRdpsList,
    getInactiveRdpsList,
    clearInactiveRdps,
    deleteInactiveRdpById,
    resetRdpNumbers,
    getPhoneNumberGroups,
    syncCountryFormatters
};