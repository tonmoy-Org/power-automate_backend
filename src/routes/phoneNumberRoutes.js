const express = require('express');
const router = express.Router();
const {
    getPhoneNumbers,
    getPhoneNumberById,
    createPhoneNumber,
    updatePhoneNumber,
    patchPhoneNumber,
    deletePhoneNumber,
    getRandomInactivePhoneNumber
} = require('../controllers/phoneNumberController');
const { protect } = require('../middleware/authMiddleware');

router.get('/inactive/random', protect, getRandomInactivePhoneNumber);

router.route('/')
    .get(protect, getPhoneNumbers)
    .post(protect, createPhoneNumber);

router.route('/:id')
    .get(protect, getPhoneNumberById)
    .put(protect, updatePhoneNumber)
    .patch(protect, patchPhoneNumber)  
    .delete(protect, deletePhoneNumber);

module.exports = router;