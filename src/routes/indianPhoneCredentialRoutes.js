const express = require('express');
const router = express.Router();
const controller = require('../controllers/IndianPhoneCredentialController');
const { protect } = require('../middleware/authMiddleware');

router.delete('/bulk', protect, controller.bulkDeleteCredentials);
router.delete('/by-type', protect, controller.deleteCredentialsByType);
router.get('/download', protect, controller.downloadCredentials);
router.get('/history-3days', protect, controller.getHistory3Days);
router.get('/export-csv', protect, controller.exportCsvByDate);
router.get('/export-all', protect, controller.exportAllCredentialsCsv);

router.route('/')
    .get(protect, controller.getCredentials)
    .post(protect, controller.createCredential);

router.route('/:id')
    .get(protect, controller.getCredentialById)
    .put(protect, controller.updateCredential)
    .patch(protect, controller.updateCredential)
    .delete(protect, controller.deleteCredential);

module.exports = router;
