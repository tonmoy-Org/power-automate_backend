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
        const { page = 1, limit = 10, search = '' } = req.query;
        const skip = (page - 1) * limit;

        let query = {};

        if (search) {
            query = {
                $or: [
                    { number: { $regex: search, $options: 'i' } },
                    { country_code: { $regex: search, $options: 'i' } }
                ]
            };
        }

        const total = await PhoneNumber.countDocuments(query);

        const phoneNumbers = await PhoneNumber.find(query)
            .populate('password_formatters')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            data: phoneNumbers,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
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
        const { country_code } = req.query;

        const filter = {
            is_active: false,
            ...(country_code && { country_code })
        };

        const count = await PhoneNumber.countDocuments(filter);

        if (!count) {
            return res.status(404).json({
                success: false,
                message: "No inactive phone numbers available"
            });
        }

        const randomIndex = Math.floor(Math.random() * count);

        const phoneNumber = await PhoneNumber.findOne(filter)
            .skip(randomIndex)
            .populate("password_formatters");

        phoneNumber.is_active = true;
        await phoneNumber.save();

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

const createPhoneNumber = async (req, res) => {
    try {
        const { country_code, number, browser_reset_time, password_formatters } = req.body;

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
            browser_reset_time,
            password_formatters: formatterIds,
            is_active: false
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

const updatePhoneNumber = async (req, res) => {
    try {
        const { country_code, number, browser_reset_time, password_formatters, is_active } = req.body;

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
        phoneNumber.browser_reset_time = browser_reset_time;
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

module.exports = {
    getPhoneNumbers,
    getPhoneNumberById,
    getRandomInactivePhoneNumber,
    createPhoneNumber,
    updatePhoneNumber,
    deletePhoneNumber
};