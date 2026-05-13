const mongoose = require('mongoose');

const machineSchema = new mongoose.Schema({
  machineId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'busy'],
    default: 'offline',
  },
  lastSeen: {
    type: Date,
    default: Date.now,
  },
  tasks: {
    type: [mongoose.Schema.Types.Mixed], // Array of objects like { progress: 0, left: 0 }
    default: Array(10).fill({ progress: 0, left: 0 }),
  },
  mode: {
    type: String,
    default: 'Normal',
  },
  autoAdd: {
    type: Boolean,
    default: false,
  }
}, {
  timestamps: true,
});

// Middleware to automatically mark as offline if not seen for 2 minutes
// Note: This logic is usually better handled in the query or a cron job, 
// but we'll implement a helper method.
machineSchema.methods.isOnline = function() {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  return this.lastSeen > twoMinutesAgo;
};

const Machine = mongoose.model('Machine', machineSchema);

module.exports = Machine;
