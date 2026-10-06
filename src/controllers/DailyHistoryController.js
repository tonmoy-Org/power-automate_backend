const DailyHistory = require('../models/DailyHistory');
const { runCleanup } = require('../services/cleanupService');

const getHistory = async (req, res) => {
    try {
        const history = await DailyHistory.find().sort({ createdAt: -1 }).limit(100);
        res.status(200).json(history);
    } catch (error) {
        console.error('[DailyHistoryController] Error fetching history:', error);
        res.status(200).json({ message: 'Server error while fetching daily history' });
    }
};

const triggerCleanup = async (req, res) => {
    try {
        const result = await runCleanup();
        res.status(200).json({
            message: 'Daily statistics synchronized successfully (Permanent Retention Active)',
            data: result
        });
    } catch (error) {
        console.error('[DailyHistoryController] Error running manual sync:', error);
        res.status(200).json({ message: 'Failed to run statistics sync', error: error.message });
    }
};

module.exports = {
    getHistory,
    triggerCleanup
};
