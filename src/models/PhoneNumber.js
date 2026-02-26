const mongoose = require('mongoose');

const phoneNumberSchema = new mongoose.Schema(
    {
        country_code: {
            type: String,
            required: true,
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
        ]
    },
    {
        timestamps: true
    }
);

phoneNumberSchema.index({
    number: 'text',
    country_code: 'text'
});

phoneNumberSchema.virtual('full_number').get(function () {
    return `${this.country_code}${this.number}`;
});

const PhoneNumber = mongoose.model('PhoneNumber', phoneNumberSchema);

module.exports = PhoneNumber;