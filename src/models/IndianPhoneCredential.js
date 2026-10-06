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

    // Live Network & Proxy Intelligence Fields
    live_isp: {
        type: String,
        default: null
    },

    live_asn: {
        type: String,
        default: null
    },

    live_ip: {
        type: String,
        default: null
    },

    live_city: {
        type: String,
        default: null
    },

    live_region: {
        type: String,
        default: null
    },

    network_match_type: {
        type: String,
        enum: ['DIRECT_SIM_MATCH', 'PORTED_OR_DUAL_SIM', 'WIFI_BROADBAND', 'UNVERIFIED'],
        default: 'UNVERIFIED'
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
indianPhoneCredentialSchema.index(
    { phone: 1 },
    { unique: true }
);

indianPhoneCredentialSchema.index({ userId: 1 });
indianPhoneCredentialSchema.index({ type: 1 });
indianPhoneCredentialSchema.index({ createdAt: -1 });
indianPhoneCredentialSchema.index({ operator: 1 });
indianPhoneCredentialSchema.index({ circle: 1 });
indianPhoneCredentialSchema.index({ live_asn: 1 });
indianPhoneCredentialSchema.index({ live_isp: 1 });
indianPhoneCredentialSchema.index({ network_match_type: 1 });
indianPhoneCredentialSchema.index({ verified_operator: 1 });

const cache = require('../utils/cache');
const clearCache = () => {
    cache.clearIndianPhoneCredentialsCache();
};

indianPhoneCredentialSchema.post('save', clearCache);
indianPhoneCredentialSchema.post('remove', clearCache);
indianPhoneCredentialSchema.post('updateOne', clearCache);
indianPhoneCredentialSchema.post('updateMany', clearCache);
indianPhoneCredentialSchema.post('deleteOne', clearCache);
indianPhoneCredentialSchema.post('deleteMany', clearCache);
indianPhoneCredentialSchema.post('insertMany', clearCache);
indianPhoneCredentialSchema.post('findOneAndUpdate', clearCache);
indianPhoneCredentialSchema.post('findOneAndDelete', clearCache);

module.exports = mongoose.model(
    'IndianPhoneCredential',
    indianPhoneCredentialSchema
);

