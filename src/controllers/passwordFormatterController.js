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

        // if (!start_add || start_index === undefined || !end_index || !end_add) {
        //     return res.status(400).json({
        //         success: false,
        //         error: 'Validation Error',
        //         message: 'Please provide start_add, start_index, end_index, and end_add'
        //     });
        // }

        // if (start_index < 0 || end_index < 0) {
        //     return res.status(400).json({
        //         success: false,
        //         error: 'Validation Error',
        //         message: 'Indices must be non-negative numbers'
        //     });
        // }

        // if (start_index > end_index) {
        //     return res.status(400).json({
        //         success: false,
        //         error: 'Validation Error',
        //         message: 'Start index must be less than or equal to end index'
        //     });
        // }

        const formatter = await PasswordFormatter.create({
            start_add,
            start_index,
            end_index,
            end_add
        });

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

        if (!start_add || start_index === undefined || !end_index || !end_add) {
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: 'Please provide start_add, start_index, end_index, and end_add'
            });
        }

        if (start_index < 0 || end_index < 0) {
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: 'Indices must be non-negative numbers'
            });
        }

        if (start_index > end_index) {
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: 'Start index must be less than or equal to end index'
            });
        }

        let formatter = await PasswordFormatter.findById(req.params.id);

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

        formatter.start_add = start_add;
        formatter.start_index = start_index;
        formatter.end_index = end_index;
        formatter.end_add = end_add;

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