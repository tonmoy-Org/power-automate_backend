const PhoneNumber = require('../models/PhoneNumber');
const PhoneCredential = require('../models/PhoneCredential');

// Helper: extract only ObjectId strings from password_formatters,
// whether the client sends a JSON string, array of objects, or array of ID strings
const parseFormatterIds = (password_formatters) => {
    if (!password_formatters) return [];

    let formatters = password_formatters;

    // If it came in as a JSON string (e.g. from multipart/form-data), parse it first
    if (typeof formatters === 'string') {
        try {
            formatters = JSON.parse(formatters);
        } catch {
            return [];
        }
    }

    if (!Array.isArray(formatters)) return [];

    // Each item may be an ObjectId string or an object with an `id` or `_id` field
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
                    { pa_id: { $regex: search, $options: 'i' } },
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
                error: 'Not Found',
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
            error: 'Server Error',
            message: error.message
        });
    }
};

const getRandomInactivePhoneNumber = async (req, res) => {
    try {
        const { id: pa_id } = req.query;

        const filter = { is_active: false };
        if (pa_id) {
            filter.pa_id = pa_id;
        }

        const count = await PhoneNumber.countDocuments(filter);

        if (count === 0) {
            return res.status(404).json({
                success: false,
                error: 'Not Found',
                message: pa_id
                    ? `No inactive phone numbers available for pa_id: ${pa_id}`
                    : 'No inactive phone numbers available'
            });
        }

        const randomIndex = Math.floor(Math.random() * count);

        const phoneNumber = await PhoneNumber.findOne(filter)
            .skip(randomIndex)
            .populate('password_formatters');

        phoneNumber.is_active = true;
        await phoneNumber.save();

        res.status(200).json({
            success: true,
            data: phoneNumber
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error.message
        });
    }
};

const createPhoneNumber = async (req, res) => {
    try {
        const { country_code, number, browser_reset_time, password_formatters } = req.body;

        const formatterIds = parseFormatterIds(password_formatters);

        const pa_id = await PhoneNumber.generateNextPaId();

        const phoneNumber = await PhoneNumber.create({
            pa_id,
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
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                error: 'Duplicate Error',
                message: 'Phone number with this PA ID already exists'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error.message
        });
    }
};

const updatePhoneNumber = async (req, res) => {
    try {
        // ✅ is_active is now read from the request body
        const { country_code, number, browser_reset_time, password_formatters, is_active } = req.body;

        const formatterIds = parseFormatterIds(password_formatters);

        let phoneNumber = await PhoneNumber.findById(req.params.id);

        if (!phoneNumber) {
            return res.status(404).json({
                success: false,
                error: 'Not Found',
                message: 'Phone number not found'
            });
        }

        phoneNumber.country_code = country_code;
        phoneNumber.number = number;
        phoneNumber.browser_reset_time = browser_reset_time;
        phoneNumber.password_formatters = formatterIds;

        // ✅ Only update is_active if it was explicitly sent in the request
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
            error: 'Server Error',
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
                error: 'Not Found',
                message: 'Phone number not found'
            });
        }

        // Cascade delete: remove all PhoneCredentials linked to this pa_id
        await PhoneCredential.deleteMany({ pa_id: phoneNumber.pa_id });

        await phoneNumber.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Phone number deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error',
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