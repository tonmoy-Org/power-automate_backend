const express = require('express');
const router = express.Router();
const controller = require('../controllers/PhoneCredentialController');
const { protect } = require('../middleware/authMiddleware');

// Routes
router.route('/')
    .post(protect, controller.createCredential)
    .get(protect, controller.getCredentials);

router.route('/:id')
    .get(protect, controller.getCredentialById)
    .put(protect, controller.updateCredential)
    .patch(protect, controller.updateCredential)
    .delete(protect, controller.deleteCredential);

module.exports = router;