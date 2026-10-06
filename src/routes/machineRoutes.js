const express = require('express');
const router = express.Router();
const { 
  getMachines, 
  updateStatus, 
  updateTaskProgress, 
  deleteMachine, 
  updateMode, 
  getMachineByMachineId,
  registerMachine,
  updateMachineDetails,
  bulkDeleteOffline,
  bulkImportMachines,
  checkRdp,
  updateMachineConfig,
  sendMachineCommand,
  regenerateMachineToken,
  bulkSendMachineCommand,
  getMachinesForSheets,
  importMachinesFromSheets
} = require('../controllers/machineController');
const { protect } = require('../middleware/authMiddleware');

// Sheets endpoints (authenticated via apiKey query parameter)
router.get('/sheets-list', getMachinesForSheets);
router.post('/sheets-import', importMachinesFromSheets);

// Public endpoints for the .exe to send heartbeats
router.post('/status', updateStatus);
router.post('/task-progress', updateTaskProgress);
router.get('/status/:machineId', getMachineByMachineId);
router.get('/:machineId', getMachineByMachineId);

// Protected routes for the dashboard
router.get('/', protect, getMachines);
router.post('/register', protect, registerMachine);
router.post('/bulk-import', protect, bulkImportMachines);
router.post('/bulk-command', protect, bulkSendMachineCommand);
router.delete('/bulk-delete-offline', protect, bulkDeleteOffline);
router.post('/:id/check-rdp', protect, checkRdp);
router.put('/:id/rdp-details', protect, updateMachineDetails);
router.put('/:id/config', protect, updateMachineConfig);
router.post('/:id/command', protect, sendMachineCommand);
router.post('/:id/regenerate-token', protect, regenerateMachineToken);
router.delete('/:id', protect, deleteMachine);
router.put('/:id/mode', protect, updateMode);

module.exports = router;
