const Machine = require('../models/Machine');

// Update or create machine status (Heartbeat)
exports.updateStatus = async (req, res) => {
  try {
    const { machineId, name, status, tasks, mode, autoAdd } = req.body;

    const machine = await Machine.findOneAndUpdate(
      { machineId },
      {
        name,
        status,
        tasks,
        mode,
        autoAdd,
        lastSeen: new Date(),
      },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      data: machine,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

// Get all machines
exports.getMachines = async (req, res) => {
  try {
    const machines = await Machine.find().sort({ name: 1 });
    
    // Automatically determine online/offline based on lastSeen
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    
    const formattedMachines = machines.map(m => {
      const machineObj = m.toObject();
      if (machineObj.lastSeen < twoMinutesAgo) {
        machineObj.status = 'offline';
      }
      return machineObj;
    });

    res.status(200).json({
      success: true,
      count: formattedMachines.length,
      data: formattedMachines,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
    });
  }
};

// Delete machine
exports.deleteMachine = async (req, res) => {
  try {
    const machine = await Machine.findByIdAndDelete(req.params.id);
    if (!machine) {
      return res.status(404).json({ success: false, message: 'Machine not found' });
    }
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
