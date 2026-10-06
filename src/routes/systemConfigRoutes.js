const express = require('express');
const router = express.Router();
const {
  getPrefixMappings,
  uploadPrefixMappings,
  resetAllRunningNumbers
} = require('../controllers/systemConfigController');
const { protect } = require('../middleware/authMiddleware');

router.get('/prefixes', protect, getPrefixMappings);
router.post('/prefixes/upload', protect, uploadPrefixMappings);
router.post('/reset-running', protect, resetAllRunningNumbers);

module.exports = router;
