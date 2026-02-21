const express = require('express');
const router = express.Router();
const controller = require('../controllers/PhoneCredentialController');
const { protect } = require('../middleware/authMiddleware');

// Routes
router.route('/')
    .get(protect, controller.getCredentials)
    .post(protect, controller.createCredential);

router.route('/:id')
    .get(protect, controller.getCredentialById)
    .put(protect, controller.updateCredential)
    .patch(protect, controller.updateCredential)
    .delete(protect, controller.deleteCredential);

module.exports = router;