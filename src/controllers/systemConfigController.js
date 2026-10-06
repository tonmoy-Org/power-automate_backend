const fs = require('fs');
const path = require('path');
const operatorResolver = require('../utils/operatorResolver');
const IndianNumber = require('../models/IndianNumber');
const PhoneNumber = require('../models/PhoneNumber');

// Get all loaded prefix mappings
const getPrefixMappings = async (req, res) => {
  try {
    const currentMapping = operatorResolver.loadMapping();
    res.json({
      success: true,
      count: Object.keys(currentMapping).length,
      data: currentMapping
    });
  } catch (error) {
    res.status(200).json({ success: false, message: error.message });
  }
};

// Upload or edit prefix mappings (updates check sorce.txt)
const uploadPrefixMappings = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ success: false, message: 'Content string is required' });
    }

    // Write content back to source file
    fs.writeFileSync(operatorResolver.sourceFilePath, content, 'utf8');

    // Reload mapping in-memory
    const newMapping = operatorResolver.reloadMapping();

    res.json({
      success: true,
      message: 'Prefix mappings updated and reloaded successfully',
      count: Object.keys(newMapping).length
    });
  } catch (error) {
    res.status(200).json({ success: false, message: error.message });
  }
};

// Reset all stuck "running" numbers (both Indian and global) to "inactive"
const resetAllRunningNumbers = async (req, res) => {
  try {
    const [indianRes, globalRes] = await Promise.all([
      IndianNumber.updateMany({ is_active: 'running' }, { $set: { is_active: 'inactive' } }),
      PhoneNumber.updateMany({ is_active: 'running' }, { $set: { is_active: 'inactive' } })
    ]);

    res.json({
      success: true,
      message: 'Successfully reset all stuck running numbers to inactive status',
      indianModifiedCount: indianRes.modifiedCount,
      globalModifiedCount: globalRes.modifiedCount
    });
  } catch (error) {
    res.status(200).json({ success: false, message: error.message });
  }
};

module.exports = {
  getPrefixMappings,
  uploadPrefixMappings,
  resetAllRunningNumbers
};
