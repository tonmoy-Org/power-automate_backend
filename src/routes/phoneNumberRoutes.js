const express = require('express');
const router = express.Router();
const {
    getPhoneNumbers,
    getPhoneNumberByPaId,
    createPhoneNumber,
    updatePhoneNumber,
    deletePhoneNumber,
    getRandomInactivePhoneNumber,
    getRandomInactivePhoneNumberByPaId
} = require('../controllers/phoneNumberController');
const { protect } = require('../middleware/authMiddleware');

router.get('/inactive/random', protect, getRandomInactivePhoneNumber);
router.get('/random-phone/:pa_id', protect, getRandomInactivePhoneNumberByPaId);
router.get('/phone-by-pa/:pa_id', protect, getPhoneNumberByPaId);

router.route('/')
    .get(protect, getPhoneNumbers)
    .post(protect, createPhoneNumber);

router.route('/:id')
    .put(protect, updatePhoneNumber)
    .delete(protect, deletePhoneNumber);

module.exports = router;