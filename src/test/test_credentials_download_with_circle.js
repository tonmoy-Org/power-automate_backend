const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const operatorResolver = require('../utils/operatorResolver');
const googleSheets = require('../utils/googleSheets');

async function testCredentialsDownloadWithCircle() {
  console.log('🧪 Starting Universal Download & Circle>Operator Verification Tests...\n');
  let passed = 0;
  let failed = 0;

  const assert = (condition, message) => {
    if (condition) {
      passed++;
      console.log(`✅ [PASS] ${message}`);
    } else {
      failed++;
      console.error(`❌ [FAIL] ${message}`);
    }
  };

  // 1. Test multi-country resolution
  const testCases = [
    { phone: '9203009600034', cc: '92', expected: 'Pakistan>Jazz' },
    { phone: '9203112345678', cc: '92', expected: 'Pakistan>Zong' },
    { phone: '9203331234567', cc: '92', expected: 'Pakistan>Ufone' },
    { phone: '9203451234567', cc: '92', expected: 'Pakistan>Telenor' },
    { phone: '2001068625770', cc: '20', expected: 'Egypt>Vodafone' },
    { phone: '2001155014875', cc: '20', expected: 'Egypt>Etisalat' },
    { phone: '221781300095', cc: '221', expected: 'Senegal>Orange' },
    { phone: '2250700300326', cc: '225', expected: 'Ivory Coast>Orange' },
    { phone: '2340803555555', cc: '234', expected: 'Nigeria>MTN' },
    { phone: '2430972017010', cc: '243', expected: 'DR Congo>Airtel' },
    { phone: '2510900300518', cc: '251', expected: 'Ethiopia>Ethio Telecom' },
    { phone: '2550758050907', cc: '255', expected: 'Tanzania>Vodacom' },
    { phone: '2330245555555', cc: '233', expected: 'Ghana>MTN' },
    { phone: '919996426832', cc: '91', expected: 'Haryana>Airtel' }
  ];

  for (const tc of testCases) {
    const res = operatorResolver.resolveNumber(tc.phone, tc.cc);
    assert(
      res.state_operator === tc.expected,
      `${tc.phone} (CC: ${tc.cc}) => ${res.state_operator} (expected: ${tc.expected})`
    );
  }

  // 2. Test download formatting simulation matching PhoneCredentialController
  const sampleCreds = [
    { phone: '9203009600034', password: '03009600034a', type: 'DP', country_code: '92', operator: null, circle: null },
    { phone: '9203112345678', password: '03112345678a', type: 'DP', country_code: '92', operator: null, circle: null },
    { phone: '2001068625770', password: '01068625770a', type: 'BELL_VF', country_code: '20', operator: null, circle: null },
    { phone: '919996426832', password: '9996426832&', type: 'DP', country_code: '91', operator: null, circle: null }
  ];

  const downloadedLines = sampleCreds.map((cred) => {
    let op = cred.operator;
    let cir = cred.circle;
    if (!op || op === 'Unknown' || !cir || cir === 'Unknown') {
      const resolved = operatorResolver.resolveNumber(cred.phone, cred.country_code);
      if (resolved.operator && resolved.operator !== 'Unknown') op = resolved.operator;
      if (resolved.circle && resolved.circle !== 'Unknown') cir = resolved.circle;
    }
    op = op || 'Unknown';
    cir = cir || 'Unknown';
    const opState = `${cir}>${op}`;
    return `${cred.phone}\t${cred.password}\t${cred.type}\t${opState}`;
  });

  assert(
    downloadedLines[0] === '9203009600034\t03009600034a\tDP\tPakistan>Jazz',
    `Download Line 1 matches: ${downloadedLines[0]}`
  );
  assert(
    downloadedLines[1] === '9203112345678\t03112345678a\tDP\tPakistan>Zong',
    `Download Line 2 matches: ${downloadedLines[1]}`
  );
  assert(
    downloadedLines[2] === '2001068625770\t01068625770a\tBELL_VF\tEgypt>Vodafone',
    `Download Line 3 matches: ${downloadedLines[2]}`
  );
  assert(
    downloadedLines[3] === '919996426832\t9996426832&\tDP\tHaryana>Airtel',
    `Download Line 4 matches: ${downloadedLines[3]}`
  );

  // 3. Test verification against 92_all_credentials.txt
  const file92Path = 'E:\\steet and oparetor check\\92_all_credentials.txt';
  if (fs.existsSync(file92Path)) {
    const rawContent = fs.readFileSync(file92Path, 'utf8');
    const firstLines = rawContent.split(/\r?\n/).slice(0, 5).filter(Boolean);
    console.log(`\nVerifying first 5 lines of 92_all_credentials.txt with new resolution:`);
    firstLines.forEach(l => {
      const parts = l.split('\t');
      const phone = parts[0];
      const pwd = parts[1];
      const type = parts[2];
      const resolved = operatorResolver.resolveNumber(phone, '92');
      const enrichedLine = `${phone}\t${pwd}\t${type}\t${resolved.circle}>${resolved.operator}`;
      console.log(`  BEFORE: ${l}`);
      console.log(`  AFTER:  ${enrichedLine}`);
      assert(resolved.operator === 'Jazz' || resolved.operator === 'Zong' || resolved.operator === 'Ufone' || resolved.operator === 'Telenor', `Resolved ${phone} operator correctly: ${resolved.operator}`);
    });
  }

  console.log(`\n===================================`);
  console.log(`Test Summary: Passed: ${passed}, Failed: ${failed}`);
  console.log(`===================================`);

  process.exit(failed > 0 ? 1 : 0);
}

testCredentialsDownloadWithCircle().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
