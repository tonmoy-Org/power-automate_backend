const mongoose = require('mongoose');

const indianPhoneCredentialSchema = new mongoose.Schema({
    country_code: {
        type: String,
        default: "91",
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
indianPhoneCredentialSchema.index(
    { phone: 1 },
    { unique: true }
);

indianPhoneCredentialSchema.index({ type: 1 });
indianPhoneCredentialSchema.index({ createdAt: -1 });


module.exports = mongoose.model(
    'IndianPhoneCredential',
    indianPhoneCredentialSchema
);
