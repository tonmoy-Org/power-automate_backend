const PasswordFormatter = require('../models/PasswordFormatter');
const PhoneNumber = require('../models/PhoneNumber');

const getPasswordFormatters = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const skip = (page - 1) * limit;

        let query = {};

        if (search) {
            query = {
                $or: [
                    { start_add: { $regex: search, $options: 'i' } },
                    { end_add: { $regex: search, $options: 'i' } }
                ]
            };
        }

        const total = await PasswordFormatter.countDocuments(query);

        const formatters = await PasswordFormatter.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const formattersWithUsage = await Promise.all(
            formatters.map(async (formatter) => {
                const isInUse = await PasswordFormatter.isInUse(formatter._id);
                return {
                    ...formatter.toObject(),
                    isInUse
                };
            })
        );

        res.status(200).json({
            success: true,
            data: formattersWithUsage,
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

const getPasswordFormatterById = async (req, res) => {
    try {
        const formatter = await PasswordFormatter.findById(req.params.id);

        if (!formatter) {
            return res.status(404).json({
                success: false,
                error: 'Not Found',
                message: 'Password formatter not found'
            });
        }

        const isInUse = await PasswordFormatter.isInUse(formatter._id);

        res.status(200).json({
            success: true,
            data: {
                ...formatter.toObject(),
                isInUse
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

const createPasswordFormatter = async (req, res) => {
    try {
        const { start_add, start_index, end_index, end_add } = req.body;

        // Build update object with only provided fields
        const updateData = {};
        if (start_add !== undefined) updateData.start_add = start_add;
        if (start_index !== undefined) updateData.start_index = start_index;
        if (end_index !== undefined) updateData.end_index = end_index;
        if (end_add !== undefined) updateData.end_add = end_add;

        const formatter = await PasswordFormatter.create(updateData);

        res.status(201).json({
            success: true,
            data: formatter,
            message: 'Password formatter created successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error.message
        });
    }
};

const updatePasswordFormatter = async (req, res) => {
    try {
        const { start_add, start_index, end_index, end_add } = req.body;

        const formatter = await PasswordFormatter.findById(req.params.id);

        if (!formatter) {
            return res.status(404).json({
                success: false,
                error: 'Not Found',
                message: 'Password formatter not found'
            });
        }

        const isInUse = await PasswordFormatter.isInUse(formatter._id);

        if (isInUse) {
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: 'Cannot update formatter that is currently in use by phone numbers'
            });
        }

        // Update only provided fields
        if (start_add !== undefined) formatter.start_add = start_add;
        if (start_index !== undefined) formatter.start_index = start_index;
        if (end_index !== undefined) formatter.end_index = end_index;
        if (end_add !== undefined) formatter.end_add = end_add;

        await formatter.save();

        res.status(200).json({
            success: true,
            data: formatter,
            message: 'Password formatter updated successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error.message
        });
    }
};

const deletePasswordFormatter = async (req, res) => {
    try {
        const formatter = await PasswordFormatter.findById(req.params.id);

        if (!formatter) {
            return res.status(404).json({
                success: false,
                error: 'Not Found',
                message: 'Password formatter not found'
            });
        }

        const isInUse = await PasswordFormatter.isInUse(formatter._id);

        if (isInUse) {
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: 'Cannot delete formatter that is currently in use by phone numbers'
            });
        }

        await formatter.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Password formatter deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: error.message
        });
    }
};

const getPasswordFormattersList = async (req, res) => {
    try {
        const formatters = await PasswordFormatter.find()
            .sort({ start_add: 1 })
            .select('start_add end_add start_index end_index');

        res.status(200).json({
            success: true,
            data: formatters
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
    getPasswordFormatters,
    getPasswordFormatterById,
    createPasswordFormatter,
    updatePasswordFormatter,
    deletePasswordFormatter,
    getPasswordFormattersList
};