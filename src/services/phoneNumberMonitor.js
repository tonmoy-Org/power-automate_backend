const PhoneNumber = require('../models/PhoneNumber');
const InactiveRdp = require('../models/InactiveRdp');

const runScan = async () => {
    try {
        const now = Date.now();
        const window60m = 60 * 60 * 1000; // STRICT 60-MINUTE RULE

        const records = await PhoneNumber.find({
            is_active: "running"
        }).select("_id updatedAt is_active limit rdp_id bro_id");

        const rdpMap = new Map();
        const noRdpRecords = [];

        for (const record of records) {
            if (!record.rdp_id) {
                noRdpRecords.push(record);
            } else {
                if (!rdpMap.has(record.rdp_id)) {
                    rdpMap.set(record.rdp_id, []);
                }
                rdpMap.get(record.rdp_id).push(record);
            }
        }

        const activeRdpIds = new Set();
        let totalResetNumbers = 0;
        let totalInactiveRdps = 0;

        for (const [rdp_id, nums] of rdpMap.entries()) {
            let maxUpdatedAt = 0;
            for (const n of nums) {
                const t = n.updatedAt ? new Date(n.updatedAt).getTime() : 0;
                if (t > maxUpdatedAt) maxUpdatedAt = t;
            }

            const rdpDiff = now - maxUpdatedAt;

            // 60-MINUTE RULE:
            // If AT LEAST ONE number under this RDP communicated within 60 minutes:
            // The RDP is ALIVE and stays running!
            if (rdpDiff <= window60m) {
                activeRdpIds.add(rdp_id);

                // Lagging individual numbers under this active RDP reset only if >60 minutes
                for (const n of nums) {
                    const numDiff = now - (n.updatedAt ? new Date(n.updatedAt).getTime() : 0);
                    if (numDiff > window60m) {
                        n.is_active = n.limit <= 0 ? "completed" : "inactive";
                        if (n.limit <= 0) {
                            n.rdp_id = null;
                            n.bro_id = null;
                        }
                        await n.save();
                        totalResetNumbers++;
                    }
                }
            } else {
                // ALL numbers under this RDP have been silent for >60 minutes!
                // Officially INACTIVE RDP!
                totalInactiveRdps++;
                for (const n of nums) {
                    n.is_active = n.limit <= 0 ? "completed" : "inactive";
                    if (n.limit <= 0) {
                        n.rdp_id = null;
                        n.bro_id = null;
                    }
                    await n.save();
                    totalResetNumbers++;
                }

                try {
                    await InactiveRdp.updateOne(
                        { rdp_id },
                        {
                            $set: {
                                pool: 'global',
                                lastSeen: new Date(maxUpdatedAt),
                                inactivatedAt: new Date(),
                                reason: '60m Total Inactivity Across All Numbers'
                            }
                        },
                        { upsert: true }
                    );
                } catch (e) {
                    console.error('[PhoneMonitor] InactiveRdp error:', e.message);
                }
            }
        }

        // Clean any active RDPs from InactiveRdp collection
        if (activeRdpIds.size > 0) {
            try {
                await InactiveRdp.deleteMany({ rdp_id: { $in: Array.from(activeRdpIds) } });
            } catch (e) {
                console.error('[PhoneMonitor] Active RDP cleanup error:', e.message);
            }
        }

        // Handle any orphan records without rdp_id (strictly 60 minutes)
        for (const n of noRdpRecords) {
            const diff = now - (n.updatedAt ? new Date(n.updatedAt).getTime() : 0);
            if (diff > window60m) {
                n.is_active = n.limit <= 0 ? "completed" : "inactive";
                if (n.limit <= 0) {
                    n.rdp_id = null;
                    n.bro_id = null;
                }
                await n.save();
                totalResetNumbers++;
            }
        }

        console.log(
            `[PhoneMonitor] Scan done — ${totalResetNumbers} numbers reset, ${totalInactiveRdps} RDPs inactive, ${rdpMap.size} RDPs checked`
        );

    } catch (err) {
        console.error("[PhoneMonitor] Scan error:", err.message);
    }
};

const startPhoneNumberMonitor = (scanMinutes = 2) => {
    const intervalMs = scanMinutes * 60 * 1000;

    console.log(`[PhoneMonitor] scanning every ${scanMinutes} min (Strict 60m RDP Inactivity Rule)`);

    // Run immediately
    runScan();

    const timer = setInterval(runScan, intervalMs);

    if (timer.unref) timer.unref();

    return {
        stop: () => clearInterval(timer),
        runNow: runScan
    };
};

module.exports = { startPhoneNumberMonitor };