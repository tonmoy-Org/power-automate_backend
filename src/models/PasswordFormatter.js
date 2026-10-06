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
    },
    country_code: {
        type: String,
        required: false,
        trim: true
    },
    circle: {
        type: String,
        required: false,
        trim: true
    },
    operator: {
        type: String,
        required: false,
        trim: true
    },
    group: {
        type: String,
        required: false,
        trim: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, {
    timestamps: true
});

passwordFormatterSchema.index({ userId: 1 });
passwordFormatterSchema.index({ country_code: 1 });
passwordFormatterSchema.index({ country_code: 1, circle: 1, operator: 1 });
passwordFormatterSchema.index({ group: 1 });
passwordFormatterSchema.index({ start_add: 'text', end_add: 'text' });

passwordFormatterSchema.virtual('description').get(function () {
    return `${this.start_add} (${this.start_index}) → ${this.end_add} (${this.end_index})`;
});

// Check if this formatter is referenced by any PhoneNumber or IndianNumber
passwordFormatterSchema.statics.isInUse = async function (formatterId) {
    const PhoneNumber = mongoose.model('PhoneNumber');
    const IndianNumber = mongoose.model('IndianNumber');
    const [phoneCount, indianCount] = await Promise.all([
        PhoneNumber.countDocuments({ password_formatters: formatterId }),
        IndianNumber.countDocuments({ password_formatters: formatterId })
    ]);
    return phoneCount > 0 || indianCount > 0;
};

// When a formatter is deleted, remove its ID from all phone numbers automatically
passwordFormatterSchema.pre('deleteOne', { document: true, query: false }, async function () {
    const PhoneNumber = mongoose.model('PhoneNumber');
    const IndianNumber = mongoose.model('IndianNumber');
    await Promise.all([
        PhoneNumber.updateMany(
            { password_formatters: this._id },
            { $pull: { password_formatters: this._id } }
        ),
        IndianNumber.updateMany(
            { password_formatters: this._id },
            { $pull: { password_formatters: this._id } }
        )
    ]);
});

const PasswordFormatter = mongoose.model('PasswordFormatter', passwordFormatterSchema);

module.exports = PasswordFormatter;