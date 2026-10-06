const express = require('express');
const router = express.Router();

const {
    getIndianNumbers,
    getIndianNumberGroups,
    getIndianNumberById,
    createIndianNumber,
    updateIndianNumber,
    patchIndianNumber,
    deleteIndianNumber,
    getRandomInactiveIndianNumber,
    bulkCreateIndianNumbers,
    bulkDeleteIndianNumbers,
    bulkUpdateIndianNumberStatus,
    bulkUpdateIndianNumbers,
    resetRdpIndianNumbers,
    markIndianNumberDead
} = require('../controllers/indianNumberController');

const { protect } = require('../middleware/authMiddleware');

router.get('/groups', protect, getIndianNumberGroups);
router.get('/inactive/random', protect, getRandomInactiveIndianNumber);
router.post('/reset-rdp', protect, resetRdpIndianNumbers);
router.post('/mark-dead', protect, markIndianNumberDead);
router.post('/:id/dead', protect, markIndianNumberDead);

router.post('/bulk', protect, bulkCreateIndianNumbers);
router.delete('/bulk', protect, bulkDeleteIndianNumbers);
router.patch('/bulk/status', protect, bulkUpdateIndianNumberStatus);
router.patch('/bulk', protect, bulkUpdateIndianNumbers);

router
    .route('/')
    .get(protect, getIndianNumbers)
    .post(protect, createIndianNumber);

router
    .route('/:id')
    .get(protect, getIndianNumberById)
    .put(protect, updateIndianNumber)
    .patch(protect, patchIndianNumber)
    .delete(protect, deleteIndianNumber);

module.exports = router;