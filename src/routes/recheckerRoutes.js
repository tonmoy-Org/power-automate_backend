const express = require('express');
const router = express.Router();
const recheckerController = require('../controllers/recheckerController');

// RDP Bot Endpoints
router.get('/inactive/random', recheckerController.getInactiveRandom);
router.post('/update-valid', recheckerController.updateValid);

// Dashboard Endpoints
router.post('/bulk-upload', recheckerController.bulkUpload);
router.get('/valid-list', recheckerController.getValidList);
router.get('/export-valid', recheckerController.exportValid);
router.delete('/clear-valid', recheckerController.clearValid);
router.get('/stats', recheckerController.getStats);

module.exports = router;
