const mongoose = require('mongoose');

const passwordFormatterSchema = new mongoose.Schema({
    start_add: {
        type: String,
        required: true,
        trim: true
    },
    start_index: {
        type: Number,
        required: true,
        min: 0
    },
    end_index: {
        type: Number,
        required: true,
        min: 0
    },
    end_add: {
        type: String,
        required: true,
        trim: true
    }
}, {
    timestamps: true
});

const phoneNumberSchema = new mongoose.Schema({
    pa_id: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    country_code: {
        type: String,
        required: true,
        trim: true
    },
    number: {
        type: String,
        required: true,
        trim: true
    },
    is_active: {
        type: Boolean,
        default: false
    },
    browser_reset_time: {
        type: Number,
        required: true,
        min: 1,
        default: 10
    },
    password_formatters: [passwordFormatterSchema]
}, {
    timestamps: true
});

// Index for search functionality
phoneNumberSchema.index({ pa_id: 'text', number: 'text', country_code: 'text' });

// Virtual for full phone number
phoneNumberSchema.virtual('full_number').get(function() {
    return `${this.country_code}${this.number}`;
});

// Static method to generate next PA ID
phoneNumberSchema.statics.generateNextPaId = async function() {
    const lastPhoneNumber = await this.findOne().sort({ pa_id: -1 });
    
    if (!lastPhoneNumber) {
        return 'PA_101';
    }
    
    const lastId = parseInt(lastPhoneNumber.pa_id.replace('PA_', ''));
    return `PA_${lastId + 1}`;
};

const PhoneNumber = mongoose.model('PhoneNumber', phoneNumberSchema);

module.exports = PhoneNumber;