const express = require('express');
const router = express.Router();
const { getMachines, updateStatus, deleteMachine } = require('../controllers/machineController');
const { protect } = require('../middleware/authMiddleware'); // Assuming this exists based on authRoutes

// Public endpoint for the .exe to send heartbeats (or protected with a secret key)
router.post('/status', updateStatus);

// Protected routes for the dashboard
router.get('/', protect, getMachines);
router.delete('/:id', protect, deleteMachine);

module.exports = router;
