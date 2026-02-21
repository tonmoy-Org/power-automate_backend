const PhoneNumber = require('../models/PhoneNumber');

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

const getPhoneNumberByPaId = async (req, res) => {
    try {

        const { pa_id } = req.params;

        const phoneNumbers = await PhoneNumber.find({ pa_id: pa_id });

        if (!phoneNumbers || phoneNumbers.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Not Found',
                message: 'No phone numbers found for this pa_id'
            });
        }

        res.status(200).json({
            success: true,
            count: phoneNumbers.length,
            data: phoneNumbers
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
        const count = await PhoneNumber.countDocuments({ is_active: false });

        if (count === 0) {
            return res.status(404).json({
                success: false,
                error: 'Not Found',
                message: 'No inactive phone numbers available'
            });
        }

        const randomIndex = Math.floor(Math.random() * count);

        const phoneNumber = await PhoneNumber.findOne({ is_active: false }).skip(randomIndex);

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

const getRandomInactivePhoneNumberByPaId = async (req, res) => {
    try {
        const { pa_id } = req.params;

        const count = await PhoneNumber.countDocuments({
            is_active: false,
            pa_id: pa_id
        });

        if (count === 0) {
            return res.status(404).json({
                success: false,
                error: 'Not Found',
                message: 'No inactive phone numbers available for this pa_id'
            });
        }

        const randomIndex = Math.floor(Math.random() * count);

        const phoneNumber = await PhoneNumber.findOne({
            is_active: false,
            pa_id: pa_id
        }).skip(randomIndex);

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

        const pa_id = await PhoneNumber.generateNextPaId();

        const phoneNumber = await PhoneNumber.create({
            pa_id,
            country_code,
            number,
            browser_reset_time,
            password_formatters: password_formatters || [],
            is_active: false
        });

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
        const { country_code, number, browser_reset_time, password_formatters } = req.body;

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
        phoneNumber.password_formatters = password_formatters || [];

        await phoneNumber.save();

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
    getPhoneNumberByPaId,
    getRandomInactivePhoneNumber,
    getRandomInactivePhoneNumberByPaId,
    createPhoneNumber,
    updatePhoneNumber,
    deletePhoneNumber
};