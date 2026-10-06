const fs = require('fs');
const path = require('path');
let mapping = null;
let map5Digit = null;
let countryRules = null;

const masterDbPath = path.join(__dirname, '..', 'data', 'master_series_db.json');
const potentialSourcePaths = [
  '/var/www/power-automate_backend/check sorce.txt',
  path.join(__dirname, '..', '..', 'check sorce.txt'),
  path.join(__dirname, '..', 'check sorce.txt'),
  '/var/www/check sorce.txt',
  'E:\\steet and oparetor check\\database\\Prefix_Source\\check sorce.txt',
  'E:\\numbar oparetor check\\check sorce.txt'
];

let sourceFilePath = potentialSourcePaths.find(p => fs.existsSync(p)) || path.join(__dirname, '..', '..', 'check sorce.txt');

/**
 * Loads prefix mapping from master_series_db.json (22,040 series) or fallback check sorce.txt
 * Cached in memory after first read.
 */
function loadMapping() {
  if (mapping) return mapping;
  try {
    const localMapping = {};
    const local5 = {};
    const localCountryRules = {};

    // 1. Load Fallback Text Source first (legacy 4-digit codes & multi-country prefixes)
    for (const p of potentialSourcePaths) {
      if (fs.existsSync(p)) {
        sourceFilePath = p;
        break;
      }
    }

    if (fs.existsSync(sourceFilePath)) {
      const content = fs.readFileSync(sourceFilePath, 'utf8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim() || line.startsWith('#')) continue;
        const parts = line.split('\t');
        if (parts.length >= 3) {
          const prefix = parts[0].trim();
          const operator = parts[1].trim();
          const state = parts[2].trim();
          localMapping[prefix] = { operator, circle: state };

          const cKey = state.toLowerCase();
          if (!localCountryRules[cKey]) localCountryRules[cKey] = [];
          localCountryRules[cKey].push({ prefix, operator, state });
        }
      }
    }

    // Sort country rules by prefix length descending for longest match
    for (const cKey of Object.keys(localCountryRules)) {
      localCountryRules[cKey].sort((a, b) => b.prefix.length - a.prefix.length);
    }
    countryRules = localCountryRules;

    // 2. Overlay Master 22,040 Series JSON Database on top (highest priority for India)
    if (fs.existsSync(masterDbPath)) {
      const data = JSON.parse(fs.readFileSync(masterDbPath, 'utf8'));
      for (const [s5, info] of Object.entries(data)) {
        local5[s5] = { operator: info.operator, circle: info.circle };
        const s4 = s5.slice(0, 4);
        localMapping[s4] = { operator: info.operator, circle: info.circle };
      }
    }

    map5Digit = local5;
    mapping = localMapping;
    return mapping;
  } catch (error) {
    console.error('Error loading operator mapping:', error);
    mapping = {};
    map5Digit = {};
    return mapping;
  }
}

const OPERATOR_NORMALIZATION = {
  'Vodafone Idea': 'Vi',
  'Vodafone': 'Vi',
  'Idea': 'Vi',
  'VI': 'Vi',
  'Reliance Telecom': 'Reliance Jio',
  'Reliance': 'Reliance Jio',
  'Reliance Jio': 'Reliance Jio',
  'RJ': 'Reliance Jio',
  'Airtel': 'Airtel',
  'AT': 'Airtel',
  'Tata Docomo': 'Airtel',
  'Docomo': 'Airtel',
  'DO': 'Airtel',
  'Aircel': 'Airtel',
  'AC': 'Airtel',
  'Telewings': 'Airtel',
  'Uninor': 'Airtel',
  'Unitech Wireless': 'Airtel',
  'UN': 'Airtel',
  'Dishnet Wireless': 'Airtel',
  'BSNL': 'BSNL',
  'MTNL': 'BSNL',
  'BS': 'BSNL',
  'MT': 'BSNL',
  'CG': 'BSNL',
  'CC': 'BSNL'
};

const CIRCLE_NORMALIZATION = {
  'Maharashtra': 'Maharashtra & Goa',
  'Chennai': 'Tamil Nadu',
  'UP (West)': 'UP (West) & Uttarakhand'
};

/**
 * Universal Telecom Resolver for All Countries
 * @param {string} phone
 * @param {string} [countryCode]
 * @returns {object} { prefix, operator, circle, state_operator }
 */
function resolveNumber(phone, countryCode = '') {
  const localMapping = loadMapping();
  if (!phone) {
    return { prefix: '', operator: 'Unknown', circle: 'Unknown', state_operator: 'Unknown>Unknown' };
  }

  const cleanPhone = String(phone).trim().replace(/\D/g, '');
  let cc = String(countryCode || '').trim().replace(/\D/g, '');

  // Auto-detect Country Code if not explicitly provided
  if (!cc) {
    if (cleanPhone.startsWith('91') && cleanPhone.length === 12) cc = '91';
    else if (cleanPhone.startsWith('92') && (cleanPhone.length === 12 || cleanPhone.length === 13)) cc = '92';
    else if (cleanPhone.startsWith('20') && (cleanPhone.length === 12 || cleanPhone.length === 13)) cc = '20';
    else if (cleanPhone.startsWith('221') && (cleanPhone.length === 12 || cleanPhone.length === 11)) cc = '221';
    else if (cleanPhone.startsWith('225') && (cleanPhone.length === 13 || cleanPhone.length === 12 || cleanPhone.length === 10)) cc = '225';
    else if (cleanPhone.startsWith('233') && (cleanPhone.length === 12 || cleanPhone.length === 13)) cc = '233';
    else if (cleanPhone.startsWith('234') && (cleanPhone.length === 13 || cleanPhone.length === 14)) cc = '234';
    else if (cleanPhone.startsWith('243') && (cleanPhone.length === 12 || cleanPhone.length === 13)) cc = '243';
    else if (cleanPhone.startsWith('251') && (cleanPhone.length === 12 || cleanPhone.length === 13)) cc = '251';
    else if (cleanPhone.startsWith('255') && (cleanPhone.length === 12 || cleanPhone.length === 13)) cc = '255';
    else if (cleanPhone.startsWith('66') && (cleanPhone.length === 11 || cleanPhone.length === 12)) cc = '66';
    else if (cleanPhone.length === 10 && cleanPhone[0] >= '6' && cleanPhone[0] <= '9') cc = '91';
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. PAKISTAN (+92)
  // ─────────────────────────────────────────────────────────────────────────────
  if (cc === '92' || cleanPhone.startsWith('92')) {
    let rest = cleanPhone.startsWith('92') ? cleanPhone.slice(2) : cleanPhone;
    if (!rest.startsWith('0')) rest = '0' + rest;
    const pfx4 = rest.slice(0, 4);

    let op = 'Unknown';
    if (pfx4 >= '0300' && pfx4 <= '0309') op = 'Jazz';
    else if (pfx4 >= '0320' && pfx4 <= '0325') op = 'Jazz'; // Former Warid merged into Jazz
    else if (pfx4 >= '0310' && pfx4 <= '0319') op = 'Zong';
    else if (pfx4 >= '0330' && pfx4 <= '0337') op = 'Ufone';
    else if (pfx4 >= '0340' && pfx4 <= '0349') op = 'Telenor';
    else if (pfx4 === '0355') op = 'SCOM';
    else if (pfx4 === '0370') op = 'Ufone';
    else if (pfx4.startsWith('021')) op = 'PTCL';
    else if (pfx4.startsWith('042')) op = 'PTCL';
    else if (pfx4.startsWith('051')) op = 'PTCL';
    else if (pfx4.startsWith('03')) op = 'Jazz'; // Common Pakistan mobile series fallback

    const circle = 'Pakistan';
    return {
      prefix: pfx4,
      operator: op,
      circle,
      state_operator: `${circle}>${op}`
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. EGYPT (+20)
  // ─────────────────────────────────────────────────────────────────────────────
  if (cc === '20' || cleanPhone.startsWith('20')) {
    let rest = cleanPhone.startsWith('20') ? cleanPhone.slice(2) : cleanPhone;
    if (!rest.startsWith('0')) rest = '0' + rest;
    const pfx3 = rest.slice(0, 3);

    let op = 'Unknown';
    if (pfx3 === '010') op = 'Vodafone';
    else if (pfx3 === '011') op = 'Etisalat';
    else if (pfx3 === '012') op = 'Orange';
    else if (pfx3 === '015') op = 'WE';

    const circle = 'Egypt';
    return {
      prefix: pfx3,
      operator: op,
      circle,
      state_operator: `${circle}>${op}`
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. THAILAND (+66)
  // ─────────────────────────────────────────────────────────────────────────────
  if (cc === '66' || cleanPhone.startsWith('66')) {
    let rest = cleanPhone;
    if (cleanPhone.startsWith('660')) {
      rest = cleanPhone.slice(2);
    } else if (cleanPhone.startsWith('66')) {
      rest = cleanPhone.slice(2);
      if (!rest.startsWith('0')) rest = '0' + rest;
    } else if (!cleanPhone.startsWith('0')) {
      rest = '0' + cleanPhone;
    }
    const localStr = rest;
    const intlStr = '66' + (localStr.startsWith('0') ? localStr.slice(1) : localStr);
    const pfx3 = localStr.slice(0, 3);

    let op = 'Unknown';
    const thaiRules = (countryRules && countryRules['thailand']) || [];
    for (const rule of thaiRules) {
      if (localStr.startsWith(rule.prefix) || intlStr.startsWith(rule.prefix)) {
        op = rule.operator;
        break;
      }
    }

    // Heuristic fallback for Thailand mobile ranges if unmatched
    if (op === 'Unknown') {
      if (pfx3.startsWith('08') || pfx3.startsWith('09') || pfx3.startsWith('06')) {
        op = 'AIS';
      }
    }

    const circle = 'Thailand';
    return {
      prefix: pfx3,
      operator: op,
      circle,
      state_operator: `${circle}>${op}`
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. NIGERIA (+234)
  // ─────────────────────────────────────────────────────────────────────────────
  if (cc === '234' || cleanPhone.startsWith('234')) {
    let rest = cleanPhone.startsWith('234') ? cleanPhone.slice(3) : cleanPhone;
    if (!rest.startsWith('0')) rest = '0' + rest;
    const pfx4 = rest.slice(0, 4);

    let op = 'Unknown';
    if (['0803', '0806', '0703', '0706', '0813', '0816', '0810', '0814', '0903', '0906', '0913', '0916'].includes(pfx4)) {
      op = 'MTN';
    } else if (['0802', '0808', '0708', '0812', '0701', '0902', '0901', '0904', '0907', '0912'].includes(pfx4)) {
      op = 'Airtel';
    } else if (['0805', '0807', '0705', '0815', '0811', '0905', '0915'].includes(pfx4)) {
      op = 'Glo';
    } else if (['0809', '0817', '0818', '0909', '0908'].includes(pfx4)) {
      op = '9mobile';
    } else if (localMapping[pfx4]) {
      op = localMapping[pfx4].operator;
    }

    const circle = 'Nigeria';
    return {
      prefix: pfx4,
      operator: op,
      circle,
      state_operator: `${circle}>${op}`
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. CÔTE D'IVOIRE / IVORY COAST (+225)
  // ─────────────────────────────────────────────────────────────────────────────
  if (cc === '225' || cleanPhone.startsWith('225')) {
    let rest = cleanPhone.startsWith('225') ? cleanPhone.slice(3) : cleanPhone;
    const pfx2 = rest.startsWith('0') ? rest.slice(0, 2) : ('0' + rest).slice(0, 2);

    let op = 'Unknown';
    if (['07', '08'].includes(pfx2)) op = 'Orange';
    else if (['05', '06'].includes(pfx2)) op = 'MTN';
    else if (['01', '02'].includes(pfx2)) op = 'Moov';

    const circle = 'Ivory Coast';
    return {
      prefix: pfx2,
      operator: op,
      circle,
      state_operator: `${circle}>${op}`
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. SENEGAL (+221)
  // ─────────────────────────────────────────────────────────────────────────────
  if (cc === '221' || cleanPhone.startsWith('221')) {
    let rest = cleanPhone.startsWith('221') ? cleanPhone.slice(3) : cleanPhone;
    const pfx2 = rest.slice(0, 2);

    let op = 'Unknown';
    if (['77', '78'].includes(pfx2)) op = 'Orange';
    else if (['76'].includes(pfx2)) op = 'Free';
    else if (['70'].includes(pfx2)) op = 'Expresso';
    else if (['75'].includes(pfx2)) op = 'Promobile';

    const circle = 'Senegal';
    return {
      prefix: pfx2,
      operator: op,
      circle,
      state_operator: `${circle}>${op}`
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. DR CONGO (+243)
  // ─────────────────────────────────────────────────────────────────────────────
  if (cc === '243' || cleanPhone.startsWith('243')) {
    let rest = cleanPhone.startsWith('243') ? cleanPhone.slice(3) : cleanPhone;
    if (!rest.startsWith('0')) rest = '0' + rest;
    const pfx3 = rest.slice(0, 3);

    let op = 'Unknown';
    if (['097', '098', '099'].includes(pfx3)) op = 'Airtel';
    else if (['081', '082'].includes(pfx3)) op = 'Vodacom';
    else if (['084', '085', '089'].includes(pfx3)) op = 'Orange';
    else if (['090'].includes(pfx3)) op = 'Africell';

    const circle = 'DR Congo';
    return {
      prefix: pfx3,
      operator: op,
      circle,
      state_operator: `${circle}>${op}`
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. ETHIOPIA (+251)
  // ─────────────────────────────────────────────────────────────────────────────
  if (cc === '251' || cleanPhone.startsWith('251')) {
    let rest = cleanPhone.startsWith('251') ? cleanPhone.slice(3) : cleanPhone;
    if (!rest.startsWith('0')) rest = '0' + rest;
    const pfx3 = rest.slice(0, 3);

    let op = 'Unknown';
    if (pfx3.startsWith('09')) op = 'Ethio Telecom';
    else if (pfx3.startsWith('07')) op = 'Safaricom';

    const circle = 'Ethiopia';
    return {
      prefix: pfx3,
      operator: op,
      circle,
      state_operator: `${circle}>${op}`
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. TANZANIA (+255)
  // ─────────────────────────────────────────────────────────────────────────────
  if (cc === '255' || cleanPhone.startsWith('255')) {
    let rest = cleanPhone.startsWith('255') ? cleanPhone.slice(3) : cleanPhone;
    if (!rest.startsWith('0')) rest = '0' + rest;
    const pfx3 = rest.slice(0, 3);

    let op = 'Unknown';
    if (['075', '076', '074'].includes(pfx3)) op = 'Vodacom';
    else if (['071', '077'].includes(pfx3)) op = 'Tigo';
    else if (['068', '069', '078'].includes(pfx3)) op = 'Airtel';
    else if (['062'].includes(pfx3)) op = 'Halotel';
    else if (['073'].includes(pfx3)) op = 'TTCL';

    const circle = 'Tanzania';
    return {
      prefix: pfx3,
      operator: op,
      circle,
      state_operator: `${circle}>${op}`
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. GHANA (+233)
  // ─────────────────────────────────────────────────────────────────────────────
  if (cc === '233' || cleanPhone.startsWith('233')) {
    let rest = cleanPhone.startsWith('233') ? cleanPhone.slice(3) : cleanPhone;
    if (!rest.startsWith('0')) rest = '0' + rest;
    const pfx3 = rest.slice(0, 3);

    let op = 'Unknown';
    if (['024', '054', '055', '059'].includes(pfx3)) op = 'MTN';
    else if (['020', '050'].includes(pfx3)) op = 'Vodafone';
    else if (['027', '057', '026', '056'].includes(pfx3)) op = 'AirtelTigo';
    else if (localMapping[pfx3]) op = localMapping[pfx3].operator;

    const circle = 'Ghana';
    return {
      prefix: pfx3,
      operator: op,
      circle,
      state_operator: `${circle}>${op}`
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 11. INDIA (+91)
  // ─────────────────────────────────────────────────────────────────────────────
  let prefix = '';
  let prefix5 = '';

  if (cleanPhone.length >= 12 && cleanPhone.startsWith('91')) {
    prefix = cleanPhone.slice(2, 6);
    prefix5 = cleanPhone.slice(2, 7);
  } else if (cleanPhone.length >= 10) {
    prefix = cleanPhone.slice(0, 4);
    prefix5 = cleanPhone.slice(0, 5);
  }

  let matched = map5Digit && map5Digit[prefix5] ? map5Digit[prefix5] : localMapping[prefix];

  let rawOperator = 'Unknown';
  let rawCircle = 'Unknown';

  if (matched) {
    rawOperator = matched.operator || 'Unknown';
    rawCircle = matched.circle || 'Unknown';
  } else {
    // Dynamic fallback for unrecognized 6-series prefixes
    if (prefix.startsWith('60') || prefix.startsWith('62')) {
      rawOperator = 'Reliance Jio';
    } else if (prefix.startsWith('61')) {
      rawOperator = 'Airtel';
    } else if (prefix.startsWith('63')) {
      rawOperator = 'BSNL';
    }
  }

  // Normalize operator and circle names
  let operator = OPERATOR_NORMALIZATION[rawOperator] || rawOperator;
  let circle = CIRCLE_NORMALIZATION[rawCircle] || rawCircle;

  if (operator === 'Inactive' || !operator) operator = 'Unknown';
  if (circle === 'Inactive' || !circle) circle = 'Unknown';

  return {
    prefix,
    operator,
    circle,
    state_operator: `${circle}>${operator}`
  };
}

function normalizeOperator(op) {
  if (!op || op === 'Inactive' || op === 'Unknown') return 'Unknown';
  return OPERATOR_NORMALIZATION[op.trim()] || op.trim();
}

function normalizeCircle(circ) {
  if (!circ || circ === 'Inactive' || circ === 'Unknown') return 'Unknown';
  return CIRCLE_NORMALIZATION[circ.trim()] || circ.trim();
}

function reloadMapping() {
  mapping = null;
  map5Digit = null;
  countryRules = null;
  return loadMapping();
}

module.exports = {
  resolveNumber,
  loadMapping,
  reloadMapping,
  normalizeOperator,
  normalizeCircle,
  OPERATOR_NORMALIZATION,
  CIRCLE_NORMALIZATION,
  sourceFilePath
};
