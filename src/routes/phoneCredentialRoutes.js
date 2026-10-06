const express = require('express');
const router = express.Router();
const controller = require('../controllers/phoneCredentialController');
const { protect } = require('../middleware/authMiddleware');

router.delete('/bulk', protect, controller.bulkDeleteCredentials);
router.delete('/by-type', protect, controller.deleteCredentialsByTypeAndCountry);
router.get('/download', protect, controller.downloadCredentials);

router.route('/')
    .get(protect, controller.getCredentials)
    .post(protect, controller.createCredential);

router.route('/:id')
    .get(protect, controller.getCredentialById)
    .put(protect, controller.updateCredential)
    .patch(protect, controller.updateCredential)
    .delete(protect, controller.deleteCredential);

module.exports = router;