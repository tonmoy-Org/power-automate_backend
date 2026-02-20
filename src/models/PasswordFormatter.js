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

// Index for search functionality
passwordFormatterSchema.index({ start_add: 'text', end_add: 'text' });

// Virtual for formatter description
passwordFormatterSchema.virtual('description').get(function() {
    return `${this.start_add} (${this.start_index}) → ${this.end_add} (${this.end_index})`;
});

// Static method to check if formatter is in use
passwordFormatterSchema.statics.isInUse = async function(formatterId) {
    const PhoneNumber = mongoose.model('PhoneNumber');
    const count = await PhoneNumber.countDocuments({
        'password_formatters.id': formatterId.toString()
    });
    return count > 0;
};

const PasswordFormatter = mongoose.model('PasswordFormatter', passwordFormatterSchema);

module.exports = PasswordFormatter;