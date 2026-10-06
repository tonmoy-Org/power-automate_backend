const IndianNumber = require('../models/IndianNumber');
const InactiveRdp = require('../models/InactiveRdp');
const cache = require('../utils/cache');
const { resolveNumber } = require('../utils/operatorResolver');

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

const resolveAndSanitizeOperator = (number, inputOperator, inputCircle) => {
    const resolved = resolveNumber(number);
    let operator = inputOperator ? String(inputOperator).trim() : '';
    let circle = inputCircle ? String(inputCircle).trim() : '';

    // Collapse multiple repeated (Dead) tags down to a single " (Dead)"
    if (operator) {
        const hasDead = /\(Dead\)/i.test(operator);
        const cleanBase = operator.replace(/(\s*\(Dead\))+/gi, '').trim();
        operator = hasDead ? `${cleanBase} (Dead)` : cleanBase;
    }
    if (circle) {
        const hasDead = /\(Dead\)/i.test(circle);
        const cleanBase = circle.replace(/(\s*\(Dead\))+/gi, '').trim();
        circle = hasDead ? `${cleanBase} (Dead)` : cleanBase;
    }

    if (!operator || operator === 'Inactive' || operator === 'Unknown' || operator === 'Default') {
        operator = resolved.operator || 'Unknown';
    }
    if (!circle || circle === 'Inactive' || circle === 'Unknown' || circle === 'Default') {
        circle = resolved.circle || 'Unknown';
    }

    // Extra safety guard
    if (operator === 'Inactive') operator = 'Unknown';
    if (circle === 'Inactive') circle = 'Unknown';

    return { operator, circle };
};


const getIndianNumbers = async (req, res) => {
    try {
        const { search = '', is_active, operator, circle } = req.query;

        let query = {};
        if (req.user.role !== 'superadmin') {
            query.$or = [{ userId: req.user.id }, { userId: null }];
        } else if (req.query.userId && req.query.userId !== 'all') {
            query.userId = req.query.userId;
        }

        if (search) {
            const cleanSearch = search.trim();
            const orConditions = [
                { number: { $regex: cleanSearch, $options: 'i' } },
                { operator: { $regex: cleanSearch, $options: 'i' } },
                { rdp_id: { $regex: cleanSearch, $options: 'i' } },
                { circle: { $regex: cleanSearch, $options: 'i' } }
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

        if (operator) {
            query.operator = operator;
        }

        if (circle) {
            query.circle = circle;
        }

        if (is_active && is_active !== 'all') {
            if (is_active === 'active-inactive') {
                query.is_active = { $in: ['inactive', 'running'] };
            } else if (is_active === 'offline') {
                query.is_active = 'inactive';
                query.rdp_id = { $nin: [null, ""] };
            } else {
                query.is_active = is_active;
            }
        }

        const indianNumbers = await IndianNumber.find(query)
            .select('operator country_code circle number last_scanned_number is_active password_formatters rdp_id limit bro_id updatedAt')
            .populate('password_formatters')
            .sort({ createdAt: 1 })
            .lean();

        const responseData = {
            success: true,
            data: indianNumbers,
            total: indianNumbers.length
        };

        res.status(200).json(responseData);

    } catch (error) {
        res.status(200).json({
            success: false,
            error: 'Server Error',
            message: error.message
        });
    }
};

const getIndianNumberGroups = async (req, res) => {
    try {
        const { is_active } = req.query;

        const matchFilter = {};
        if (req.user.role !== 'superadmin') {
            matchFilter.$or = [{ userId: req.user.id }, { userId: null }];
        } else if (req.query.userId && req.query.userId !== 'all') {
            matchFilter.userId = req.query.userId;
        }

        if (is_active && is_active !== 'all') {
            if (is_active === 'active-inactive') {
                matchFilter.is_active = { $in: ['inactive', 'running'] };
            } else if (is_active === 'offline') {
                matchFilter.is_active = 'inactive';
                matchFilter.rdp_id = { $nin: [null, ""] };
            } else {
                matchFilter.is_active = is_active;
            }
        }

        const [groupsResult, statsResult] = await Promise.all([
            IndianNumber.aggregate([
                { $match: matchFilter },
                {
                    $group: {
                        _id: {
                            operator: "$operator",
                            circle: "$circle",
                            country_code: "$country_code"
                        },
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
                        offline: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ["$is_active", "inactive"] },
                                            { $ne: ["$rdp_id", null] },
                                            { $ne: ["$rdp_id", ""] }
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },
                        total: { $sum: 1 }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        operator: {
                            $concat: [
                                "$_id.country_code",
                                "|||",
                                "$_id.operator",
                                "|||",
                                "$_id.circle"
                            ]
                        },
                        operatorName: "$_id.operator",
                        circleName: "$_id.circle",
                        countryCode: "$_id.country_code",
                        inactive: 1,
                        running: 1,
                        completed: 1,
                        dead: 1,
                        offline: 1,
                        total: 1,
                        items: { $literal: [] }
                    }
                },
                { $sort: { total: -1 } }
            ]),
            IndianNumber.aggregate([
                { $match: matchFilter },
                {
                    $group: {
                        _id: "$operator",
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
                        offline: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ["$is_active", "inactive"] },
                                            { $ne: ["$rdp_id", null] },
                                            { $ne: ["$rdp_id", ""] }
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },
                        total: { $sum: 1 }
                    }
                }
            ])
        ]);

        const operatorStats = {
            "Airtel": { inactive: 0, running: 0, completed: 0, dead: 0, offline: 0, total: 0 },
            "Reliance Jio": { inactive: 0, running: 0, completed: 0, dead: 0, offline: 0, total: 0 },
            "Vi": { inactive: 0, running: 0, completed: 0, dead: 0, offline: 0, total: 0 },
            "BSNL": { inactive: 0, running: 0, completed: 0, dead: 0, offline: 0, total: 0 }
        };

        statsResult.forEach(item => {
            const op = item._id || "Unknown";
            let key = null;
            if (op.toLowerCase().includes("jio")) key = "Reliance Jio";
            else if (op.toLowerCase().includes("airtel")) key = "Airtel";
            else if (op.toLowerCase().includes("vi") || op.toLowerCase().includes("idea") || op.toLowerCase().includes("vodafone")) key = "Vi";
            else if (op.toLowerCase().includes("bsnl")) key = "BSNL";

            if (key) {
                operatorStats[key].inactive += item.inactive;
                operatorStats[key].running += item.running;
                operatorStats[key].completed += item.completed;
                operatorStats[key].dead += (item.dead || 0);
                operatorStats[key].offline += item.offline;
                operatorStats[key].total += item.total;
            }
        });

        // Sort groups: actual operators first (sorted by total desc), "Unknown" operator last.
        groupsResult.sort((a, b) => {
            const aIsUnknown = (a.operatorName || '').toLowerCase() === 'unknown';
            const bIsUnknown = (b.operatorName || '').toLowerCase() === 'unknown';

            if (aIsUnknown && !bIsUnknown) return 1;
            if (!aIsUnknown && bIsUnknown) return -1;

            return b.total - a.total;
        });

        res.status(200).json({
            success: true,
            operatorStats,
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

const getIndianNumberById = async (req, res) => {
    try {
        const query = { _id: req.params.id };
        if (req.user.role !== 'superadmin') {
            query.userId = req.user.id;
        }
        const indianNumber = await IndianNumber.findOne(query)
            .populate('password_formatters')
            .lean();

        if (!indianNumber) {
            return res.status(200).json({
                success: false,
                message: 'Phone number not found'
            });
        }

        res.status(200).json({
            success: true,
            data: indianNumber
        });
    } catch (error) {
        res.status(200).json({
            success: false,
            message: error.message
        });
    }
};

const parseQueryList = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(x => String(x).trim()).filter(Boolean);

    const strVal = String(val).trim();
    if (!strVal || strVal === 'None' || strVal === 'undefined' || strVal === '[]') return [];

    if (strVal.startsWith('[') && strVal.endsWith(']')) {
        try {
            const sanitized = strVal.replace(/'/g, '"');
            const parsed = JSON.parse(sanitized);
            if (Array.isArray(parsed)) {
                return parsed.map(x => String(x).trim()).filter(Boolean);
            }
        } catch (e) {
            const stripped = strVal.slice(1, -1);
            return stripped.split(',')
                .map(x => x.replace(/['"]/g, '').trim())
                .filter(Boolean);
        }
    }

    return strVal.split(',')
        .map(x => x.replace(/['"]/g, '').trim())
        .filter(Boolean);
};

const getActiveRdpIds = async (Model, currentRdpId) => {
    const runningRdpIds = await Model.distinct("rdp_id", {
        is_active: "running",
        rdp_id: { $nin: [null, ""] }
    });
    return [...new Set([...runningRdpIds, currentRdpId])];
};

const getRandomInactiveIndianNumber = async (req, res) => {
    try {
        const { country_code, operator, circle, rdp_id, bro_id } = req.query;
        if (!rdp_id) {
            return res.status(200).json({
                success: false,
                message: "rdp_id is required"
            });
        }

        // Instant Auto-Recovery: Any bot communicating from an RDP is alive!
        InactiveRdp.deleteOne({ rdp_id: String(rdp_id).trim() }).catch(() => {});

        const baseFilter = {};
        if (req.user.role !== 'superadmin') {
            baseFilter.$or = [{ userId: req.user.id }, { userId: null }];
        }
        if (country_code) baseFilter.country_code = country_code;

        const operatorList = parseQueryList(operator);
        if (operatorList.length > 0) {
            const hasOthers = operatorList.some(op => /^others?$/i.test(op.trim()) || /^all others?$/i.test(op.trim()));
            if (hasOthers) {
                const specificOps = operatorList.filter(op => !/^others?$/i.test(op.trim()) && !/^all others?$/i.test(op.trim()));
                const othersFilter = {
                    $nin: [
                        "Airtel", "Airtel (Dead)",
                        "Reliance Jio", "Reliance Jio (Dead)",
                        "Vi", "Vi (Dead)", "Vodafone Idea", "Vodafone", "Idea"
                    ]
                };
                if (specificOps.length > 0) {
                    baseFilter.$or = [
                        { operator: { $in: specificOps } },
                        { operator: othersFilter }
                    ];
                } else {
                    baseFilter.operator = othersFilter;
                }
            } else {
                baseFilter.operator = { $in: operatorList };
            }
        }

        const circleList = parseQueryList(circle);
        if (circleList.length > 0) baseFilter.circle = { $in: circleList };

        const broIdNum = bro_id !== undefined && bro_id !== null && bro_id !== "" ? Number(bro_id) : null;

        let selected = null;

        // 1. Priority 1: Resume any number assigned to this rdp_id with remaining limit
        // Matching bro_id first, then any un-running number assigned to this RDP
        if (broIdNum !== null) {
            selected = await IndianNumber.findOneAndUpdate(
                { is_active: { $in: ["inactive", "running"] }, rdp_id, bro_id: broIdNum, limit: { $gt: 0 } },
                { $set: { is_active: "running", updatedAt: new Date() } },
                { new: true }
            ).populate("password_formatters");
        }

        if (!selected) {
            selected = await IndianNumber.findOneAndUpdate(
                { is_active: "inactive", rdp_id, limit: { $gt: 0 } },
                { $set: { is_active: "running", bro_id: broIdNum, updatedAt: new Date() } },
                { sort: { updatedAt: 1 }, new: true }
            ).populate("password_formatters");
        }

        if (selected) {
            return res.json({ success: true, data: selected });
        }

        // 2. Strict 10-Number Cap per RDP Instance for NEW number assignments
        const assignedCount = await IndianNumber.countDocuments({
            rdp_id,
            is_active: "running",
            limit: { $gt: 0 }
        });

        if (assignedCount >= 10) {
            return res.status(200).json({
                success: false,
                message: `RDP worker load limit reached (10/10 assigned tasks for RDP ${rdp_id})`
            });
        }

        // 3. Assign a NEW unassigned inactive number from pool matching filters
        if (!selected) {
            selected = await IndianNumber.findOneAndUpdate(
                { ...baseFilter, is_active: "inactive", rdp_id: { $in: [null, ""] } },
                { $set: { is_active: "running", rdp_id, bro_id: broIdNum, updatedAt: new Date() } },
                { new: true }
            ).populate("password_formatters");
        }

        // 4. Relax filters if not found
        if (!selected && circleList.length > 0) {
            const noCircleFilter = { ...baseFilter };
            delete noCircleFilter.circle;
            selected = await IndianNumber.findOneAndUpdate(
                { ...noCircleFilter, is_active: "inactive", rdp_id: { $in: [null, ""] } },
                { $set: { is_active: "running", rdp_id, bro_id: broIdNum, updatedAt: new Date() } },
                { new: true }
            ).populate("password_formatters");
        }

        if (!selected && (operatorList.length > 0 || circleList.length > 0)) {
            selected = await IndianNumber.findOneAndUpdate(
                { is_active: "inactive", rdp_id: { $in: [null, ""] } },
                { $set: { is_active: "running", rdp_id, bro_id: broIdNum, updatedAt: new Date() } },
                { new: true }
            ).populate("password_formatters");
        }

        // 5. Ultimate Pool Fallback: Grab ANY unassigned inactive number
        if (!selected) {
            selected = await IndianNumber.findOneAndUpdate(
                { is_active: "inactive", rdp_id: { $in: [null, ""] } },
                { $set: { is_active: "running", rdp_id, bro_id: broIdNum, updatedAt: new Date() } },
                { new: true }
            ).populate("password_formatters");
        }

        // 6. Idle RDP Borrowing Fallback: Borrow from an offline/idle RDP
        if (!selected) {
            const protectedRdpIds = await getActiveRdpIds(IndianNumber, rdp_id);
            selected = await IndianNumber.findOneAndUpdate(
                { is_active: "inactive", rdp_id: { $nin: protectedRdpIds } },
                { $set: { is_active: "running", rdp_id, bro_id: broIdNum, updatedAt: new Date() } },
                { new: true }
            ).populate("password_formatters");
        }

        if (selected) {
            try {
                const resolvedInfo = resolveNumber(selected.number);
                if (resolvedInfo) {
                    const updateFields = {};
                    if (resolvedInfo.circle && resolvedInfo.circle !== "Unknown") {
                        if (!selected.circle || selected.circle === "Default" || selected.circle === "Unknown") {
                            updateFields.circle = resolvedInfo.circle;
                        }
                    }
                    if (resolvedInfo.operator && resolvedInfo.operator !== "Unknown") {
                        if (!selected.operator || selected.operator === "Default" || selected.operator === "Unknown") {
                            updateFields.operator = resolvedInfo.operator;
                        }
                    }
                    if (Object.keys(updateFields).length > 0) {
                        const updated = await IndianNumber.findByIdAndUpdate(
                            selected._id,
                            { $set: updateFields },
                            { new: true }
                        ).populate("password_formatters");
                        if (updated) selected = updated;
                    }
                }
            } catch (resolveErr) {}
            return res.json({ success: true, data: selected });
        }

        return res.status(200).json({ success: false, message: "No inactive numbers available" });
    } catch (err) {
        return res.status(200).json({ success: false, message: err.message });
    }
};



const createIndianNumber = async (req, res) => {
    try {
        const { operator, country_code, circle, number, password_formatters, limit } = req.body;
        const userId = req.user.id;

        const exists = await IndianNumber.findOne({ number });

        if (exists) {
            return res.status(200).json({
                success: true,
                data: exists,
                message: 'Phone number already exists'
            });
        }

        let formatterIds = parseFormatterIds(password_formatters);
        if (formatterIds.length === 0) {
            const PasswordFormatter = require('../models/PasswordFormatter');
            const cc = country_code || '91';
            let fQuery = { country_code: cc };
            if (userId) fQuery.userId = userId;
            formatterIds = await PasswordFormatter.find(fQuery).sort({ createdAt: 1 }).distinct('_id');
            if (formatterIds.length === 0) {
                formatterIds = await PasswordFormatter.find({ country_code: cc }).sort({ createdAt: 1 }).distinct('_id');
            }
        }
        const sanitized = resolveAndSanitizeOperator(number, operator, circle);

        const indianNumber = await IndianNumber.create({
            operator: sanitized.operator,
            country_code: country_code || '91',
            circle: sanitized.circle,
            number,
            password_formatters: formatterIds,
            is_active: 'inactive',
            limit: limit || null,
            userId
        });

        await indianNumber.populate('password_formatters');

        res.status(201).json({
            success: true,
            data: indianNumber,
            message: 'Phone number created successfully'
        });
    } catch (error) {
        res.status(200).json({
            success: false,
            message: error.message
        });
    }
};

const bulkCreateIndianNumbers = async (req, res) => {
    try {
        const { operator, country_code, circle, numbers, password_formatters, limit } = req.body;
        const userId = req.user.id;

        if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
            return res.status(200).json({
                success: false,
                message: 'At least one phone number is required'
            });
        }

        // Filter duplicates within the incoming payload
        const uniqueNumbers = [...new Set(numbers.map(num => String(num).trim()).filter(Boolean))];

        // Find which numbers already exist in the database
        const existingNumbers = await IndianNumber.find({
            number: { $in: uniqueNumbers }
        }).select('number');

        const existingNumberSet = new Set(existingNumbers.map(n => n.number));

        // Filter out existing numbers from the insert list
        const numbersToInsert = uniqueNumbers.filter(num => !existingNumberSet.has(num));

        if (numbersToInsert.length === 0) {
            return res.status(201).json({
                success: true,
                data: [],
                message: 'All uploaded numbers already exist in the database (duplicates skipped)',
                count: 0
            });
        }

        let formatterIds = parseFormatterIds(password_formatters);
        if (formatterIds.length === 0) {
            const PasswordFormatter = require('../models/PasswordFormatter');
            const cc = country_code || '91';
            let fQuery = { country_code: cc };
            if (userId) fQuery.userId = userId;
            formatterIds = await PasswordFormatter.find(fQuery).sort({ createdAt: 1 }).distinct('_id');
            if (formatterIds.length === 0) {
                formatterIds = await PasswordFormatter.find({ country_code: cc }).sort({ createdAt: 1 }).distinct('_id');
            }
        }

        // Prepare phone number documents with automatic operator/circle lookup fallback
        const indianNumbersToCreate = numbersToInsert.map(number => {
            const sanitized = resolveAndSanitizeOperator(number, operator, circle);
            return {
                operator: sanitized.operator,
                country_code: country_code || '91',
                circle: sanitized.circle,
                number,
                password_formatters: formatterIds,
                is_active: 'inactive',
                limit: limit || null,
                userId
            };
        });

        // Bulk insert new numbers
        const createdIndianNumbers = await IndianNumber.insertMany(indianNumbersToCreate, { ordered: true });

        // Populate formatters for response
        const populatedNumbers = await IndianNumber.find({
            _id: { $in: createdIndianNumbers.map(p => p._id) }
        }).populate('password_formatters');

        res.status(201).json({
            success: true,
            data: populatedNumbers,
            message: `${createdIndianNumbers.length} new phone number(s) created successfully, ${existingNumberSet.size} duplicates skipped`,
            count: createdIndianNumbers.length
        });

    } catch (error) {
        // Handle bulk write errors
        if (error.code === 11000) {
            return res.status(200).json({
                success: false,
                message: 'Duplicate phone number detected during parallel write',
                error: error.message
            });
        }

        res.status(200).json({
            success: false,
            message: error.message
        });
    }
};

const updateIndianNumber = async (req, res) => {
    try {
        const { operator, country_code, circle, number, password_formatters, is_active, limit, rdp_id, bro_id } = req.body;

        const formatterIds = parseFormatterIds(password_formatters);

        const query = { _id: req.params.id };
        if (req.user.role !== 'superadmin') {
            query.userId = req.user.id;
        }

        let indianNumber = await IndianNumber.findOne(query);

        if (!indianNumber) {
            return res.status(200).json({
                success: false,
                message: 'Phone number not found'
            });
        }

        // Check if the new number already exists (but not on this document)
        if (number !== undefined && number !== indianNumber.number) {
            const exists = await IndianNumber.findOne({
                number,
                _id: { $ne: req.params.id }
            });

            if (exists) {
                await IndianNumber.deleteOne({ _id: exists._id });
            }
        }

        const sanitized = resolveAndSanitizeOperator(number || indianNumber.number, operator, circle);
        indianNumber.operator = sanitized.operator;
        indianNumber.country_code = country_code || indianNumber.country_code || '91';
        indianNumber.circle = sanitized.circle;
        if (number !== undefined) indianNumber.number = number;
        indianNumber.password_formatters = formatterIds;
        if (limit !== undefined) {
            indianNumber.limit = limit;
        }

        if (is_active !== undefined) {
            let status = is_active;
            if (status === 'completed' && indianNumber.limit > 0) {
                status = 'inactive';
            }
            indianNumber.is_active = status;
        } else if (indianNumber.limit <= 0) {
            indianNumber.is_active = 'completed';
        }

        if (indianNumber.is_active === 'dead' || indianNumber.is_active === 'completed') {
            indianNumber.rdp_id = null;
            indianNumber.bro_id = null;
        } else {
            // Handle RDP ID - only set if valid non-empty string provided
            if (rdp_id !== undefined && rdp_id !== null && rdp_id !== "" && rdp_id !== "null" && rdp_id !== "None") {
                indianNumber.rdp_id = rdp_id.trim();
            }

            // Handle Browser ID (bro_id)
            if (bro_id !== undefined && bro_id !== null && bro_id !== "" && bro_id !== "null") {
                indianNumber.bro_id = Number(bro_id);
            }
        }

        // Always force updatedAt refresh
        indianNumber.updatedAt = new Date();

        await indianNumber.save();
        await indianNumber.populate('password_formatters');

        res.status(200).json({
            success: true,
            data: indianNumber,
            message: 'Phone number updated successfully'
        });
    } catch (error) {
        res.status(200).json({
            success: false,
            message: error.message
        });
    }
};

const patchIndianNumber = async (req, res) => {
    try {
        const { operator, circle, city, number, password_formatters, is_active, limit, rdp_id, bro_id } = req.body;

        const query = { _id: req.params.id };
        if (req.user.role !== 'superadmin') {
            query.userId = req.user.id;
        }

        let indianNumber = await IndianNumber.findOne(query);

        if (!indianNumber) {
            // Fallback: If the exact document was deleted during duplicate cleanup,
            // try to find the surviving document that shares the same 5-digit prefix
            // so we can seamlessly restore the bot's running progress and limit.
            if (number) {
                const prefix = String(number).substring(0, 5);
                const fallbackQuery = { number: new RegExp(`^${prefix}`) };
                if (req.user.role !== 'superadmin') {
                    fallbackQuery.userId = req.user.id;
                }
                indianNumber = await IndianNumber.findOne(fallbackQuery);
            }

            if (!indianNumber) {
                return res.status(200).json({
                    success: false,
                    message: 'Phone number not found'
                });
            }
        }

        // If a new number is provided, check it isn't already taken by another document
        if (number !== undefined && number !== indianNumber.number) {
            const exists = await IndianNumber.findOne({
                number,
                _id: { $ne: req.params.id }
            });

            if (exists) {
                await IndianNumber.deleteOne({ _id: exists._id });
            }

            indianNumber.number = number;
        }

        // Save last_scanned_number from finder progress payload
        if (number !== undefined && number !== null && number !== "") {
            indianNumber.last_scanned_number = number.toString().trim();
        }

        // Only overwrite fields that were actually sent
        if (operator !== undefined || circle !== undefined || number !== undefined) {
            const currentNumber = number !== undefined ? number : indianNumber.number;
            const currentOperator = operator !== undefined ? operator : indianNumber.operator;
            const currentCircle = circle !== undefined ? circle : indianNumber.circle;

            const sanitized = resolveAndSanitizeOperator(currentNumber, currentOperator, currentCircle);

            indianNumber.operator = sanitized.operator;
            indianNumber.circle = sanitized.circle;
        }
        if (city !== undefined) indianNumber.city = city;
        if (limit !== undefined) indianNumber.limit = limit;

        if (is_active !== undefined) {
            let status = is_active;
            if (status === 'completed' && indianNumber.limit > 0) {
                status = 'inactive';
            }
            indianNumber.is_active = status;
        }

        // Active Progress Resume Guard: If bot is actively sending progress updates with limit > 0 and not dead/completed, force status = 'running'
        if (indianNumber.limit > 0 && indianNumber.is_active !== 'dead' && indianNumber.is_active !== 'completed') {
            indianNumber.is_active = 'running';
        }

        if (password_formatters !== undefined) {
            indianNumber.password_formatters = parseFormatterIds(password_formatters);
        }

        const currentFormatterCount = indianNumber.password_formatters ? indianNumber.password_formatters.length : 0;

        // Reset consecutive_zero_checks if valid hits exist
        if (currentFormatterCount > 0) {
            indianNumber.consecutive_zero_checks = 0;
        }

        // Rule 1 Enforcement: limit <= 0 required for completed.
        // Status is ONLY 'dead' if explicitly set as 'dead' by the bot after 5,000 checks.
        if (indianNumber.limit <= 0) {
            indianNumber.is_active = 'completed';
        } else if (is_active === 'dead') {
            indianNumber.is_active = 'dead';
        }

        const savedRdpId = indianNumber.rdp_id || (rdp_id ? rdp_id.trim() : null);
        const savedBroId = indianNumber.bro_id !== null ? indianNumber.bro_id : ((bro_id !== undefined && bro_id !== null && bro_id !== "") ? Number(bro_id) : null);
        const savedOperator = indianNumber.operator;
        const savedCircle = indianNumber.circle;
        const savedUserId = indianNumber.userId;

        if (indianNumber.is_active === 'dead' || indianNumber.is_active === 'completed') {
            indianNumber.rdp_id = null;
            indianNumber.bro_id = null;
        } else {
            // Only update rdp_id if explicitly passed as a valid string in req.body
            if (rdp_id !== undefined && rdp_id !== null && rdp_id !== "" && rdp_id !== "null" && rdp_id !== "None") {
                indianNumber.rdp_id = rdp_id.trim();
            }

            // Handle Browser ID (bro_id)
            if (bro_id !== undefined && bro_id !== null && bro_id !== "" && bro_id !== "null") {
                indianNumber.bro_id = Number(bro_id);
            }
        }

        // Deduplication Guard: Check if another document on this same RDP is also running the exact same number
        let isDuplicateOnRdp = false;
        if (savedRdpId && indianNumber.number) {
            const existingDuplicate = await IndianNumber.findOne({
                _id: { $ne: indianNumber._id },
                number: indianNumber.number,
                rdp_id: savedRdpId,
                is_active: "running"
            });
            if (existingDuplicate) {
                isDuplicateOnRdp = true;
                indianNumber.is_active = "inactive";
                indianNumber.rdp_id = null;
                indianNumber.bro_id = null;
            }
        }

        // Always force updatedAt refresh so Mongoose updates timestamp on every progress save
        indianNumber.updatedAt = new Date();

        await indianNumber.save();
        await indianNumber.populate('password_formatters');

        // Instant Auto-Recovery: If number is running, immediately clear this RDP from InactiveRdp
        const effectiveRdpId = indianNumber.rdp_id || savedRdpId;
        if (indianNumber.is_active === 'running' && effectiveRdpId) {
            InactiveRdp.deleteOne({ rdp_id: effectiveRdpId }).catch(() => {});
        }

        // 10K RDP Scale: Send response IMMEDIATELY — don't block on replacement assignment
        res.status(200).json({
            success: true,
            data: indianNumber,
            replacement: null,
            message: 'Phone number patched successfully'
        });

        // Run replacement assignment in background (non-blocking, doesn't delay bot response)
        // The bot will also fetch its replacement via GET /inactive/random on its next cycle,
        // so this is a best-effort optimization, not a critical path.
        if ((indianNumber.is_active === 'dead' || indianNumber.is_active === 'completed' || isDuplicateOnRdp) && savedRdpId) {
            setImmediate(async () => {
                try {
                    // Get IDs of numbers currently assigned to other browsers on this RDP
                    const otherAssigned = await IndianNumber.find({
                        rdp_id: savedRdpId,
                        is_active: { $in: ["running", "inactive"] },
                        bro_id: { $ne: savedBroId, $nin: [null] }
                    }).select("_id").lean();
                    const excludeIds = otherAssigned.map(d => d._id);

                    const baseFilter = {
                        userId: savedUserId,
                        is_active: "inactive",
                        _id: { $nin: excludeIds },
                        $or: [{ rdp_id: savedRdpId }, { rdp_id: { $in: [null, ""] } }]
                    };
                    if (savedOperator && savedOperator !== "Unknown") baseFilter.operator = savedOperator;
                    if (savedCircle && savedCircle !== "Unknown") baseFilter.circle = savedCircle;

                    let replacement = await IndianNumber.findOneAndUpdate(
                        baseFilter,
                        { $set: { is_active: "running", rdp_id: savedRdpId, bro_id: savedBroId } },
                        { new: true }
                    );

                    if (!replacement && baseFilter.circle) {
                        delete baseFilter.circle;
                        replacement = await IndianNumber.findOneAndUpdate(
                            baseFilter,
                            { $set: { is_active: "running", rdp_id: savedRdpId, bro_id: savedBroId } },
                            { new: true }
                        );
                    }

                    if (!replacement) {
                        replacement = await IndianNumber.findOneAndUpdate(
                            { userId: savedUserId, is_active: "inactive", _id: { $nin: excludeIds }, $or: [{ rdp_id: savedRdpId }, { rdp_id: { $in: [null, ""] } }] },
                            { $set: { is_active: "running", rdp_id: savedRdpId, bro_id: savedBroId } },
                            { new: true }
                        );
                    }

                    // Fallback: Borrow from idle RDP
                    if (!replacement) {
                        const protectedRdpIds = await getActiveRdpIds(IndianNumber, savedRdpId);
                        replacement = await IndianNumber.findOneAndUpdate(
                            { userId: savedUserId, is_active: "inactive", _id: { $nin: excludeIds }, rdp_id: { $nin: protectedRdpIds } },
                            { $set: { is_active: "running", rdp_id: savedRdpId, bro_id: savedBroId } },
                            { new: true }
                        );
                    }
                } catch (asyncErr) {
                    console.error('[PatchAsync] Replacement assignment error:', asyncErr.message);
                }
            });
        }
    } catch (error) {
        res.status(200).json({
            success: false,
            message: error.message
        });
    }
};

const deleteIndianNumber = async (req, res) => {
    try {
        const query = { _id: req.params.id };
        if (req.user.role !== 'superadmin') {
            query.userId = req.user.id;
        }

        const indianNumber = await IndianNumber.findOne(query);

        if (!indianNumber) {
            return res.status(200).json({
                success: false,
                message: 'Phone number not found'
            });
        }

        await indianNumber.deleteOne();

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

const bulkDeleteIndianNumbers = async (req, res) => {
    try {
        const { ids, operator, circle, is_active } = req.body;

        if ((!ids || !Array.isArray(ids) || ids.length === 0) && !operator) {
            return res.status(200).json({
                success: false,
                message: 'At least one ID or operator is required'
            });
        }

        let query = {};
        if (req.user.role !== 'superadmin') {
            query.userId = req.user.id;
        }

        if (ids && ids.length > 0) {
            query._id = { $in: ids };
        } else {
            query.operator = operator;
            if (circle) {
                query.circle = circle;
            }
            if (is_active && is_active !== 'all') {
                if (is_active === 'active-inactive') {
                    query.is_active = { $in: ['inactive', 'running'] };
                } else if (is_active === 'offline') {
                    query.is_active = 'inactive';
                    query.rdp_id = { $nin: [null, ""] };
                } else {
                    query.is_active = is_active;
                }
            }
        }

        const result = await IndianNumber.deleteMany(query);

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


const bulkUpdateIndianNumberStatus = async (req, res) => {
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

        if (is_active === 'completed') {
            // Rule 1 enforcement: limit <= 0 required for completed. If limit > 0, set inactive.
            const resultCompleted = await IndianNumber.updateMany(
                { ...query, limit: { $lte: 0 } },
                { $set: { is_active: 'completed', rdp_id: null, bro_id: null } }
            );
            const resultInactive = await IndianNumber.updateMany(
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

        const result = await IndianNumber.updateMany(
            query,
            { $set: { is_active } }
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

const bulkUpdateIndianNumbers = async (req, res) => {
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
        if (data.operator !== undefined && data.operator !== "") updateFields.operator = data.operator.trim();
        if (data.circle !== undefined && data.circle !== "") updateFields.circle = data.circle.trim();
        if (data.country_code !== undefined && data.country_code !== "") updateFields.country_code = data.country_code.trim();
        if (data.limit !== undefined && data.limit !== "" && data.limit !== null) {
            const parsedLimit = Number(data.limit);
            if (!isNaN(parsedLimit)) updateFields.limit = parsedLimit;
        }

        if (data.clear_rdp) {
            updateFields.rdp_id = null;
            updateFields.bro_id = null;
        } else {
            if (data.rdp_id !== undefined) {
                updateFields.rdp_id = data.rdp_id ? data.rdp_id.trim() : null;
                if (!updateFields.rdp_id) {
                    updateFields.bro_id = null;
                }
            }
            if (data.bro_id !== undefined) {
                updateFields.bro_id = (data.bro_id !== null && data.bro_id !== "") ? Number(data.bro_id) : null;
            }
        }

        if (data.is_active !== undefined && data.is_active !== "") {
            updateFields.is_active = data.is_active;
            if (data.is_active === 'dead' || data.is_active === 'completed') {
                updateFields.rdp_id = null;
                updateFields.bro_id = null;
            }
        }
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

        const result = await IndianNumber.updateMany(
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

const resetRdpIndianNumbers = async (req, res) => {
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
        }

        // Reset all running numbers for this RDP immediately
        const result = await IndianNumber.updateMany(
            query,
            { $set: { is_active: "inactive" } }
        );

        res.status(200).json({
            success: true,
            modifiedCount: result.modifiedCount,
            message: `Reset ${result.modifiedCount} running Indian number(s) to inactive for RDP ${rdp_id}`
        });
    } catch (error) {
        res.status(200).json({
            success: false,
            message: error.message
        });
    }
};

const markIndianNumberDead = async (req, res) => {
    try {
        const { id, number, rdp_id, bro_id, operator, circle } = req.body;
        const targetId = id || req.params.id;

        let query = {};
        if (targetId) {
            query._id = targetId;
        } else if (number) {
            query.number = number;
        } else if (rdp_id && bro_id !== undefined && bro_id !== null) {
            query = { rdp_id, bro_id: Number(bro_id), is_active: { $ne: 'dead' } };
        } else if (rdp_id) {
            query = { rdp_id, is_active: { $ne: 'dead' } };
        } else {
            return res.status(200).json({
                success: false,
                message: "id, number, or rdp_id is required"
            });
        }

        if (req.user.role !== 'superadmin') {
            query.userId = req.user.id;
        }

        const deadNumber = await IndianNumber.findOne(query);
        if (!deadNumber) {
            return res.status(200).json({
                success: false,
                message: "Number not found"
            });
        }

        const savedRdpId = deadNumber.rdp_id || rdp_id;
        const savedBroId = deadNumber.bro_id !== null ? deadNumber.bro_id : (bro_id !== undefined && bro_id !== null ? Number(bro_id) : null);
        const savedOperator = deadNumber.operator || operator;
        const savedCircle = deadNumber.circle || circle;
        const savedUserId = deadNumber.userId;

        // Mark as dead and unbind from RDP/Browser ID
        deadNumber.is_active = "dead";
        deadNumber.rdp_id = null;
        deadNumber.bro_id = null;
        await deadNumber.save();

        // Automatically assign a new available number to the same RDP IP + Browser ID
        let replacement = null;
        if (savedRdpId) {
            const baseFilter = { userId: savedUserId, is_active: "inactive", $or: [{ rdp_id: savedRdpId }, { rdp_id: { $in: [null, ""] } }] };
            if (savedOperator && savedOperator !== "Unknown") baseFilter.operator = savedOperator;
            if (savedCircle && savedCircle !== "Unknown") baseFilter.circle = savedCircle;

            // 1. Match operator and circle
            replacement = await IndianNumber.findOneAndUpdate(
                baseFilter,
                { $set: { is_active: "running", rdp_id: savedRdpId, bro_id: savedBroId } },
                { new: true }
            ).populate("password_formatters");

            // 2. Fallback: relax circle
            if (!replacement && baseFilter.circle) {
                delete baseFilter.circle;
                replacement = await IndianNumber.findOneAndUpdate(
                    baseFilter,
                    { $set: { is_active: "running", rdp_id: savedRdpId, bro_id: savedBroId } },
                    { new: true }
                ).populate("password_formatters");
            }

            // 3. Fallback: relax operator (only unassigned or savedRdpId)
            if (!replacement) {
                replacement = await IndianNumber.findOneAndUpdate(
                    { userId: savedUserId, is_active: "inactive", $or: [{ rdp_id: savedRdpId }, { rdp_id: { $in: [null, ""] } }] },
                    { $set: { is_active: "running", rdp_id: savedRdpId, bro_id: savedBroId } },
                    { new: true }
                ).populate("password_formatters");
            }
        }

        res.status(200).json({
            success: true,
            message: `Number ${deadNumber.number} marked as Dead and unassigned. Replacement assigned.`,
            deadNumber,
            replacement: replacement || null
        });
    } catch (error) {
        res.status(200).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getIndianNumbers,
    getIndianNumberGroups,
    getIndianNumberById,
    getRandomInactiveIndianNumber,
    createIndianNumber,
    bulkCreateIndianNumbers,
    updateIndianNumber,
    patchIndianNumber,
    deleteIndianNumber,
    bulkDeleteIndianNumbers,
    bulkUpdateIndianNumberStatus,
    bulkUpdateIndianNumbers,
    resetRdpIndianNumbers,
    markIndianNumberDead
};