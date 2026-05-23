const PhoneNumber = require('../models/PhoneNumber');
const IndianNumber = require('../models/IndianNumber');

const runScan = async (watchMinutes) => {
    try {

        const now = Date.now();
        const watchWindow = watchMinutes * 60 * 1000; // minutes → ms

        // --- Global PhoneNumbers ---
        const records = await PhoneNumber.find({
            is_active: "running"
        }).select("_id updatedAt is_active");

        let resets = 0;

        for (const record of records) {

            const updatedAtTime = new Date(record.updatedAt);
            const updatedAt = updatedAtTime.getTime();

            const currentTime = new Date(now);
            const diff = now - updatedAt;

            const diffSeconds = Math.floor(diff / 1000);
            const diffMinutes = Math.floor(diff / 60000);

            console.log(`
[PhoneMonitor] Record: ${record._id}
Updated At : ${updatedAtTime.toISOString()}
Current Time: ${currentTime.toISOString()}
Difference : ${diffSeconds}s (${diffMinutes} min)
`);

            // ❗ If record NOT updated for more than watchMinutes
            if (diff > watchWindow) {

                record.is_active = "inactive";
                await record.save();

                resets++;

                console.log(
                    `[PhoneMonitor] ${record._id} → set to inactive (no update for ${diffMinutes} min)`
                );
            }
        }

        console.log(
            `[PhoneMonitor] PhoneNumber scan done — ${resets} reset, ${records.length} checked`
        );

        // --- Indian Numbers ---
        const indianRecords = await IndianNumber.find({
            is_active: "running"
        }).select("_id updatedAt is_active");

        let indianResets = 0;

        for (const record of indianRecords) {

            const updatedAtTime = new Date(record.updatedAt);
            const diff = now - updatedAtTime.getTime();
            const diffMinutes = Math.floor(diff / 60000);

            if (diff > watchWindow) {
                record.is_active = "inactive";
                await record.save();
                indianResets++;
                console.log(
                    `[IndianMonitor] ${record._id} → set to inactive (no update for ${diffMinutes} min)`
                );
            }
        }

        console.log(
            `[IndianMonitor] IndianNumber scan done — ${indianResets} reset, ${indianRecords.length} checked`
        );

    } catch (err) {
        console.error("[PhoneMonitor] Scan error:", err.message);
    }
};

const startPhoneNumberMonitor = (scanMinutes = 1, watchMinutes = 5) => {

    const intervalMs = scanMinutes * 60 * 1000;

    console.log(
        `[PhoneMonitor] scanning every ${scanMinutes} min (watch ${watchMinutes} min)`
    );

    // Run immediately
    runScan(watchMinutes);

    const timer = setInterval(() => {
        runScan(watchMinutes);
    }, intervalMs);

    if (timer.unref) timer.unref();

    return {
        stop: () => clearInterval(timer),
        runNow: () => runScan(watchMinutes)
    };
};

module.exports = { startPhoneNumberMonitor };