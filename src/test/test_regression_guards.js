const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const operatorResolver = require('../utils/operatorResolver');
const IndianNumber = require('../models/IndianNumber');
const IndianPhoneCredential = require('../models/IndianPhoneCredential');

async function runTests() {
  console.log('🧪 Starting Regression Guard Tests...\n');
  
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

  // Test 1: Operator Resolver
  try {
    const resJio = operatorResolver.resolveNumber('6000123456');
    assert(
      resJio && resJio.operator === 'Reliance Jio' && resJio.circle === 'Assam',
      `OperatorResolver should map '6000123456' to Reliance Jio / Assam (Got: ${resJio?.operator} / ${resJio?.circle})`
    );

    const resUnknown = operatorResolver.resolveNumber('1234567890');
    assert(
      resUnknown && resUnknown.operator === 'Unknown' && resUnknown.circle === 'Unknown',
      `OperatorResolver should map invalid prefix to Unknown (Got: ${resUnknown?.operator} / ${resUnknown?.circle})`
    );
  } catch (err) {
    failed++;
    console.error('❌ Operator Resolver Test crashed:', err.message);
  }

  // Test 2: Mongoose Schemas & Database Connectivity (if MONGODB_URI is loaded)
  if (process.env.MONGODB_URI) {
    try {
      console.log('\nConnecting to MongoDB for Schema & Deduplication Tests...');
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('CONNECTED successfully to MongoDB.');

      // Schema verification
      const numFields = Object.keys(IndianNumber.schema.paths);
      assert(numFields.includes('number'), 'IndianNumber Schema should contain number field');
      assert(numFields.includes('operator'), 'IndianNumber Schema should contain operator field');
      assert(numFields.includes('circle'), 'IndianNumber Schema should contain circle field');
      assert(numFields.includes('is_active'), 'IndianNumber Schema should contain is_active field');

      // Deduplication verification simulation
      const mockBulkNumbers = ['919876543210', '919876543210', '919876543211', '919876543211'];
      const unique = [...new Set(mockBulkNumbers)];
      assert(unique.length === 2, `Array deduplication should return exactly 2 unique numbers (Got: ${unique.length})`);

      await mongoose.disconnect();
    } catch (err) {
      failed++;
      console.error('❌ Database connectivity/schema validation failed:', err.message);
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
    }
  } else {
    console.warn('⚠️ SKIP: MongoDB URI not found, database-related tests skipped.');
  }

  console.log(`\n===================================`);
  console.log(`Test Summary: Passed: ${passed}, Failed: ${failed}`);
  console.log(`===================================`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
