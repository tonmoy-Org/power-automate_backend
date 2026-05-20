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
            enum: ['completed', 'inactive', 'running'],
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
        limit: {
            type: Number,
            default: 0,
        }
    },
    {
        timestamps: true
    }
);

indianNumberSchema.index({ country_code: 1, is_active: 1 });
indianNumberSchema.index({
    number: 'text',
    operator: 'text',
    country_code: 'text'
});

indianNumberSchema.virtual('full_number').get(function () {
    return `${this.country_code}${this.number}`;
});

const IndianNumber = mongoose.model('IndianNumber', indianNumberSchema);

module.exports = IndianNumber;