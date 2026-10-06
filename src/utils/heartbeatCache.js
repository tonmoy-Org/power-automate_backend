const cache = new Map();

module.exports = {
    /**
     * Touch/update the in-memory timestamp for a machine.
     * @param {String} machineId 
     */
    touch: (machineId) => {
        if (!machineId) return;
        cache.set(machineId.toString().trim().toLowerCase(), Date.now());
    },

    /**
     * Get the last seen Date for a machine if cached.
     * @param {String} machineId 
     * @returns {Date|null}
     */
    getLastSeen: (machineId) => {
        if (!machineId) return null;
        const time = cache.get(machineId.toString().trim().toLowerCase());
        return time ? new Date(time) : null;
    }
};
