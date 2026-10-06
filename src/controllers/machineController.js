const Machine = require('../models/Machine');
const crypto = require('crypto');
const net = require('net');

// ─── 10K RDP Scale: In-Memory Write-Through Cache for Heartbeats & Task Progress ───
// Instead of individual findOneAndUpdate per heartbeat/task (333+ writes/sec at 10K RDPs),
// we cache updates in-memory and flush to DB in bulk every 5 seconds.
const _heartbeatCache = new Map();
const _taskProgressCache = new Map();
const _BATCH_FLUSH_MS = 5000; // 5 seconds

async function _flushHeartbeats() {
  if (_heartbeatCache.size === 0) return;
  const snapshot = new Map(_heartbeatCache);
  _heartbeatCache.clear();
  try {
    const bulkOps = [];
    for (const [machineId, data] of snapshot) {
      bulkOps.push({
        updateOne: {
          filter: { machineId },
          update: { $set: data },
          upsert: true
        }
      });
    }
    if (bulkOps.length > 0) {
      const result = await Machine.bulkWrite(bulkOps, { ordered: false });
      console.log(`[HeartbeatBatch] Flushed ${bulkOps.length} heartbeats (modified: ${result.modifiedCount}, upserted: ${result.upsertedCount})`);
    }
  } catch (err) {
    console.error('[HeartbeatBatch] Bulk flush error:', err.message);
    // Re-insert failed items back into cache for next flush
    for (const [machineId, data] of snapshot) {
      if (!_heartbeatCache.has(machineId)) {
        _heartbeatCache.set(machineId, data);
      }
    }
  }
}

async function _flushTaskProgress() {
  if (_taskProgressCache.size === 0) return;
  const snapshot = new Map(_taskProgressCache);
  _taskProgressCache.clear();
  try {
    // Group by machineId so we can merge multiple task updates into one bulk op
    const byMachine = {};
    for (const [, data] of snapshot) {
      if (!byMachine[data.machineId]) byMachine[data.machineId] = { lastSeen: new Date() };
      byMachine[data.machineId][`tasks.${data.taskIndex}`] = { progress: data.progress, left: data.left || 0 };
      if (data.status) byMachine[data.machineId].status = data.status;
      if (data.name) byMachine[data.machineId].name = data.name;
    }
    const bulkOps = Object.entries(byMachine).map(([machineId, fields]) => ({
      updateOne: {
        filter: { machineId },
        update: { $set: fields },
        upsert: true
      }
    }));
    if (bulkOps.length > 0) {
      await Machine.bulkWrite(bulkOps, { ordered: false });
    }
  } catch (err) {
    console.error('[TaskProgressBatch] Bulk flush error:', err.message);
    for (const [key, data] of snapshot) {
      if (!_taskProgressCache.has(key)) {
        _taskProgressCache.set(key, data);
      }
    }
  }
}

// Start batch flush timers (only on PM2 Instance 0 to avoid duplicate flushes)
if (!process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0') {
  const hbTimer = setInterval(_flushHeartbeats, _BATCH_FLUSH_MS);
  const tpTimer = setInterval(_flushTaskProgress, _BATCH_FLUSH_MS);
  if (hbTimer.unref) hbTimer.unref();
  if (tpTimer.unref) tpTimer.unref();
  console.log(`[ScaleBatch] Heartbeat & TaskProgress batch flush started (every ${_BATCH_FLUSH_MS / 1000}s, Instance 0 only)`);
}


// Get machine by machineId
exports.getMachineByMachineId = async (req, res) => {
  try {
    const query = { machineId: req.params.machineId };
    if (req.user && req.user.role !== 'superadmin') {
      query.userId = req.user.id;
    }
    const machine = await Machine.findOne(query);
    if (!machine) {
      return res.status(404).json({ success: false, message: 'Machine not found' });
    }
    res.status(200).json({ success: true, data: machine });
  } catch (error) {
    res.status(200).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// Update machine mode
exports.updateMode = async (req, res) => {
  try {
    const { mode } = req.body;
    const query = { _id: req.params.id };
    if (req.user.role !== 'superadmin') {
      query.userId = req.user.id;
    }
    const machine = await Machine.findOneAndUpdate(
      query,
      { mode },
      { new: true }
    );
    if (!machine) {
      return res.status(404).json({ success: false, message: 'Machine not found' });
    }
    res.status(200).json({ success: true, data: machine });
  } catch (error) {
    res.status(200).json({ success: false, message: 'Server Error' });
  }
};

// Update or create machine status (Heartbeat)
// 10K RDP Scale: Writes are cached in-memory and flushed to DB in bulk every 5 seconds.
// This reduces ~333 individual DB writes/sec down to 1 bulkWrite/5sec.
exports.updateStatus = async (req, res) => {
  try {
    const { machineId, name, status, tasks, mode, autoAdd } = req.body;

    // Cache the heartbeat data for bulk flush
    _heartbeatCache.set(machineId, {
      name,
      status,
      tasks,
      mode,
      autoAdd,
      lastSeen: new Date(),
    });

    // Respond immediately (0ms DB latency)
    res.status(200).json({
      success: true,
      data: { machineId, status, lastSeen: new Date() },
    });
  } catch (error) {
    res.status(200).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

// Update specific task progress
// 10K RDP Scale: Writes are cached in-memory and flushed to DB in bulk every 5 seconds.
exports.updateTaskProgress = async (req, res) => {
  try {
    const { machineId, taskIndex, progress, left, status, name } = req.body;

    // Cache task progress for bulk flush (keyed by machineId:taskIndex)
    const cacheKey = `${machineId}:${taskIndex}`;
    _taskProgressCache.set(cacheKey, { machineId, taskIndex, progress, left, status, name });

    // Respond immediately (0ms DB latency)
    res.status(200).json({
      success: true,
      data: { machineId, taskIndex, progress, left },
    });
  } catch (error) {
    res.status(200).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

// Get all machines
exports.getMachines = async (req, res) => {
  try {
    const query = {};
    if (req.user.role !== 'superadmin') {
      query.userId = req.user.id;
    } else if (req.query.userId) {
      if (req.query.userId !== 'all') {
        query.userId = req.query.userId;
      }
    } else {
      query.userId = req.user.id;
    }
    const machines = await Machine.find(query).sort({ name: 1 });
    
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
    res.status(200).json({
      success: false,
      message: 'Server Error',
    });
  }
};

// Delete machine
exports.deleteMachine = async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.user.role !== 'superadmin') {
      query.userId = req.user.id;
    }
    const machine = await Machine.findOneAndDelete(query);
    if (!machine) {
      return res.status(404).json({ success: false, message: 'Machine not found' });
    }
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(200).json({ success: false, message: 'Server Error' });
  }
};

// Register a new machine
exports.registerMachine = async (req, res) => {
  try {
    const { machineId, name, rdpIp, rdpUsername, rdpPassword } = req.body;
    
    if (!machineId || !name) {
      return res.status(400).json({ success: false, message: 'Please provide machineId and name' });
    }

    const exists = await Machine.findOne({ machineId });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Machine ID already exists' });
    }

    const agentToken = crypto.randomBytes(16).toString('hex');
    const machine = await Machine.create({
      machineId,
      name,
      rdpIp: rdpIp || '',
      rdpUsername: rdpUsername || '',
      rdpPassword: rdpPassword || '',
      agentToken,
      status: 'offline',
      lastSeen: new Date(0),
      userId: req.user.id
    });

    res.status(201).json({ success: true, data: machine, agentToken });
  } catch (error) {
    res.status(200).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// Update RDP details
exports.updateMachineDetails = async (req, res) => {
  try {
    const { name, rdpIp, rdpUsername, rdpPassword } = req.body;
    const query = { _id: req.params.id };
    if (req.user.role !== 'superadmin') {
      query.userId = req.user.id;
    }
    const machine = await Machine.findOneAndUpdate(
      query,
      { name, rdpIp, rdpUsername, rdpPassword },
      { new: true }
    );
    if (!machine) {
      return res.status(404).json({ success: false, message: 'Machine not found' });
    }
    res.status(200).json({ success: true, data: machine });
  } catch (error) {
    res.status(200).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// Bulk delete offline machines (> 2 minutes inactive)
exports.bulkDeleteOffline = async (req, res) => {
  try {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const query = { lastSeen: { $lt: twoMinutesAgo } };
    if (req.user.role !== 'superadmin') {
      query.userId = req.user.id;
    }
    const result = await Machine.deleteMany(query);
    res.status(200).json({ success: true, message: `Successfully deleted ${result.deletedCount} offline machines` });
  } catch (error) {
    res.status(200).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// Bulk import machines from raw text input
exports.bulkImportMachines = async (req, res) => {
  try {
    const { rawText } = req.body;
    if (!rawText) {
      return res.status(400).json({ success: false, message: 'Please provide raw text data' });
    }

    const lines = rawText.split('\n');
    let createdCount = 0;
    let updatedCount = 0;

    for (let line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) continue;
      // split by tabs or spaces
      const parts = cleanLine.split(/\s+/);
      if (parts.length >= 3) {
        const ip = parts[0];
        const user = parts[1];
        const pass = parts[2];
        const name = parts[3] || `rdp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const machineId = name;

        const query = { $or: [{ machineId }, { rdpIp: ip }] };
        if (req.user.role !== 'superadmin') {
          query.userId = req.user.id;
        }

        let machine = await Machine.findOne(query);
        if (machine) {
          machine.rdpIp = ip;
          machine.rdpUsername = user;
          machine.rdpPassword = pass;
          machine.name = name;
          machine.machineId = machineId;
          await machine.save();
          updatedCount++;
        } else {
          const agentToken = crypto.randomBytes(16).toString('hex');
          await Machine.create({
            machineId,
            name,
            rdpIp: ip,
            rdpUsername: user,
            rdpPassword: pass,
            status: 'offline',
            lastSeen: new Date(0),
            agentToken,
            userId: req.user.id
          });
          createdCount++;
        }
      }
    }
    res.status(200).json({
      success: true,
      message: `Bulk import completed. Created: ${createdCount}, Updated: ${updatedCount}`
    });
  } catch (error) {
    res.status(200).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// Check RDP TCP connectivity on port 3389
exports.checkRdp = async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.user.role !== 'superadmin') {
      query.userId = req.user.id;
    }
    const machine = await Machine.findOne(query);
    if (!machine || !machine.rdpIp) {
      return res.status(404).json({ success: false, message: 'Machine or RDP IP not found' });
    }

    const checkPing = () => {
      return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2500);

        socket.on('connect', () => {
          socket.destroy();
          resolve(true);
        });

        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });

        socket.on('error', () => {
          socket.destroy();
          resolve(false);
        });

        socket.connect(3389, machine.rdpIp);
      });
    };

    const reachable = await checkPing();
    res.status(200).json({ success: true, reachable });
  } catch (error) {
    res.status(200).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// Update RDP Config
exports.updateMachineConfig = async (req, res) => {
  try {
    const { rdpConfig } = req.body;
    const query = { _id: req.params.id };
    if (req.user.role !== 'superadmin') {
      query.userId = req.user.id;
    }
    const machine = await Machine.findOneAndUpdate(
      query,
      { rdpConfig },
      { new: true }
    );
    if (!machine) {
      return res.status(404).json({ success: false, message: 'Machine not found' });
    }
    res.status(200).json({ success: true, data: machine });
  } catch (error) {
    res.status(200).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// Send single machine command
exports.sendMachineCommand = async (req, res) => {
  try {
    const { action } = req.body;
    const query = { _id: req.params.id };
    if (req.user.role !== 'superadmin') {
      query.userId = req.user.id;
    }
    const machine = await Machine.findOneAndUpdate(
      query,
      { pendingCommand: action },
      { new: true }
    );
    if (!machine) {
      return res.status(404).json({ success: false, message: 'Machine not found' });
    }
    res.status(200).json({ success: true, message: `Command ${action} sent to machine` });
  } catch (error) {
    res.status(200).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// Regenerate Machine Communication Token
exports.regenerateMachineToken = async (req, res) => {
  try {
    const agentToken = crypto.randomBytes(16).toString('hex');
    const query = { _id: req.params.id };
    if (req.user.role !== 'superadmin') {
      query.userId = req.user.id;
    }
    const machine = await Machine.findOneAndUpdate(
      query,
      { agentToken },
      { new: true }
    );
    if (!machine) {
      return res.status(404).json({ success: false, message: 'Machine not found' });
    }
    res.status(200).json({ success: true, agentToken });
  } catch (error) {
    res.status(200).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// Bulk send machine command
exports.bulkSendMachineCommand = async (req, res) => {
  try {
    const { action, rawText, target } = req.body;

    if (target === 'offline') {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const query = { lastSeen: { $lt: twoMinutesAgo } };
      if (req.user.role !== 'superadmin') {
        query.userId = req.user.id;
      }
      const result = await Machine.updateMany(
        query,
        { pendingCommand: action }
      );
      return res.status(200).json({
        success: true,
        message: `Command '${action}' broadcasted to all ${result.modifiedCount} offline machines`
      });
    }

    if (!rawText) {
      return res.status(400).json({ success: false, message: 'Please provide raw text target list' });
    }

    const lines = rawText.split('\n');
    const ips = [];
    const ids = [];

    const ipRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;

    for (let line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) continue;

      const ipMatch = cleanLine.match(ipRegex);
      if (ipMatch) {
        ips.push(ipMatch[0]);
      }

      // Gather parts to search by machine ID / Name
      const parts = cleanLine.split(/\s+/);
      for (let part of parts) {
        if (part && part.length > 3 && !ipRegex.test(part)) {
          ids.push(part);
        }
      }
    }

    const query = { $or: [{ machineId: { $in: ids } }, { rdpIp: { $in: ips } }, { name: { $in: ids } }] };
    if (req.user.role !== 'superadmin') {
      query.userId = req.user.id;
    }

    const result = await Machine.updateMany(
      query,
      { pendingCommand: action }
    );

    res.status(200).json({
      success: true,
      message: `Command '${action}' sent to ${result.modifiedCount} matching machines`
    });
  } catch (error) {
    res.status(200).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// Get machines list formatted for Google Sheets
exports.getMachinesForSheets = async (req, res) => {
  try {
    const apiKey = req.query.apiKey || req.body.apiKey;
    if (apiKey !== process.env.JWT_SECRET) {
      return res.status(401).json({ success: false, message: 'Invalid API Key' });
    }

    const IndianNumber = require('../models/IndianNumber');

    const machines = await Machine.find().sort({ machineId: 1 }).lean();
    
    // Fetch all active/running numbers to map them efficiently
    const runningNumbers = await IndianNumber.find({ is_active: 'running' }).lean();
    
    // Group running numbers by rdp_id
    const numberGroups = {};
    runningNumbers.forEach(n => {
      if (n.rdp_id) {
        if (!numberGroups[n.rdp_id]) {
          numberGroups[n.rdp_id] = [];
        }
        numberGroups[n.rdp_id].push(n.number);
      }
    });

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const formattedList = machines.map(m => {
      const activeNumbers = numberGroups[m.machineId] || [];
      const runningCount = activeNumbers.length;
      
      const isDead = !m.lastSeen || new Date(m.lastSeen) < thirtyMinutesAgo;
      
      let status = 'Dead';
      if (!isDead) {
        if (runningCount === 0) {
          status = 'Inactive';
        } else {
          const hasIp = m.rdpIp && m.rdpIp.trim() !== '' && m.rdpIp.toLowerCase() !== 'unknown';
          status = hasIp ? 'Running' : 'Unknown IP Running';
        }
      }

      return {
        rdpId: m.machineId,
        rdpIp: m.rdpIp || '',
        status,
        lastSeen: m.lastSeen ? m.lastSeen.toISOString() : 'Never',
        runningCount,
        numbers: activeNumbers.join(', ')
      };
    });

    res.status(200).json({
      success: true,
      data: formattedList
    });
  } catch (error) {
    res.status(200).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// Bulk import machines from Google Sheets
exports.importMachinesFromSheets = async (req, res) => {
  try {
    const apiKey = req.query.apiKey || req.body.apiKey;
    if (apiKey !== process.env.JWT_SECRET) {
      return res.status(401).json({ success: false, message: 'Invalid API Key' });
    }

    const { machines } = req.body;
    if (!Array.isArray(machines)) {
      return res.status(400).json({ success: false, message: 'Please provide machines array' });
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (let m of machines) {
      const ip = m.rdpIp ? m.rdpIp.trim() : '';
      const user = m.rdpUsername ? m.rdpUsername.trim() : '';
      const pass = m.rdpPassword ? m.rdpPassword.trim() : '';
      const machineId = m.machineId ? m.machineId.trim() : '';

      if (!machineId) continue;

      let machine = await Machine.findOne({ machineId });
      if (machine) {
        machine.rdpIp = ip;
        machine.rdpUsername = user;
        machine.rdpPassword = pass;
        await machine.save();
        updatedCount++;
      } else {
        const agentToken = crypto.randomBytes(16).toString('hex');
        await Machine.create({
          machineId,
          name: machineId,
          rdpIp: ip,
          rdpUsername: user,
          rdpPassword: pass,
          status: 'offline',
          lastSeen: new Date(0),
          agentToken
        });
        createdCount++;
      }
    }

    res.status(200).json({
      success: true,
      message: `Sheets import completed. Created: ${createdCount}, Updated: ${updatedCount}`
    });
  } catch (error) {
    res.status(200).json({ success: false, message: 'Server Error', error: error.message });
  }
};

