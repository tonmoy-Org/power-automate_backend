const mongoose = require('mongoose');

const passwordFormatterSchema = new mongoose.Schema({
    start_add: {
        type: String,
        required: false,
    },
    start_index: {
        type: Number,
        required: false,
    },
    end_index: {
        type: Number,
        required: false,
    },
    end_add: {
        type: String,
        required: false,
    }
}, {
    timestamps: true
});

passwordFormatterSchema.index({ start_add: 'text', end_add: 'text' });

passwordFormatterSchema.virtual('description').get(function() {
    return `${this.start_add} (${this.start_index}) → ${this.end_add} (${this.end_index})`;
});

passwordFormatterSchema.statics.isInUse = async function(formatterId) {
    const PhoneNumber = mongoose.model('PhoneNumber');
    const count = await PhoneNumber.countDocuments({
        'password_formatters.id': formatterId.toString()
    });
    return count > 0;
};

const PasswordFormatter = mongoose.model('PasswordFormatter', passwordFormatterSchema);

module.exports = PasswordFormatter;