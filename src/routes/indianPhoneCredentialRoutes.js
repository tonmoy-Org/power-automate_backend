const express = require('express');
const router = express.Router();
const controller = require('../controllers/IndianPhoneCredentialController');
const { protect } = require('../middleware/authMiddleware');

router.delete('/bulk', protect, controller.bulkDeleteCredentials);
router.delete('/by-type', protect, controller.deleteCredentialsByType);

router.route('/')
    .get(controller.getCredentials)
    .post(protect, controller.createCredential);

router.route('/:id')
    .get(protect, controller.getCredentialById)
    .put(protect, controller.updateCredential)
    .patch(protect, controller.updateCredential)
    .delete(protect, controller.deleteCredential);

module.exports = router;
