const express = require('express');
const router = express.Router();
const controller = require('../controllers/DailyHistoryController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, controller.getHistory);

router.post('/cleanup', protect, controller.triggerCleanup);

module.exports = router;
