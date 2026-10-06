const fs = require('fs');
const path = require('path');
const PhoneCredential = require('../models/PhoneCredential');
const IndianPhoneCredential = require('../models/IndianPhoneCredential');
const DailyHistory = require('../models/DailyHistory');
const googleSheets = require('../utils/googleSheets');
const User = require('../models/User');

// Helper to get start and end UTC timestamps for a given Dhaka date (M/D/YYYY)
function getDhakaDateRangeUTC(dateStr) {
    const [m, day, y] = dateStr.split('/').map(Number);
    const startUTC = new Date(Date.UTC(y, m - 1, day, 0, 0, 0) - 6 * 3600000);
    const endUTC = new Date(Date.UTC(y, m - 1, day, 23, 59, 59, 999) - 6 * 3600000);
    return { startUTC, endUTC };
}

// Convert a UTC date to Dhaka date string (M/D/YYYY)
function getDhakaDateString(dateObj) {
    const utc = dateObj.getTime() + (dateObj.getTimezoneOffset() * 60000);
    const dhakaTime = new Date(utc + (3600000 * 6));
    return `${dhakaTime.getMonth() + 1}/${dhakaTime.getDate()}/${dhakaTime.getFullYear()}`;
}

/**
 * Non-destructive Daily Statistics Synchronizer
 * NOTE: Credentials in MongoDB are PERMANENT and are NEVER automatically deleted.
 * Manual deletion is available to SuperAdmin via UI dashboards.
 */
async function runCleanup() {
    try {
        console.log('[DailyStatsService] Running non-destructive daily statistics synchronization...');

        const clientUsers = await User.find({ role: 'client' }).select('_id').lean();
        const clientUserIds = clientUsers.map(u => u._id);

        const now = new Date();
        const datesToSync = [];

        // Check recent 7 days to keep DailyHistory accurate and up to date
        for (let i = 0; i < 7; i++) {
            const d = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
            datesToSync.push(getDhakaDateString(d));
        }

        const syncedStats = [];

        for (const dateStr of datesToSync) {
            const { startUTC, endUTC } = getDhakaDateRangeUTC(dateStr);

            const [generalCount, indianCount] = await Promise.all([
                PhoneCredential.countDocuments({
                    createdAt: { $gte: startUTC, $lte: endUTC },
                    userId: { $nin: clientUserIds }
                }),
                IndianPhoneCredential.countDocuments({
                    createdAt: { $gte: startUTC, $lte: endUTC },
                    userId: { $nin: clientUserIds }
                })
            ]);

            if (generalCount > 0 || indianCount > 0) {
                await DailyHistory.findOneAndUpdate(
                    { date: dateStr },
                    {
                        $set: {
                            generalCount,
                            indianCount
                        }
                    },
                    { upsert: true, new: true }
                );
                syncedStats.push({ date: dateStr, generalCount, indianCount });
            }
        }

        console.log(`[DailyStatsService] Synced statistics for ${syncedStats.length} dates. Zero records deleted (Permanent Storage Active).`);

        return {
            status: 'success',
            message: 'Daily statistics synchronized successfully. Auto-deletion is disabled (Permanent Retention Active).',
            syncedDates: syncedStats
        };
    } catch (error) {
        console.error('[DailyStatsService] Error during statistics synchronization:', error);
        throw error;
    }
}

function startCleanupService(intervalMinutes = 30) {
    console.log(`[DailyStatsService] Initializing. Syncing statistics every ${intervalMinutes} minutes (Permanent Storage Active - Auto-Delete Disabled).`);
    
    runCleanup().catch(err => console.error('[DailyStatsService] Initial sync failed:', err));

    const intervalMs = intervalMinutes * 60 * 1000;
    const timer = setInterval(() => {
        runCleanup().catch(err => console.error('[DailyStatsService] Scheduled sync failed:', err));
    }, intervalMs);

    if (timer.unref) timer.unref();

    return {
        stop: () => clearInterval(timer),
        runNow: () => runCleanup()
    };
}

module.exports = {
    startCleanupService,
    runCleanup
};

