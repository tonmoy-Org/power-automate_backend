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
        trim: true
    }
}, {
    timestamps: true
});

passwordFormatterSchema.index({ start_add: 'text', end_add: 'text' });

passwordFormatterSchema.virtual('description').get(function () {
    return `${this.start_add} (${this.start_index}) → ${this.end_add} (${this.end_index})`;
});

// Check if this formatter is referenced by any PhoneNumber
passwordFormatterSchema.statics.isInUse = async function (formatterId) {
    const PhoneNumber = mongoose.model('PhoneNumber');
    const count = await PhoneNumber.countDocuments({
        password_formatters: formatterId
    });
    return count > 0;
};

// When a formatter is deleted, remove its ID from all phone numbers automatically
passwordFormatterSchema.pre('deleteOne', { document: true, query: false }, async function () {
    const PhoneNumber = mongoose.model('PhoneNumber');
    await PhoneNumber.updateMany(
        { password_formatters: this._id },
        { $pull: { password_formatters: this._id } }
    );
});

const PasswordFormatter = mongoose.model('PasswordFormatter', passwordFormatterSchema);

module.exports = PasswordFormatter;