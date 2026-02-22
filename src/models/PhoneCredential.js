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


module.exports = mongoose.model(
    'PhoneCredential',
    phoneCredentialSchema
);