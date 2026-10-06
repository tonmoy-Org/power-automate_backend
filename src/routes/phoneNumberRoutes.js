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
    bulkUpdatePhoneNumberStatus,
    bulkUpdatePhoneNumbers,
    getDashboardStats,
    getRunningRdpsList,
    getInactiveRdpsList,
    clearInactiveRdps,
    deleteInactiveRdpById,
    resetRdpNumbers,
    getPhoneNumberGroups,
    syncCountryFormatters
} = require('../controllers/phoneNumberController');

const { protect } = require('../middleware/authMiddleware');

router.get('/dashboard/stats', protect, getDashboardStats);
router.get('/dashboard/running-rdps', protect, getRunningRdpsList);
router.get('/dashboard/inactive-rdps', protect, getInactiveRdpsList);
router.delete('/dashboard/inactive-rdps', protect, clearInactiveRdps);
router.delete('/dashboard/inactive-rdps/:rdp_id', protect, deleteInactiveRdpById);
router.get('/groups', protect, getPhoneNumberGroups);
router.get('/inactive/random', protect, getRandomInactivePhoneNumber);
router.post('/reset-rdp', protect, resetRdpNumbers);
router.post('/sync-formatters', protect, syncCountryFormatters);

router.post('/bulk', protect, bulkCreatePhoneNumbers);
router.delete('/bulk', protect, bulkDeletePhoneNumbers);
router.patch('/bulk/status', protect, bulkUpdatePhoneNumberStatus);
router.patch('/bulk', protect, bulkUpdatePhoneNumbers);

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