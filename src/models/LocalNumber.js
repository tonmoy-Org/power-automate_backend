const mongoose = require('mongoose');

const localNumberSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true,
        index: true
    },
    password: {
        type: String,
        default: ""
    },
    status: {
        type: String,
        default: "UNKNOWN",
        index: true
    },
    state_operator: {
        type: String,
        default: ""
    },
    operator: {
        type: String,
        default: ""
    },
    circle: {
        type: String,
        default: ""
    },
    source: {
        type: String,
        default: "SCRIPT_HIT"
    },
    rdp_id: {
        type: String,
        default: null
    },
    bro_id: {
        type: Number,
        default: null
    }
}, {
    timestamps: true
});

// Preserves all sequential hits without unique constraint (duplicates allowed as requested)
localNumberSchema.index({ createdAt: -1 });
localNumberSchema.index({ operator: 1 });
localNumberSchema.index({ circle: 1 });

module.exports = mongoose.model('LocalNumber', localNumberSchema);
