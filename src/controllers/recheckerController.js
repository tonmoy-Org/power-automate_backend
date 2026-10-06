const RecheckerCredential = require('../models/RecheckerCredential');

/**
 * Bulk Upload Old Credentials into Re-Checker Pool
 */
exports.bulkUpload = async (req, res) => {
    try {
        const { items, textData } = req.body;
        let parsedItems = [];

        if (Array.isArray(items) && items.length > 0) {
            parsedItems = items;
        } else if (typeof textData === 'string' && textData.trim()) {
            const lines = textData.split(/\r?\n/);
            for (let line of lines) {
                line = line.trim();
                if (!line || line.startsWith('Number')) continue;

                // Support both TSV (tab) and Colon (:) formats
                let parts = line.includes('\t') ? line.split('\t') : line.split(':');
                if (parts.length >= 2) {
                    let phone = parts[0].trim().replace(/[^\d]/g, '');
                    let password = parts[1].trim();
                    let old_status = parts[2] ? parts[2].trim() : 'UNKNOWN';
                    let stateOp = parts[3] ? parts[3].trim() : '';

                    let circle = null;
                    let operator = null;
                    if (stateOp.includes('>')) {
                        const splitted = stateOp.split('>');
                        circle = splitted[0].trim();
                        operator = splitted[1].trim();
                    }

                    if (phone && password) {
                        parsedItems.push({ phone, password, old_status, operator, circle });
                    }
                }
            }
        }

        if (parsedItems.length === 0) {
            return res.status(200).json({ success: false, message: 'No valid phone:password items provided' });
        }

        const bulkOps = parsedItems.map(item => ({
            updateOne: {
                filter: { phone: item.phone },
                update: {
                    $setOnInsert: {
                        country_code: '91',
                        phone: item.phone,
                        password: item.password,
                        old_status: item.old_status || 'UNKNOWN',
                        operator: item.operator || null,
                        circle: item.circle || null,
                        status: 'pending',
                    }
                },
                upsert: true
            }
        }));

        const result = await RecheckerCredential.bulkWrite(bulkOps);
        const totalPending = await RecheckerCredential.countDocuments({ status: 'pending' });

        return res.status(200).json({
            success: true,
            message: `Successfully processed ${parsedItems.length} records (${result.upsertedCount} new inserted)`,
            upsertedCount: result.upsertedCount,
            matchedCount: result.matchedCount,
            totalPending
        });

    } catch (error) {
        console.error('[RecheckerController] Bulk Upload Error:', error);
        return res.status(200).json({ success: false, message: error.message });
    }
};

/**
 * Fetch Random Pending Credential for RDP Bot Rechecking
 */
exports.getInactiveRandom = async (req, res) => {
    try {
        const { rdp_id, bro_id, operator, circle } = req.query;

        const query = { status: 'pending' };
        if (operator && operator !== 'none' && operator !== 'undefined') {
            query.operator = Array.isArray(operator) ? { $in: operator } : operator;
        }
        if (circle && circle !== 'none' && circle !== 'undefined') {
            query.circle = Array.isArray(circle) ? { $in: circle } : circle;
        }

        // Try matched RDP assignment first
        let credential = await RecheckerCredential.findOneAndUpdate(
            { ...query, rdp_id: rdp_id || null },
            {
                $set: {
                    status: 'running',
                    rdp_id: rdp_id || null,
                    bro_id: bro_id ? parseInt(bro_id, 10) : null,
                    last_checked: new Date()
                }
            },
            { new: true, sort: { updatedAt: 1 } }
        );

        // Fallback to any pending unassigned credential
        if (!credential) {
            credential = await RecheckerCredential.findOneAndUpdate(
                query,
                {
                    $set: {
                        status: 'running',
                        rdp_id: rdp_id || null,
                        bro_id: bro_id ? parseInt(bro_id, 10) : null,
                        last_checked: new Date()
                    }
                },
                { new: true, sort: { updatedAt: 1 } }
            );
        }

        if (!credential) {
            return res.status(200).json({ success: false, message: 'No pending rechecker credentials available' });
        }

        return res.status(200).json({
            success: true,
            credential: {
                id: credential._id,
                phone: credential.phone,
                password: credential.password,
                old_status: credential.old_status,
                operator: credential.operator,
                circle: credential.circle,
                country_code: credential.country_code
            }
        });

    } catch (error) {
        console.error('[RecheckerController] Get Random Error:', error);
        return res.status(200).json({ success: false, message: error.message });
    }
};

/**
 * Update Valid Rechecked Credential (Permanent Store)
 */
exports.updateValid = async (req, res) => {
    try {
        const { phone, password, type, operator, circle } = req.body;

        if (!phone) {
            return res.status(200).json({ success: false, message: 'Phone number required' });
        }

        const updated = await RecheckerCredential.findOneAndUpdate(
            { phone },
            {
                $set: {
                    status: 'valid',
                    password: password || undefined,
                    type: type || 'VALID',
                    operator: operator || undefined,
                    circle: circle || undefined,
                    last_checked: new Date()
                }
            },
            { new: true, upsert: true }
        );

        return res.status(200).json({
            success: true,
            message: `Successfully saved valid credential for ${phone}`,
            data: updated
        });

    } catch (error) {
        console.error('[RecheckerController] Update Valid Error:', error);
        return res.status(200).json({ success: false, message: error.message });
    }
};

/**
 * Get Paginated List of Valid Rechecked Credentials for Dashboard
 */
exports.getValidList = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 50;
        const search = req.query.search || '';
        const operator = req.query.operator || '';
        const circle = req.query.circle || '';

        const query = { status: 'valid' };
        if (search) {
            query.phone = { $regex: search, $options: 'i' };
        }
        if (operator) {
            query.operator = operator;
        }
        if (circle) {
            query.circle = circle;
        }

        const total = await RecheckerCredential.countDocuments(query);
        const data = await RecheckerCredential.find(query)
            .sort({ last_checked: -1, updatedAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        return res.status(200).json({
            success: true,
            total,
            page,
            pages: Math.ceil(total / limit),
            data
        });

    } catch (error) {
        console.error('[RecheckerController] Get Valid List Error:', error);
        return res.status(200).json({ success: false, message: error.message });
    }
};

/**
 * Export All Valid Credentials as Text / TSV File
 */
exports.exportValid = async (req, res) => {
    try {
        const validHits = await RecheckerCredential.find({ status: 'valid' })
            .sort({ last_checked: -1 })
            .lean();

        const format = req.query.format || 'colon'; // 'colon' or 'tsv'
        let output = '';

        if (format === 'tsv') {
            output = 'Number\tPassword\tType\tCircle\tOperator\tLastChecked\n';
            for (const hit of validHits) {
                output += `${hit.phone}\t${hit.password}\t${hit.type || 'VALID'}\t${hit.circle || ''}\t${hit.operator || ''}\t${hit.last_checked ? new Date(hit.last_checked).toISOString() : ''}\n`;
            }
            res.setHeader('Content-Type', 'text/tab-separated-values; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="rechecked_valid_hits.tsv"');
        } else {
            // Default colon format: phone:password:type
            for (const hit of validHits) {
                output += `${hit.phone}:${hit.password}:${hit.type || 'VALID'}\n`;
            }
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="rechecked_valid_hits.txt"');
        }

        return res.send(output);

    } catch (error) {
        console.error('[RecheckerController] Export Valid Error:', error);
        return res.status(200).json({ success: false, message: error.message });
    }
};

/**
 * Clear / Delete All Valid Credentials (Manual Delete Button)
 */
exports.clearValid = async (req, res) => {
    try {
        const result = await RecheckerCredential.deleteMany({ status: 'valid' });

        return res.status(200).json({
            success: true,
            message: `Successfully cleared ${result.deletedCount} valid records from database.`,
            deletedCount: result.deletedCount
        });

    } catch (error) {
        console.error('[RecheckerController] Clear Valid Error:', error);
        return res.status(200).json({ success: false, message: error.message });
    }
};

/**
 * Get Overall Rechecker Pool Statistics
 */
exports.getStats = async (req, res) => {
    try {
        const [total, pending, running, valid, invalid] = await Promise.all([
            RecheckerCredential.countDocuments({}),
            RecheckerCredential.countDocuments({ status: 'pending' }),
            RecheckerCredential.countDocuments({ status: 'running' }),
            RecheckerCredential.countDocuments({ status: 'valid' }),
            RecheckerCredential.countDocuments({ status: 'invalid' })
        ]);

        return res.status(200).json({
            success: true,
            stats: { total, pending, running, valid, invalid }
        });

    } catch (error) {
        console.error('[RecheckerController] Get Stats Error:', error);
        return res.status(200).json({ success: false, message: error.message });
    }
};
