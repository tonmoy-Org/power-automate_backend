const mongoose = require('mongoose');

const phoneCredentialSchema = new mongoose.Schema({
    country_code: {
        type: String,
        required: true,
    },

    phone: {
        type: String,
        required: true,
    },
    type: {
        type: String,
    },

    password: {
        type: String,
    },

    operator: {
        type: String
    },

    circle: {
        type: String
    }

}, {
    timestamps: true
});


// Prevent duplicate phone
phoneCredentialSchema.index(
    { country_code: 1, phone: 1 },
    { unique: true }
);

phoneCredentialSchema.index({ country_code: 1 });
phoneCredentialSchema.index({ type: 1 });
phoneCredentialSchema.index({ country_code: 1, type: 1 });


module.exports = mongoose.model(
    'PhoneCredential',
    phoneCredentialSchema
);