const net = require('net');
const Machine = require('../models/Machine');

// High-performance TCP ping check on port 3389
function checkPing(ip) {
  return new Promise((resolve) => {
    // If IP is invalid or placeholder, mark as unreachable
    if (!ip || ip === 'Unknown IP' || ip.trim() === '') {
      return resolve({ ip, reachable: false });
    }

    const socket = new net.Socket();
    socket.setTimeout(2500); // 2.5 seconds timeout

    socket.on('connect', () => {
      socket.destroy();
      resolve({ ip, reachable: true });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ ip, reachable: false });
    });

    socket.on('error', () => {
      socket.destroy();
      resolve({ ip, reachable: false });
    });

    socket.connect(3389, ip);
  });
}

// Concurrency-limited execution helper
async function runWithLimit(tasks, limit) {
  const results = [];
  const executing = [];
  for (const task of tasks) {
    const p = Promise.resolve().then(() => task());
    results.push(p);
    if (limit <= tasks.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(results);
}

// Main execution function
async function runRdpPingScan() {
  try {
    console.log('[RdpPingService] Starting RDP reachability scan...');
    const startTime = Date.now();

    // Fetch all machines
    const machines = await Machine.find({}).select('machineId rdpIp').lean();
    if (machines.length === 0) {
      console.log('[RdpPingService] No registered RDPs to scan.');
      return;
    }

    console.log(`[RdpPingService] Loaded ${machines.length} RDPs to ping.`);

    // Map machines to ping tasks
    const tasks = machines.map(m => () => checkPing(m.rdpIp));
    const results = await runWithLimit(tasks, 50);

    // Create a map of IP -> reachability
    const ipReachabilityMap = {};
    results.forEach(res => {
      ipReachabilityMap[res.ip] = res.reachable;
    });

    // Prepare bulk updates
    const bulkOps = machines.map(m => {
      const isReachable = ipReachabilityMap[m.rdpIp] || false;
      return {
        updateOne: {
          filter: { machineId: m.machineId },
          update: { $set: { isReachable } }
        }
      };
    });

    if (bulkOps.length > 0) {
      const bulkResult = await Machine.bulkWrite(bulkOps);
      console.log(`[RdpPingService] Bulk write completed. Modified: ${bulkResult.modifiedCount}`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const reachableCount = results.filter(r => r.reachable).length;
    console.log(`[RdpPingService] Scan finished. Reachable: ${reachableCount}/${machines.length} in ${duration}s`);

  } catch (error) {
    console.error('[RdpPingService] Error during scan:', error);
  }
}

// Initialize the interval service
function startRdpPingService(intervalMinutes = 5) {
  console.log(`[RdpPingService] Initializing. Scanning RDP reachability every ${intervalMinutes} minutes.`);

  // Run once immediately on startup
  runRdpPingScan();

  const intervalMs = intervalMinutes * 60 * 1000;
  const timer = setInterval(() => {
    runRdpPingScan();
  }, intervalMs);

  if (timer.unref) timer.unref();

  return {
    stop: () => clearInterval(timer),
    runNow: () => runRdpPingScan()
  };
}

module.exports = {
  startRdpPingService,
  runRdpPingScan
};
