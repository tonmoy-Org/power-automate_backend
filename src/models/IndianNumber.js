const mongoose = require('mongoose');

const indianNumberSchema = new mongoose.Schema(
    {
        operator: {
            type: String,
            required: true,
            trim: true
        },
        country_code: {
            type: String,
            required: true,
            trim: true
        },
        circle: {
            type: String,
            trim: true
        },
        number: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        is_active: {
            type: String,
            enum: ['completed', 'inactive', 'running', 'dead'],
            default: 'inactive'
        },
        password_formatters: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'PasswordFormatter'
            }
        ],
        rdp_id: {
            type: String,
            default: null
        },
        bro_id: {
            type: Number,
            default: null
        },
        limit: {
            type: Number,
            default: 0,
        },
        consecutive_zero_checks: {
            type: Number,
            default: 0
        },
        last_scanned_number: {
            type: String,
            default: null
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        }
    },
    {
        timestamps: true
    }
);

indianNumberSchema.index({ userId: 1 });
indianNumberSchema.index({ country_code: 1, is_active: 1 });
indianNumberSchema.index({ createdAt: 1 });
indianNumberSchema.index({ rdp_id: 1, is_active: 1 });
indianNumberSchema.index({ is_active: 1, createdAt: 1 });
indianNumberSchema.index({ operator: 1, circle: 1, is_active: 1 });
indianNumberSchema.index({
    number: 'text',
    operator: 'text',
    country_code: 'text'
});

indianNumberSchema.virtual('full_number').get(function () {
    return `${this.country_code}${this.number}`;
});

const cache = require('../utils/cache');
const clearCache = () => {
    cache.clearIndianNumbersCache();
};

indianNumberSchema.post('save', clearCache);
indianNumberSchema.post('remove', clearCache);
indianNumberSchema.post('updateOne', clearCache);
indianNumberSchema.post('updateMany', clearCache);
indianNumberSchema.post('deleteOne', clearCache);
indianNumberSchema.post('deleteMany', clearCache);
indianNumberSchema.post('insertMany', clearCache);
indianNumberSchema.post('findOneAndUpdate', clearCache);
indianNumberSchema.post('findOneAndDelete', clearCache);

const IndianNumber = mongoose.model('IndianNumber', indianNumberSchema);

module.exports = IndianNumber;