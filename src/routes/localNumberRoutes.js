const express = require('express');
const router = express.Router();
const controller = require('../controllers/LocalNumberController');
const { protect } = require('../middleware/authMiddleware');

router.post('/import', protect, controller.importLocalNumbers);
router.post('/', protect, controller.createLocalNumber);
router.get('/', protect, controller.getLocalNumbers);
router.get('/download', protect, controller.downloadLocalNumbers);
router.delete('/clear', protect, controller.clearLocalNumbers);

module.exports = router;
