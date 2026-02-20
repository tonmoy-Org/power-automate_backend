const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
  },
  browser: {
    type: String
  },
  browserVersion: {
    type: String
  },
  os: {
    type: String
  },
  osVersion: {
    type: String
  },
  deviceType: {
    type: String
  },
  deviceName: {
    type: String
  },
  ipAddress: {
    type: String
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
});

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      enum: ['superadmin', 'member', 'client'],
      default: 'client'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    department: {
      type: String,
      default: 'General'
    },
    devices: {
      type: [deviceSchema],
      default: []
    },
    resetPasswordToken: {
      type: String,
      select: false
    },
    resetPasswordExpire: {
      type: Date,
      select: false
    }
  },
  {
    timestamps: true
  }
);


module.exports = mongoose.model('User', userSchema);