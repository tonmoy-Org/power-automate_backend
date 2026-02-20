const mongoose = require('mongoose');

const passwordFormatterSchema = new mongoose.Schema({
    start_add: {
        type: String,
        required: true,
        trim: true
    },
    start_index: {
        type: Number,
        required: true,
        min: 0
    },
    end_index: {
        type: Number,
        required: true,
        min: 0
    },
    end_add: {
        type: String,
        required: true,
        trim: true
    }
}, {
    timestamps: true
});

const PasswordFormatter = mongoose.model('PasswordFormatter', passwordFormatterSchema);

module.exports = PasswordFormatter;