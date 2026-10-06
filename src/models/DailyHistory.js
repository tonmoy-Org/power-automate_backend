const mongoose = require('mongoose');

const dailyHistorySchema = new mongoose.Schema({
    date: {
        type: String, // format: "M/D/YYYY" in Dhaka time
        required: true,
        unique: true
    },
    generalCount: {
        type: Number,
        default: 0
    },
    indianCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model(
    'DailyHistory',
    dailyHistorySchema
);
