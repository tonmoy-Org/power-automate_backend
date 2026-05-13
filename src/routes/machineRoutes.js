const express = require('express');
const router = express.Router();
const { getMachines, updateStatus, updateTaskProgress, deleteMachine, updateMode, getMachineByMachineId } = require('../controllers/machineController');
const { protect } = require('../middleware/authMiddleware'); // Assuming this exists based on authRoutes

// Public endpoints for the .exe to send heartbeats
router.post('/status', updateStatus);
router.post('/task-progress', updateTaskProgress);
router.get('/status/:machineId', getMachineByMachineId);

// Protected routes for the dashboard
router.get('/', protect, getMachines);
router.delete('/:id', protect, deleteMachine);
router.put('/:id/mode', protect, updateMode);

module.exports = router;
