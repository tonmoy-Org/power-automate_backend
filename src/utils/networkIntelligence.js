const fs = require('fs');
const path = require('path');
const operatorResolver = require('./operatorResolver');

// Comprehensive Indian Telecom ASN Database
const ASN_DATABASE = {
  // Bharti Airtel
  '45609': { operator: 'Airtel', isp: 'Bharti Airtel Limited', type: 'CELLULAR_4G_5G' },
  '9498': { operator: 'Airtel', isp: 'Bharti Airtel Limited (Enterprise/FTH)', type: 'BROADBAND_FIBER' },
  '24560': { operator: 'Airtel', isp: 'Bharti Airtel (Broadband)', type: 'BROADBAND_FIBER' },

  // Reliance Jio Infocomm
  '55836': { operator: 'Reliance Jio', isp: 'Reliance Jio Infocomm Limited', type: 'CELLULAR_4G_5G' },
  '132427': { operator: 'Reliance Jio', isp: 'Jio Fiber / Enterprise', type: 'BROADBAND_FIBER' },

  // Vodafone Idea Limited (Vi)
  '137867': { operator: 'Vi', isp: 'Vodafone Idea Limited', type: 'CELLULAR_4G_5G' },
  '45528': { operator: 'Vi', isp: 'Vodafone Idea Mobile', type: 'CELLULAR_4G_5G' },
  '137868': { operator: 'Vi', isp: 'Vodafone Idea Limited', type: 'CELLULAR_4G_5G' },
  '55410': { operator: 'Vi', isp: 'Vodafone Idea (You Broadband)', type: 'BROADBAND_FIBER' },

  // BSNL / MTNL
  '9829': { operator: 'BSNL', isp: 'Bharat Sanchar Nigam Limited (BSNL)', type: 'CELLULAR_4G_5G' },
  '17813': { operator: 'BSNL', isp: 'Mahanagar Telephone Nigam Limited (MTNL)', type: 'CELLULAR_4G_5G' },
  '4755': { operator: 'BSNL', isp: 'BSNL Internet', type: 'BROADBAND_FIBER' },

  // Major Indian Fixed Broadband / Wi-Fi Providers
  '24309': { operator: 'ACT Fibernet', isp: 'Atria Convergence Technologies', type: 'WIFI_BROADBAND' },
  '133694': { operator: 'Hathway', isp: 'Hathway Cable and Datacom', type: 'WIFI_BROADBAND' },
  '133987': { operator: 'Excitel', isp: 'Excitel Broadband', type: 'WIFI_BROADBAND' },
  '132165': { operator: 'Spectranet', isp: 'Spectranet Broadband', type: 'WIFI_BROADBAND' },
  '134890': { operator: 'Tikona', isp: 'Tikona Infinet Ltd', type: 'WIFI_BROADBAND' },
  '134108': { operator: 'Alliance Broadband', isp: 'Alliance Broadband Services', type: 'WIFI_BROADBAND' },
  '133929': { operator: 'GTPL Hathway', isp: 'GTPL Hathway Ltd', type: 'WIFI_BROADBAND' },
  '136069': { operator: 'One Broadband', isp: 'ONE Broadband Limited', type: 'WIFI_BROADBAND' }
};

/**
 * Parse proxy string to extract ASN, ISP, City, and State.
 * e.g. "global.rotgb.711proxy.com:10000:USER903036-zone-custom-region-IN-st-assam-city-guwahati-isp-airtel-asn-ASN45609-session-99143347"
 */
function parseProxyString(proxyStr) {
  const result = {
    region: '',
    state: '',
    city: '',
    isp: '',
    asn: '',
    raw: proxyStr || ''
  };
  if (!proxyStr || typeof proxyStr !== 'string') return result;

  const lower = proxyStr.toLowerCase();

  // ASN match
  const asnMatch = lower.match(/asn-(?:asn)?(\d+)/i);
  if (asnMatch) {
    result.asn = `ASN${asnMatch[1]}`;
  }

  // ISP match
  const ispMatch = lower.match(/isp-([a-z0-9_-]+?)(?:-asn|-session|-sess|-zone|$)/i);
  if (ispMatch) {
    result.isp = ispMatch[1].replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // State match
  const stMatch = lower.match(/st-([a-z0-9_-]+?)(?:-city|-isp|-asn|-session|$)/i);
  if (stMatch) {
    result.state = stMatch[1].replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // City match
  const cityMatch = lower.match(/city-([a-z0-9_-]+?)(?:-isp|-asn|-session|-st|$)/i);
  if (cityMatch) {
    result.city = cityMatch[1].replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  return result;
}

/**
 * Resolve Live Network details from ASN and ISP
 */
function resolveLiveNetwork(asnStr = '', ispStr = '') {
  const cleanAsn = String(asnStr).replace(/\D/g, '');

  // 1. Direct ASN lookup
  if (cleanAsn && ASN_DATABASE[cleanAsn]) {
    const data = ASN_DATABASE[cleanAsn];
    return {
      live_operator: data.operator,
      live_isp: data.isp,
      live_asn: `ASN${cleanAsn}`,
      connection_type: data.type
    };
  }

  // 2. Heuristic ISP lookup
  const ispLower = String(ispStr).toLowerCase();
  if (ispLower.includes('airtel')) {
    return { live_operator: 'Airtel', live_isp: 'Bharti Airtel Limited', live_asn: 'ASN45609', connection_type: 'CELLULAR_4G_5G' };
  }
  if (ispLower.includes('jio') || ispLower.includes('reliance')) {
    return { live_operator: 'Reliance Jio', live_isp: 'Reliance Jio Infocomm Limited', live_asn: 'ASN55836', connection_type: 'CELLULAR_4G_5G' };
  }
  if (ispLower.includes('vodafone') || ispLower.includes('idea') || ispLower.includes('vi')) {
    return { live_operator: 'Vi', live_isp: 'Vodafone Idea Limited', live_asn: 'ASN137867', connection_type: 'CELLULAR_4G_5G' };
  }
  if (ispLower.includes('bsnl') || ispLower.includes('mtnl')) {
    return { live_operator: 'BSNL', live_isp: 'Bharat Sanchar Nigam Limited', live_asn: 'ASN9829', connection_type: 'CELLULAR_4G_5G' };
  }
  if (ispLower.includes('act') || ispLower.includes('hathway') || ispLower.includes('excitel') || ispLower.includes('fiber') || ispLower.includes('broadband')) {
    return { live_operator: 'Wi-Fi/Broadband', live_isp: ispStr || 'Fixed Broadband', live_asn: asnStr || 'BROADBAND', connection_type: 'WIFI_BROADBAND' };
  }

  return {
    live_operator: 'Unknown',
    live_isp: ispStr || 'Unknown ISP',
    live_asn: asnStr || 'Unknown ASN',
    connection_type: 'UNKNOWN'
  };
}

/**
 * Bulletproof Dual-Layer Intelligence Analyzer
 */
function analyzeDualLayer(phone, options = {}) {
  const { proxyStr = '', asn = '', isp = '', ip = '', city = '', region = '' } = options;

  // Resolve Series Operator and Circle
  const seriesInfo = operatorResolver.resolveNumber(phone);

  // Parse proxy if provided
  const proxyMeta = parseProxyString(proxyStr);
  const targetAsn = proxyMeta.asn || asn;
  const targetIsp = proxyMeta.isp || isp;
  const targetCity = city || proxyMeta.city;
  const targetRegion = region || proxyMeta.state;

  const liveNet = resolveLiveNetwork(targetAsn, targetIsp);

  const seriesOp = seriesInfo.operator;
  const liveOp = liveNet.live_operator;
  const connType = liveNet.connection_type;

  let matchType = 'UNVERIFIED';
  let statusDesc = 'Series Identified (No Live Network Data)';

  if (liveOp !== 'Unknown' && targetAsn) {
    if (connType === 'WIFI_BROADBAND') {
      matchType = 'WIFI_BROADBAND';
      statusDesc = `Connected via Wi-Fi/Fiber (${liveNet.live_isp})`;
    } else if (seriesOp === liveOp || (seriesOp === 'Vi' && liveOp === 'Vi') || (seriesOp === 'Reliance Jio' && liveOp === 'Reliance Jio')) {
      matchType = 'DIRECT_SIM_MATCH';
      statusDesc = `Direct SIM Match: ${seriesOp} on ${seriesOp} Cellular Data`;
    } else {
      matchType = 'PORTED_OR_DUAL_SIM';
      statusDesc = `MNP / Dual SIM: ${seriesOp} Series using ${liveOp} Data Network`;
    }
  }

  return {
    phone,
    prefix: seriesInfo.prefix,
    // Layer 1: Series Telecom
    series_operator: seriesOp,
    series_circle: seriesInfo.circle,
    // Layer 2: Live Network
    live_operator: liveOp,
    live_isp: liveNet.live_isp,
    live_asn: liveNet.live_asn,
    live_ip: ip,
    live_city: targetCity,
    live_region: targetRegion,
    connection_type: connType,
    // Comparison
    network_match_type: matchType,
    status_description: statusDesc
  };
}

module.exports = {
  ASN_DATABASE,
  parseProxyString,
  resolveLiveNetwork,
  analyzeDualLayer
};
