const LocalNumber = require('../models/LocalNumber');
const operatorResolver = require('../utils/operatorResolver');

/**
 * Bulk Import Local Numbers (One-Click Import)
 * Supports:
 *   1. TSV / number_password.txt format: Number\tPassword\tStatus\tState_Operator
 *   2. Colon format: phone:password:status:state_operator or phone:password
 *   3. JSON array of objects
 * Preserves sequential order without deduplication.
 */
const importLocalNumbers = async (req, res) => {
    try {
        const { content, rows, source, rdp_id } = req.body;
        const inputSource = source || 'MANUAL_IMPORT';
        const resolvedRdpId = (rdp_id && String(rdp_id).trim() !== '')
            ? String(rdp_id).trim()
            : (inputSource && inputSource.startsWith('RDP_') ? inputSource.replace('RDP_', '').trim() : null);

        let rawLines = [];

        if (Array.isArray(rows)) {
            rawLines = rows;
        } else if (typeof content === 'string') {
            rawLines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        } else {
            return res.status(400).json({
                success: false,
                message: 'Please provide raw text content or rows array to import.'
            });
        }

        const docsToInsert = [];

        for (let i = 0; i < rawLines.length; i++) {
            const line = rawLines[i];
            if (typeof line !== 'string') continue;

            // Skip header if present
            if (i === 0 && line.toLowerCase().includes('number') && line.toLowerCase().includes('password')) {
                continue;
            }

            let phone = '';
            let password = '';
            let status = 'UNKNOWN';
            let state_operator = '';
            let operator = '';
            let circle = '';

            // Check if tab-separated
            if (line.includes('\t')) {
                const parts = line.split('\t').map(p => p.trim());
                phone = parts[0] || '';
                password = parts[1] || '';
                status = parts[2] || 'UNKNOWN';
                state_operator = parts[3] || '';
            } else if (line.includes(':')) {
                const parts = line.split(':').map(p => p.trim());
                phone = parts[0] || '';
                password = parts[1] || '';
                status = parts[2] || 'UNKNOWN';
                state_operator = parts[3] || '';
            } else {
                phone = line.trim();
            }

            if (!phone) continue;

            // Resolve operator & circle from state_operator or phone number
            if (state_operator && state_operator.includes('>')) {
                const [c, op] = state_operator.split('>').map(s => s.trim());
                circle = c || '';
                operator = op || '';
            } else if (state_operator) {
                circle = state_operator;
            }

            if (!operator || !circle || operator === 'Unknown' || circle === 'Unknown') {
                const cleanPhone = phone.startsWith('91') && phone.length === 12 ? phone.slice(2) : phone;
                const resolved = operatorResolver.resolveNumber(cleanPhone, '91');
                if (!operator || operator === 'Unknown') operator = resolved.operator || '';
                if (!circle || circle === 'Unknown') circle = resolved.circle || '';
                if (!state_operator && (circle || operator)) {
                    state_operator = `${circle || 'Unknown'}>${operator || 'Unknown'}`;
                }
            }

            docsToInsert.push({
                phone,
                password,
                status,
                state_operator,
                operator,
                circle,
                source: inputSource,
                rdp_id: resolvedRdpId
            });
        }

        if (docsToInsert.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid phone numbers found in the provided content.'
            });
        }

        // Insert in batches of 2,500 for optimal memory & high-speed execution
        const BATCH_SIZE = 2500;
        let insertedCount = 0;

        for (let b = 0; b < docsToInsert.length; b += BATCH_SIZE) {
            const batch = docsToInsert.slice(b, b + BATCH_SIZE);
            const result = await LocalNumber.insertMany(batch, { ordered: false });
            insertedCount += result.length;
        }

        return res.status(200).json({
            success: true,
            message: `Successfully imported ${insertedCount} local numbers into dedicated storage.`,
            count: insertedCount
        });
    } catch (error) {
        console.error('[LocalNumberController] Error importing numbers:', error);
        return res.status(200).json({
            success: false,
            message: error.message || 'Error importing local numbers'
        });
    }
};

/**
 * Save Single Hit from Script/Bot
 */
const createLocalNumber = async (req, res) => {
    try {
        const { phone, password, status, type, state_operator, operator, circle, rdp_id, bro_id, source } = req.body;

        if (!phone) {
            return res.status(400).json({ success: false, message: 'Phone is required' });
        }

        const safeStatus = status || type || 'UNKNOWN';
        let op = operator || '';
        let cir = circle || '';
        let so = state_operator || '';

        if (!so && (cir || op)) {
            so = `${cir || 'Unknown'}>${op || 'Unknown'}`;
        }

        const doc = await LocalNumber.create({
            phone,
            password: password || '',
            status: safeStatus,
            state_operator: so,
            operator: op,
            circle: cir,
            rdp_id: rdp_id || null,
            bro_id: bro_id || null,
            source: source || 'SCRIPT_HIT'
        });

        return res.status(201).json({
            success: true,
            message: 'Local hit recorded successfully',
            data: doc
        });
    } catch (error) {
        return res.status(200).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get Local Numbers (Paginated with Search & Filters)
 */
const getLocalNumbers = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(10, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        const { search, operator, circle, status } = req.query;

        const filter = {};

        if (search) {
            filter.$or = [
                { phone: { $regex: search.trim(), $options: 'i' } },
                { password: { $regex: search.trim(), $options: 'i' } }
            ];
        }

        if (operator && operator !== 'ALL') {
            filter.operator = operator;
        }

        if (circle && circle !== 'ALL') {
            filter.circle = circle;
        }

        if (status && status !== 'ALL') {
            filter.status = status;
        }

        const [numbers, total, totalAll, operators, statuses] = await Promise.all([
            LocalNumber.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            LocalNumber.countDocuments(filter),
            LocalNumber.estimatedDocumentCount(),
            LocalNumber.distinct('operator'),
            LocalNumber.distinct('status')
        ]);

        return res.status(200).json({
            success: true,
            data: numbers,
            total,
            totalAll,
            page,
            totalPages: Math.ceil(total / limit) || 1,
            filters: {
                operators: operators.filter(Boolean),
                statuses: statuses.filter(Boolean)
            }
        });
    } catch (error) {
        console.error('[LocalNumberController] Error fetching local numbers:', error);
        return res.status(200).json({
            success: false,
            message: error.message,
            data: [],
            total: 0
        });
    }
};

/**
 * One-Click Download / Export all numbers as TSV text file
 */
const downloadLocalNumbers = async (req, res) => {
    try {
        const { operator, circle, status } = req.query;
        const filter = {};

        if (operator && operator !== 'ALL') filter.operator = operator;
        if (circle && circle !== 'ALL') filter.circle = circle;
        if (status && status !== 'ALL') filter.status = status;

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="local_numbers.txt"');

        // Write TSV Header
        res.write('Number\tPassword\tStatus\tState_Operator\n');

        // Stream cursor to avoid high memory spikes
        const cursor = LocalNumber.find(filter).sort({ createdAt: -1 }).cursor();

        for await (const doc of cursor) {
            const line = `${doc.phone}\t${doc.password || ''}\t${doc.status || 'UNKNOWN'}\t${doc.state_operator || `${doc.circle}>${doc.operator}`}\n`;
            res.write(line);
        }

        res.end();
    } catch (error) {
        console.error('[LocalNumberController] Error downloading local numbers:', error);
        if (!res.headersSent) {
            return res.status(500).json({ success: false, message: error.message });
        }
        res.end();
    }
};

/**
 * Clear All Local Numbers (SuperAdmin only)
 */
const clearLocalNumbers = async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({ success: false, message: 'SuperAdmin permission required.' });
        }

        const result = await LocalNumber.deleteMany({});
        return res.status(200).json({
            success: true,
            message: `Successfully cleared ${result.deletedCount} local numbers.`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        return res.status(200).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    importLocalNumbers,
    createLocalNumber,
    getLocalNumbers,
    downloadLocalNumbers,
    clearLocalNumbers
};
