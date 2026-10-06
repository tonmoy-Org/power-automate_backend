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
    },

    verification_source: {
        type: String,
        default: null
    },

    operator_checked: {
        type: String,
        default: null
    },

    verified_operator: {
        type: String,
        default: null
    },

    confidence: {
        type: Number,
        default: null
    },

    verified_time: {
        type: Date,
        default: null
    },

    verification_url: {
        type: String,
        default: null
    },

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }

}, {
    timestamps: true
});


// Prevent duplicate phone
phoneCredentialSchema.index(
    { country_code: 1, phone: 1 },
    { unique: true }
);

phoneCredentialSchema.index({ userId: 1 });
phoneCredentialSchema.index({ country_code: 1 });
phoneCredentialSchema.index({ type: 1 });
phoneCredentialSchema.index({ country_code: 1, type: 1 });
phoneCredentialSchema.index({ createdAt: -1 });
phoneCredentialSchema.index({ country_code: 1, createdAt: -1 });
phoneCredentialSchema.index({ operator: 1 });
phoneCredentialSchema.index({ circle: 1 });

const cache = require('../utils/cache');
const clearCache = () => {
    cache.clearPhoneCredentialsCache();
};

phoneCredentialSchema.post('save', clearCache);
phoneCredentialSchema.post('remove', clearCache);
phoneCredentialSchema.post('updateOne', clearCache);
phoneCredentialSchema.post('updateMany', clearCache);
phoneCredentialSchema.post('deleteOne', clearCache);
phoneCredentialSchema.post('deleteMany', clearCache);
phoneCredentialSchema.post('insertMany', clearCache);
phoneCredentialSchema.post('findOneAndUpdate', clearCache);
phoneCredentialSchema.post('findOneAndDelete', clearCache);

module.exports = mongoose.model(
    'PhoneCredential',
    phoneCredentialSchema
);