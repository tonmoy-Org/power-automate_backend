const Machine = require('../models/Machine');

const protectAgent = async (req, res, next) => {
  try {
    const machineId = req.body.machineId || req.headers['x-machine-id'];
    const agentToken = req.headers['x-agent-token'];

    if (!machineId || !agentToken) {
      return res.status(401).json({
        success: false,
        message: 'machineId and X-Agent-Token are required',
      });
    }

    const machine = await Machine.findOne({ machineId }).select('+agentToken');
    if (!machine || !machine.agentToken || machine.agentToken !== agentToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid agent credentials',
      });
    }

    req.machine = machine;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Agent auth failed',
      error: error.message,
    });
  }
};

module.exports = { protectAgent };
