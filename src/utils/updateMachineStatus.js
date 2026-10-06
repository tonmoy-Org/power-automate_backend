const Machine = require('../models/Machine');

/**
 * Updates the lastSeen and status of a machine when it interacts with the numbers API.
 * This ensures the machine shows as 'Online' even if it doesn't hit the /status heartbeat directly.
 * @param {String} machineId 
 */
const touchMachine = async (machineId) => {
    if (!machineId || machineId === 'null' || machineId === 'undefined') return;
    require('./heartbeatCache').touch(machineId);
    try {
        const existingMachine = await Machine.findOne({ machineId }).lean();
        if (existingMachine) {
            const now = Date.now();
            const lastSeenTime = new Date(existingMachine.lastSeen || 0).getTime();
            if (now - lastSeenTime < 30 * 60 * 1000) {
                // Skip database write to throttle load
                return;
            }
        }
        await Machine.findOneAndUpdate(
            { machineId },
            {
                $setOnInsert: { name: machineId },
                $set: {
                    status: 'online',
                    lastSeen: new Date()
                }
            },
            { upsert: true, setDefaultsOnInsert: true }
        );
    } catch (error) {
        console.error('Error touching machine:', error.message);
    }
};

module.exports = { touchMachine };
