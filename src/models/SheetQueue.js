const mongoose = require('mongoose');

const SheetQueueSchema = new mongoose.Schema({
  phone: { type: String, required: true },
  password: { type: String, required: true },
  type: { type: String, required: true },
  prefix: { type: String, default: '' },
  country_code: { type: String, default: '91' },
  targetSheet: { type: String, enum: ['indian', 'global'], default: 'indian' },
  operator: { type: String, default: 'Unknown' },
  circle: { type: String, default: 'Unknown' },
  tabName: { type: String, required: true },
  dateTime: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Add index on createdAt to sort efficiently
SheetQueueSchema.index({ createdAt: 1 });
SheetQueueSchema.index({ targetSheet: 1, createdAt: 1 });

module.exports = mongoose.model('SheetQueue', SheetQueueSchema);
