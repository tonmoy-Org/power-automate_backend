const mongoose = require('mongoose');

const recheckerCredentialSchema = new mongoose.Schema({
    country_code: {
        type: String,
        default: '91',
    },
    phone: {
        type: String,
        required: true,
        index: true,
    },
    password: {
        type: String,
        required: true,
    },
    old_status: {
        type: String,
        default: 'UNKNOWN',
    },
    status: {
        type: String,
        enum: ['pending', 'running', 'valid', 'invalid', 'dead'],
        default: 'pending',
        index: true,
    },
    type: {
        type: String,
        default: null,
    },
    operator: {
        type: String,
        default: null,
        index: true,
    },
    circle: {
        type: String,
        default: null,
        index: true,
    },
    rdp_id: {
        type: String,
        default: null,
    },
    bro_id: {
        type: Number,
        default: null,
    },
    last_checked: {
        type: Date,
        default: null,
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('RecheckerCredential', recheckerCredentialSchema);
