const net = require('net');
const Machine = require('../models/Machine');

let isScanning = false;

// Socket check for a single IP on port 3389
function checkPing(ip) {
  return new Promise((resolve) => {
    if (!ip) return resolve(false);
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

    socket.connect(3389, ip);
  });
}

// Concurrency-limited runner
async function limitConcurrency(tasks, limit) {
  const results = [];
  const executing = new Set();
  for (const task of tasks) {
    const p = Promise.resolve().then(() => task());
    results.push(p);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
}

// Scan all machines
async function scanAllRdp() {
  if (isScanning) {
    console.log('[RdpStatusMonitor] Scan already in progress, skipping.');
    return;
  }
  isScanning = true;
  console.log('[RdpStatusMonitor] Starting bulk RDP connection scan...');

  try {
    const machines = await Machine.find({});
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    const tasks = machines.map((machine) => async () => {
      try {
        const isOnline = machine.lastSeen >= twoMinutesAgo;
        if (isOnline) {
          // If the bot is active, RDP is definitely active
          if (machine.rdpStatus !== 'active') {
            machine.rdpStatus = 'active';
            await machine.save();
          }
          return;
        }

        // If bot is offline, check RDP connectivity
        if (!machine.rdpIp) {
          if (machine.rdpStatus !== 'dead') {
            machine.rdpStatus = 'dead';
            await machine.save();
          }
          return;
        }

        const reachable = await checkPing(machine.rdpIp);
        const newRdpStatus = reachable ? 'active' : 'dead';

        if (machine.rdpStatus !== newRdpStatus) {
          machine.rdpStatus = newRdpStatus;
          await machine.save();
          console.log(`[RdpStatusMonitor] Machine ${machine.name} (${machine.rdpIp}) RDP status updated to: ${newRdpStatus}`);
        }
      } catch (err) {
        console.error(`[RdpStatusMonitor] Error checking machine ${machine.name}:`, err.message);
      }
    });

    // Run up to 40 checks in parallel
    await limitConcurrency(tasks, 40);
    console.log('[RdpStatusMonitor] Bulk RDP connection scan completed.');
  } catch (error) {
    console.error('[RdpStatusMonitor] Error during bulk scan:', error);
  } finally {
    isScanning = false;
  }
}

// Start the periodic monitor
function startRdpStatusMonitor(intervalMinutes = 5) {
  console.log(`[RdpStatusMonitor] Initializing. Scanning RDP connectivity every ${intervalMinutes} minutes.`);
  
  // Run once on startup after 10 seconds
  setTimeout(() => {
    scanAllRdp().catch(err => console.error('[RdpStatusMonitor] Startup scan failed:', err));
  }, 10000);

  const intervalMs = intervalMinutes * 60 * 1000;
  const timer = setInterval(() => {
    scanAllRdp().catch(err => console.error('[RdpStatusMonitor] Scheduled scan failed:', err));
  }, intervalMs);

  if (timer.unref) timer.unref();

  return {
    stop: () => clearInterval(timer),
    runNow: () => scanAllRdp()
  };
}

module.exports = {
  startRdpStatusMonitor,
  scanAllRdp,
  checkPing,
  getScanStatus: () => ({ isScanning })
};
