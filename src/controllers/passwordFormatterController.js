const PasswordFormatter = require('../models/PasswordFormatter');
const mongoose = require('mongoose');

const getPasswordFormatters = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const skip = (page - 1) * limit;

        let query = {};

        if (search) {
            query.$or = [
                { start_add: { $regex: search, $options: 'i' } },
                { end_add: { $regex: search, $options: 'i' } },
                { country_code: { $regex: search, $options: 'i' } }
            ];
        }

        const { country_code } = req.query;
        if (country_code) {
            query.country_code = country_code;
        }

        const total = await PasswordFormatter.countDocuments(query);

        const formatters = await PasswordFormatter.find(query)
            .sort({ country_code: 1, createdAt: 1 })
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
        const { start_add, start_index, end_index, end_add, country_code } = req.body;

        const updateData = {};
        if (start_add !== undefined) updateData.start_add = start_add;
        if (start_index !== undefined) updateData.start_index = start_index;
        if (end_index !== undefined) updateData.end_index = end_index;
        if (end_add !== undefined) updateData.end_add = end_add;
        if (country_code !== undefined) updateData.country_code = country_code;

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

        if (start_add !== undefined) formatter.start_add = start_add;
        if (start_index !== undefined) formatter.start_index = start_index;
        if (end_index !== undefined) formatter.end_index = end_index;
        if (end_add !== undefined) formatter.end_add = end_add;
        if (req.body.country_code !== undefined) formatter.country_code = req.body.country_code;

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
        const { id } = req.params;

        // Validate the ID is a valid ObjectId — prevents a bad ID from
        // accidentally matching many documents or throwing a CastError
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                message: 'Invalid formatter ID'
            });
        }

        // Find the exact single document by its unique _id
        const formatter = await PasswordFormatter.findById(id);

        if (!formatter) {
            return res.status(404).json({
                success: false,
                error: 'Not Found',
                message: 'Password formatter not found'
            });
        }

        // deleteOne() on the document instance:
        // - deletes ONLY this one document (scoped to _id internally)
        // - triggers the pre('deleteOne', { document: true }) hook
        //   which removes this formatter's ID from all PhoneNumbers automatically
        await formatter.deleteOne();

        res.status(200).json({
            success: true,
            message: `Password formatter '${formatter.start_add} → ${formatter.end_add}' deleted successfully`
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
            .sort({ country_code: 1, createdAt: 1 })
            .select('start_add end_add start_index end_index country_code');

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

const bulkDeletePasswordFormatters = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one ID is required'
            });
        }

        const PhoneNumber = mongoose.model('PhoneNumber');

        // 1. Remove these formatter IDs from all PhoneNumbers first
        // This mirrors the behavior of the single delete hook but in bulk
        await PhoneNumber.updateMany(
            { password_formatters: { $in: ids } },
            { $pull: { password_formatters: { $in: ids } } }
        );

        // 2. Perform the bulk delete
        const result = await PasswordFormatter.deleteMany({
            _id: { $in: ids }
        });

        res.status(200).json({
            success: true,
            message: `${result.deletedCount} password formatter(s) deleted successfully`
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
    getPasswordFormattersList,
    bulkDeletePasswordFormatters
};