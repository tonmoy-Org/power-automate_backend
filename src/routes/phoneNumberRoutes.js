const express = require('express');
const router = express.Router();

const {
    getPhoneNumbers,
    getPhoneNumberById,
    createPhoneNumber,
    updatePhoneNumber,
    patchPhoneNumber,
    deletePhoneNumber,
    getRandomInactivePhoneNumber,
    bulkCreatePhoneNumbers,
    bulkDeletePhoneNumbers,
    bulkUpdatePhoneNumberStatus
} = require('../controllers/phoneNumberController');

const { protect } = require('../middleware/authMiddleware');

router.get('/inactive/random', getRandomInactivePhoneNumber);

router.post('/bulk', protect, bulkCreatePhoneNumbers);
router.delete('/bulk', protect, bulkDeletePhoneNumbers);
router.patch('/bulk/status', protect, bulkUpdatePhoneNumberStatus);

router
    .route('/')
    .get(protect, getPhoneNumbers)
    .post(protect, createPhoneNumber);

router
    .route('/:id')
    .get(protect, getPhoneNumberById)
    .put(protect, updatePhoneNumber)
    .patch(protect, patchPhoneNumber)
    .delete(protect, deletePhoneNumber);

module.exports = router;