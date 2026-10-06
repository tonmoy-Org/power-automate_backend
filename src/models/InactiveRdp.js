const mongoose = require('mongoose');

const inactiveRdpSchema = new mongoose.Schema(
    {
        rdp_id: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true
        },
        pool: {
            type: String,
            enum: ['indian', 'global', 'mixed'],
            default: 'mixed'
        },
        lastSeen: {
            type: Date
        },
        inactivatedAt: {
            type: Date,
            default: Date.now
        },
        reason: {
            type: String,
            default: '30m Inactivity Timeout'
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('InactiveRdp', inactiveRdpSchema);
