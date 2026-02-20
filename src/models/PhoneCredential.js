const mongoose = require('mongoose');

const phoneCredentialSchema = new mongoose.Schema({
    pa_id: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        required: false,
    },
    password: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('PhoneCredential', phoneCredentialSchema);