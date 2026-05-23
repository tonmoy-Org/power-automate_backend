const IndianNumber = require('../models/IndianNumber');

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

const getIndianNumbers = async (req, res) => {
    try {
        const { search = '', summary, operator, circle } = req.query;

        if (summary === 'true') {
            const summaryData = await IndianNumber.aggregate([
                {
                    $group: {
                        _id: {
                            operator: '$operator',
                            circle: '$circle',
                            country_code: '$country_code'
                        },
                        count: { $sum: 1 },
                        ids: { $push: '$_id' }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        operator: '$_id.operator',
                        circle: '$_id.circle',
                        country_code: '$_id.country_code',
                        count: 1,
                        ids: 1
                    }
                }
            ]);

            return res.status(200).json({
                success: true,
                summary: true,
                data: summaryData
            });
        }

        let query = {};

        if (search) {
            query.$or = [
                { number: { $regex: search, $options: 'i' } },
                { operator: { $regex: search, $options: 'i' } },
                { rdp_id: { $regex: search, $options: 'i' } }
            ];
        }

        if (operator) {
            query.operator = operator;
        }

        if (circle !== undefined) {
            query.circle = circle === 'null' || circle === '' ? null : circle;
        }

        const indianNumbers = await IndianNumber.find(query)
            .populate('password_formatters')
            .sort({ createdAt: 1 })
            .lean();

        res.status(200).json({
            success: true,
            data: indianNumbers,
            total: indianNumbers.length
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error.message
        });
    }
};

const getIndianNumberById = async (req, res) => {
    try {
        const indianNumber = await IndianNumber.findById(req.params.id)
            .populate('password_formatters')
            .lean();

        if (!indianNumber) {
            return res.status(404).json({
                success: false,
                message: 'Phone number not found'
            });
        }

        res.status(200).json({
            success: true,
            data: indianNumber
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getRandomInactiveIndianNumber = async (req, res) => {
    try {
        const { country_code, operator, circle, rdp_id } = req.query;
        // rdp_id is required
        if (!rdp_id) {
            return res.status(400).json({
                success: false,
                message: "rdp_id is required"
            });
        }
        // Build query allowing optional operators, circles and country_code
        const query = {
            is_active: "inactive"
        };
        if (country_code) {
            query.country_code = country_code;
        }
        if (operator && operator !== 'None' && operator !== 'undefined' && operator !== '') {
            const operatorList = Array.isArray(operator) ? operator : [operator];
            query.operator = { $in: operatorList };
        }
        if (circle && circle !== 'None' && circle !== 'undefined' && circle !== '') {
            const circleList = Array.isArray(circle) ? circle : [circle];
            query.circle = { $in: circleList };
        }
        const cc_items = await IndianNumber.find(query).populate("password_formatters");
        if (cc_items.length > 0) {
            // Prefer numbers that already have this rdp_id assigned
            const rdp_items = cc_items.filter(item => item.rdp_id === rdp_id);
            if (rdp_items.length > 0) {
                const selected = rdp_items[0];
                selected.is_active = "running";
                await selected.save();
                return res.json({ success: true, data: selected });
            }
            // Otherwise, assign the first inactive number without rdp_id
            const in_active_items = cc_items.filter(item => !item.rdp_id);
            if (in_active_items.length > 0) {
                const selected = in_active_items[0];
                selected.is_active = "running";
                selected.rdp_id = rdp_id;
                await selected.save();
                return res.json({ success: true, data: selected });
            }
        }
        return res.status(404).json({ success: false, message: "No inactive numbers available" });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};


const createIndianNumber = async (req, res) => {
    try {
        const { operator, country_code, circle, number, password_formatters, limit } = req.body;

        const exists = await IndianNumber.findOne({ number });

        if (exists) {
            return res.status(400).json({
                success: false,
                message: 'Phone number already exists'
            });
        }

        const formatterIds = parseFormatterIds(password_formatters);

        const indianNumber = await IndianNumber.create({
            operator,
            country_code,
            circle,
            number,
            password_formatters: formatterIds,
            is_active: 'inactive',
            limit: limit || null
        });

        await indianNumber.populate('password_formatters');

        res.status(201).json({
            success: true,
            data: indianNumber,
            message: 'Phone number created successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const bulkCreateIndianNumbers = async (req, res) => {
    try {
        const { operator, country_code, circle, numbers, password_formatters, limit } = req.body;

        if (!operator) {
            return res.status(400).json({
                success: false,
                message: 'Country code is required'
            });
        }

        if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one phone number is required'
            });
        }

        // Check for duplicates within the request
        const uniqueNumbers = [...new Set(numbers)];
        if (uniqueNumbers.length !== numbers.length) {
            return res.status(400).json({
                success: false,
                message: 'Duplicate numbers found in the request',
                duplicates: numbers.filter((num, index) => numbers.indexOf(num) !== index)
            });
        }

        // Find existing numbers
        const existingNumbers = await IndianNumber.find({
            number: { $in: numbers }
        }).select('number');

        const existingNumberSet = new Set(existingNumbers.map(n => n.number));

        if (existingNumberSet.size > 0) {
            return res.status(400).json({
                success: false,
                message: 'Some phone numbers already exist',
                existingNumbers: Array.from(existingNumberSet)
            });
        }

        const formatterIds = parseFormatterIds(password_formatters);

        // Prepare all phone number documents
        const indianNumbersToCreate = numbers.map(number => ({
            operator,
            country_code,
            circle,
            number,
            password_formatters: formatterIds,
            is_active: 'inactive',
            limit: limit || null
        }));

        // Bulk insert
        const createdIndianNumbers = await IndianNumber.insertMany(indianNumbersToCreate, { ordered: true });

        // Populate formatters for response
        const populatedNumbers = await IndianNumber.find({
            _id: { $in: createdIndianNumbers.map(p => p._id) }
        }).populate('password_formatters');

        res.status(201).json({
            success: true,
            data: populatedNumbers,
            message: `${createdIndianNumbers.length} phone number(s) created successfully`,
            count: createdIndianNumbers.length
        });

    } catch (error) {
        // Handle bulk write errors
        if (error.code === 11000) {
            // Duplicate key error
            return res.status(400).json({
                success: false,
                message: 'Duplicate phone number detected',
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const updateIndianNumber = async (req, res) => {
    try {
        const { operator, country_code, circle, number, password_formatters, is_active, limit, rdp_id } = req.body;

        const formatterIds = parseFormatterIds(password_formatters);

        let indianNumber = await IndianNumber.findById(req.params.id);

        if (!indianNumber) {
            return res.status(404).json({
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
                return res.status(400).json({
                    success: false,
                    message: 'Phone number already exists'
                });
            }
        }

        indianNumber.operator = operator;
        indianNumber.country_code = country_code;
        indianNumber.circle = circle;
        indianNumber.number = number;
        indianNumber.password_formatters = formatterIds;

        if (is_active !== undefined) {
            indianNumber.is_active = is_active;
        }

        if (limit !== undefined) {
            indianNumber.limit = limit;
        }

        // Handle RDP ID - set to null if empty string or undefined
        if (rdp_id !== undefined) {
            indianNumber.rdp_id = rdp_id ? rdp_id.trim() : null;
        }

        await indianNumber.save();
        await indianNumber.populate('password_formatters');

        res.status(200).json({
            success: true,
            data: indianNumber,
            message: 'Phone number updated successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const patchIndianNumber = async (req, res) => {
    try {
        const { operator, circle, city, number, password_formatters, is_active, limit, rdp_id } = req.body;

        const indianNumber = await IndianNumber.findById(req.params.id);

        if (!indianNumber) {
            return res.status(404).json({
                success: false,
                message: 'Phone number not found'
            });
        }

        // If a new number is provided, check it isn't already taken by another document
        if (number !== undefined && number !== indianNumber.number) {
            const exists = await IndianNumber.findOne({
                number,
                _id: { $ne: req.params.id }
            });

            if (exists) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone number already exists'
                });
            }

            indianNumber.number = number;
        }

        // Only overwrite fields that were actually sent
        if (operator !== undefined) indianNumber.operator = operator;
        if (circle !== undefined) indianNumber.circle = circle;
        if (city !== undefined) indianNumber.city = city;
        if (is_active !== undefined) indianNumber.is_active = is_active;
        if (limit !== undefined) indianNumber.limit = limit;

        if (password_formatters !== undefined) {
            indianNumber.password_formatters = parseFormatterIds(password_formatters);
        }

        // Handle RDP ID - set to null if empty string, or trim if provided
        if (rdp_id !== undefined) {
            indianNumber.rdp_id = rdp_id ? rdp_id.trim() : null;
        }

        await indianNumber.save();
        await indianNumber.populate('password_formatters');

        res.status(200).json({
            success: true,
            data: indianNumber,
            message: 'Phone number patched successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const deleteIndianNumber = async (req, res) => {
    try {
        const indianNumber = await IndianNumber.findById(req.params.id);

        if (!indianNumber) {
            return res.status(404).json({
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
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const bulkDeleteIndianNumbers = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one ID is required'
            });
        }

        const result = await IndianNumber.deleteMany({
            _id: { $in: ids }
        });

        res.status(200).json({
            success: true,
            message: `${result.deletedCount} phone number(s) deleted successfully`,
            deletedCount: result.deletedCount
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


const bulkUpdateIndianNumberStatus = async (req, res) => {
    try {
        const { ids, is_active } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one ID is required'
            });
        }

        if (!is_active || !['inactive', 'running', 'completed'].includes(is_active)) {
            return res.status(400).json({
                success: false,
                message: 'Valid status is required (inactive, running, completed)'
            });
        }

        const result = await IndianNumber.updateMany(
            { _id: { $in: ids } },
            { $set: { is_active } }
        );

        res.status(200).json({
            success: true,
            message: `${result.modifiedCount} phone number(s) updated successfully`,
            modifiedCount: result.modifiedCount
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const bulkUpdateIndianNumbers = async (req, res) => {
    try {
        const { ids, data } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one ID is required'
            });
        }

        if (!data || typeof data !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'Update data is required'
            });
        }

        const updateFields = {};
        if (data.limit !== undefined) updateFields.limit = data.limit;
        if (data.rdp_id !== undefined) updateFields.rdp_id = data.rdp_id ? data.rdp_id.trim() : null;
        if (data.is_active !== undefined) updateFields.is_active = data.is_active;
        if (data.password_formatters !== undefined) {
            updateFields.password_formatters = parseFormatterIds(data.password_formatters);
        }

        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid update fields provided'
            });
        }

        const result = await IndianNumber.updateMany(
            { _id: { $in: ids } },
            { $set: updateFields }
        );

        res.status(200).json({
            success: true,
            message: `${result.modifiedCount} phone number(s) updated successfully`,
            modifiedCount: result.modifiedCount
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getIndianNumbers,
    getIndianNumberById,
    getRandomInactiveIndianNumber,
    createIndianNumber,
    bulkCreateIndianNumbers,
    updateIndianNumber,
    patchIndianNumber,
    deleteIndianNumber,
    bulkDeleteIndianNumbers,
    bulkUpdateIndianNumberStatus,
    bulkUpdateIndianNumbers
};