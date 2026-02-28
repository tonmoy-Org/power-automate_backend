const PhoneNumber = require('../models/PhoneNumber');

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
        const { search = '' } = req.query;

        let query = {};

        if (search) {
            query = {
                $or: [
                    { number: { $regex: search, $options: 'i' } },
                    { country_code: { $regex: search, $options: 'i' } }
                ]
            };
        }

        const phoneNumbers = await PhoneNumber.find(query)
            .populate('password_formatters')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: phoneNumbers,
            total: phoneNumbers.length
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error.message
        });
    }
};

const getPhoneNumberById = async (req, res) => {
    try {
        const phoneNumber = await PhoneNumber.findById(req.params.id)
            .populate('password_formatters');

        if (!phoneNumber) {
            return res.status(404).json({
                success: false,
                message: 'Phone number not found'
            });
        }

        res.status(200).json({
            success: true,
            data: phoneNumber
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getRandomInactivePhoneNumber = async (req, res) => {
    try {
        const { country_code, rdp_id } = req.query;

        if (!country_code || !rdp_id) {
            return res.status(400).json({
                success: false,
                message: "country_code and rdp_id are required"
            });
        }

        // 🔹 Get all inactive numbers for this country
        const cc_items = await PhoneNumber.find({
            country_code,
            is_active: "inactive"
        });

        if (cc_items.length > 0) {

            // 🔹 Filter by rdp_id
            const rdp_items = cc_items.filter(
                item => item.rdp_id === rdp_id
            );

            // ✅ If same rdp exists
            if (rdp_items.length > 0) {

                const selected = rdp_items[0];

                selected.is_active = "running";
                await selected.save();

                return res.json({
                    success: true,
                    data: selected
                });

            } 
            const in_active_items = cc_items.filter(
                item => item.rdp_id === null
            );
            if (in_active_items.length > 0){
                // ✅ No rdp match → pick random inactive
                const selected = in_active_items[0];

                selected.is_active = "running";
                selected.rdp_id = rdp_id;

                await selected.save();

                return res.json({
                    success: true,
                    data: selected
                });
            }
        }

        return res.status(404).json({
            success: false,
            message: "No inactive numbers available"
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


const createPhoneNumber = async (req, res) => {
    try {
        const { country_code, number, password_formatters } = req.body;

        const exists = await PhoneNumber.findOne({ number });

        if (exists) {
            return res.status(400).json({
                success: false,
                message: 'Phone number already exists'
            });
        }

        const formatterIds = parseFormatterIds(password_formatters);

        const phoneNumber = await PhoneNumber.create({
            country_code,
            number,
            password_formatters: formatterIds,
            is_active: 'inactive'
        });

        await phoneNumber.populate('password_formatters');

        res.status(201).json({
            success: true,
            data: phoneNumber,
            message: 'Phone number created successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const bulkCreatePhoneNumbers = async (req, res) => {
    try {
        const { country_code, numbers, password_formatters } = req.body;

        if (!country_code) {
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
        const existingNumbers = await PhoneNumber.find({
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
        const phoneNumbersToCreate = numbers.map(number => ({
            country_code,
            number,
            password_formatters: formatterIds,
            is_active: 'inactive'
        }));

        // Bulk insert
        const createdPhoneNumbers = await PhoneNumber.insertMany(phoneNumbersToCreate, { ordered: false });

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

const updatePhoneNumber = async (req, res) => {
    try {
        const { country_code, number, password_formatters, is_active } = req.body;

        const formatterIds = parseFormatterIds(password_formatters);

        let phoneNumber = await PhoneNumber.findById(req.params.id);

        if (!phoneNumber) {
            return res.status(404).json({
                success: false,
                message: 'Phone number not found'
            });
        }

        const exists = await PhoneNumber.findOne({
            number,
            _id: { $ne: req.params.id }
        });

        if (exists) {
            return res.status(400).json({
                success: false,
                message: 'Phone number already exists'
            });
        }

        phoneNumber.country_code = country_code;
        phoneNumber.number = number;
        phoneNumber.password_formatters = formatterIds;

        if (is_active !== undefined) {
            phoneNumber.is_active = is_active;
        }

        await phoneNumber.save();
        await phoneNumber.populate('password_formatters');

        res.status(200).json({
            success: true,
            data: phoneNumber,
            message: 'Phone number updated successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const patchPhoneNumber = async (req, res) => {
    try {
        const { country_code, number, password_formatters, is_active } = req.body;

        const phoneNumber = await PhoneNumber.findById(req.params.id);

        if (!phoneNumber) {
            return res.status(404).json({
                success: false,
                message: 'Phone number not found'
            });
        }

        // If a new number is provided, check it isn't already taken by another document
        if (number !== undefined && number !== phoneNumber.number) {
            const exists = await PhoneNumber.findOne({
                number,
                _id: { $ne: req.params.id }
            });

            if (exists) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone number already exists'
                });
            }

            phoneNumber.number = number;
        }

        // Only overwrite fields that were actually sent
        if (country_code !== undefined) phoneNumber.country_code = country_code;
        if (is_active !== undefined) phoneNumber.is_active = is_active;

        if (password_formatters !== undefined) {
            phoneNumber.password_formatters = parseFormatterIds(password_formatters);
        }

        await phoneNumber.save();
        await phoneNumber.populate('password_formatters');

        res.status(200).json({
            success: true,
            data: phoneNumber,
            message: 'Phone number patched successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const deletePhoneNumber = async (req, res) => {
    try {
        const phoneNumber = await PhoneNumber.findById(req.params.id);

        if (!phoneNumber) {
            return res.status(404).json({
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
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const bulkDeletePhoneNumbers = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one ID is required'
            });
        }

        const result = await PhoneNumber.deleteMany({
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


const bulkUpdatePhoneNumberStatus = async (req, res) => {
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

        const result = await PhoneNumber.updateMany(
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
    bulkUpdatePhoneNumberStatus
};