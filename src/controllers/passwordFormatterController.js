const PasswordFormatter = require('../models/PasswordFormatter');
const mongoose = require('mongoose');

const getPasswordFormatters = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const skip = (page - 1) * limit;

        let query = {};
        if (req.user.role !== 'superadmin') {
            query.userId = req.user.id;
        } else if (req.query.userId) {
            if (req.query.userId !== 'all') {
                query.userId = req.query.userId;
            }
        } else {
            query.userId = req.user.id;
        }

        if (search) {
            const escapedSearch = search.trim().toLowerCase().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            query.$or = [
                { start_add: { $regex: escapedSearch, $options: 'i' } },
                { end_add: { $regex: escapedSearch, $options: 'i' } },
                { country_code: { $regex: escapedSearch, $options: 'i' } },
                { circle: { $regex: escapedSearch, $options: 'i' } },
                { operator: { $regex: escapedSearch, $options: 'i' } },
                { group: { $regex: escapedSearch, $options: 'i' } }
            ];
        }

        const { country_code, circle, operator, group } = req.query;
        if (country_code) {
            query.country_code = country_code;
        }
        if (circle) {
            query.circle = circle;
        }
        if (operator) {
            query.operator = operator;
        }
        if (group) {
            query.group = group;
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
        res.status(200).json({
            success: false,
            error: 'Server Error',
            message: error.message
        });
    }
};

const getPasswordFormatterById = async (req, res) => {
    try {
        const query = { _id: req.params.id };
        if (req.user.role !== 'superadmin') {
            query.userId = req.user.id;
        }
        const formatter = await PasswordFormatter.findOne(query);

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
        res.status(200).json({
            success: false,
            error: 'Server Error',
            message: error.message
        });
    }
};

/**
 * Bulletproof helper: Replaces (sets) the exact active password formatters
 * on all numbers matching this country_code.
 * Ensures zero old, duplicate, or rogue formatters linger on any number document.
 */
const syncCountryFormatters = async (countryCode, userId = null) => {
    if (!countryCode) return;
    const cc = String(countryCode).trim();
    const PhoneNumber = require('../models/PhoneNumber');
    const IndianNumber = require('../models/IndianNumber');
    const cache = require('../utils/cache');

    let query = { country_code: cc };
    if (userId) {
        query.userId = userId;
    }

    let activeFormatters = await PasswordFormatter.find(query).sort({ createdAt: 1 }).distinct('_id');

    // Fallback: if user-scoped lookup returns 0 but formatters exist for this CC, use them
    if (activeFormatters.length === 0 && userId) {
        activeFormatters = await PasswordFormatter.find({ country_code: cc }).sort({ createdAt: 1 }).distinct('_id');
    }

    // Cleanly REPLACE the password_formatters array on global phone numbers
    await PhoneNumber.updateMany(
        { country_code: cc },
        { $set: { password_formatters: activeFormatters } }
    );

    // Cleanly REPLACE the password_formatters array on all Indian numbers (CC 91)
    if (cc === '91') {
        await IndianNumber.updateMany(
            {},
            { $set: { password_formatters: activeFormatters } }
        );
        cache.clearIndianNumbersCache();
    }

    cache.clearPhoneNumbersCache();
};

const createPasswordFormatter = async (req, res) => {
    try {
        const { start_add, start_index, end_index, end_add, country_code, circle, operator, group } = req.body;

        const updateData = { userId: req.user.id };
        if (start_add !== undefined) updateData.start_add = start_add;
        if (start_index !== undefined) updateData.start_index = start_index;
        if (end_index !== undefined) updateData.end_index = end_index;
        if (end_add !== undefined) updateData.end_add = end_add;
        if (country_code !== undefined) updateData.country_code = country_code;
        if (circle !== undefined) updateData.circle = circle;
        if (operator !== undefined) updateData.operator = operator;
        if (group !== undefined) updateData.group = group;

        const formatter = await PasswordFormatter.create(updateData);

        if (country_code) {
            await syncCountryFormatters(country_code, req.user.id);
        }

        res.status(201).json({
            success: true,
            data: formatter,
            message: 'Password formatter created successfully'
        });
    } catch (error) {
        res.status(200).json({
            success: false,
            error: 'Server Error',
            message: error.message
        });
    }
};

const bulkCreatePasswordFormatters = async (req, res) => {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one item is required'
            });
        }

        const docs = items.map(({ start_add, start_index, end_index, end_add, country_code, circle, operator, group }) => ({
            userId: req.user.id,
            ...(start_add !== undefined && { start_add }),
            ...(start_index !== undefined && { start_index }),
            ...(end_index !== undefined && { end_index }),
            ...(end_add !== undefined && { end_add }),
            ...(country_code !== undefined && { country_code }),
            ...(circle !== undefined && { circle }),
            ...(operator !== undefined && { operator }),
            ...(group !== undefined && { group }),
        }));

        const created = await PasswordFormatter.insertMany(docs, { ordered: false });

        const countryCodes = [...new Set(docs.map(d => d.country_code).filter(Boolean))];
        for (const cc of countryCodes) {
            await syncCountryFormatters(cc, req.user.id);
        }

        res.status(201).json({
            success: true,
            data: created,
            message: `${created.length} password formatter(s) created successfully`
        });
    } catch (error) {
        res.status(200).json({
            success: false,
            error: 'Server Error',
            message: error.message
        });
    }
};

const updatePasswordFormatter = async (req, res) => {
    try {
        const { start_add, start_index, end_index, end_add } = req.body;

        const query = { _id: req.params.id };
        if (req.user.role !== 'superadmin') {
            query.userId = req.user.id;
        }

        const formatter = await PasswordFormatter.findOne(query);

        if (!formatter) {
            return res.status(404).json({
                success: false,
                error: 'Not Found',
                message: 'Password formatter not found'
            });
        }

        const oldCountryCode = formatter.country_code;

        if (start_add !== undefined) formatter.start_add = start_add;
        if (start_index !== undefined) formatter.start_index = start_index;
        if (end_index !== undefined) formatter.end_index = end_index;
        if (end_add !== undefined) formatter.end_add = end_add;
        if (req.body.country_code !== undefined) formatter.country_code = req.body.country_code;
        if (req.body.circle !== undefined) formatter.circle = req.body.circle;
        if (req.body.operator !== undefined) formatter.operator = req.body.operator;
        if (req.body.group !== undefined) formatter.group = req.body.group;

        await formatter.save();

        const newCountryCode = formatter.country_code;
        await syncCountryFormatters(newCountryCode, formatter.userId || req.user.id);
        if (oldCountryCode && String(oldCountryCode) !== String(newCountryCode)) {
            await syncCountryFormatters(oldCountryCode, formatter.userId || req.user.id);
        }

        res.status(200).json({
            success: true,
            data: formatter,
            message: 'Password formatter updated successfully'
        });
    } catch (error) {
        res.status(200).json({
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
        const query = { _id: id };
        if (req.user.role !== 'superadmin') {
            query.userId = req.user.id;
        }

        const formatter = await PasswordFormatter.findOne(query);

        if (!formatter) {
            return res.status(404).json({
                success: false,
                error: 'Not Found',
                message: 'Password formatter not found'
            });
        }

        const targetCountryCode = formatter.country_code;
        const targetUserId = formatter.userId || req.user.id;

        // deleteOne() on the document instance triggers pre('deleteOne') hook
        await formatter.deleteOne();

        // Resync numbers to ensure exact active list and clean cache
        if (targetCountryCode) {
            await syncCountryFormatters(targetCountryCode, targetUserId);
        }

        res.status(200).json({
            success: true,
            message: `Password formatter '${formatter.start_add} → ${formatter.end_add}' deleted successfully`
        });
    } catch (error) {
        res.status(200).json({
            success: false,
            error: 'Server Error',
            message: error.message
        });
    }
};

const getPasswordFormattersList = async (req, res) => {
    try {
        const query = {};
        if (req.user.role !== 'superadmin') {
            query.userId = req.user.id;
        } else if (req.query.userId) {
            if (req.query.userId !== 'all') {
                query.userId = req.query.userId;
            }
        } else {
            query.userId = req.user.id;
        }

        const formatters = await PasswordFormatter.find(query)
            .sort({ country_code: 1, circle: 1, operator: 1, createdAt: 1 })
            .select('start_add end_add start_index end_index country_code circle operator group');

        res.status(200).json({
            success: true,
            data: formatters
        });
    } catch (error) {
        res.status(200).json({
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
        const IndianNumber = mongoose.model('IndianNumber');

        const phoneQuery = { password_formatters: { $in: ids } };
        const deleteQuery = { _id: { $in: ids } };
        if (req.user.role !== 'superadmin') {
            phoneQuery.userId = req.user.id;
            deleteQuery.userId = req.user.id;
        }

        const toDeleteDocs = await PasswordFormatter.find(deleteQuery).select('country_code userId');
        const affectedCCs = [...new Set(toDeleteDocs.map(d => d.country_code).filter(Boolean))];

        // 1. Remove these formatter IDs from all PhoneNumbers and IndianNumbers first
        await Promise.all([
            PhoneNumber.updateMany(
                phoneQuery,
                { $pull: { password_formatters: { $in: ids } } }
            ),
            IndianNumber.updateMany(
                phoneQuery,
                { $pull: { password_formatters: { $in: ids } } }
            )
        ]);

        // 2. Perform the bulk delete
        const result = await PasswordFormatter.deleteMany(deleteQuery);

        // 3. Resync all affected country codes to guarantee clean state & clear caches
        for (const cc of affectedCCs) {
            await syncCountryFormatters(cc, req.user.id);
        }

        res.status(200).json({
            success: true,
            message: `${result.deletedCount} password formatter(s) deleted successfully`
        });
    } catch (error) {
        res.status(200).json({
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
    bulkCreatePasswordFormatters,
    updatePasswordFormatter,
    deletePasswordFormatter,
    getPasswordFormattersList,
    bulkDeletePasswordFormatters
};