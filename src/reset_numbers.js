const { MongoClient } = require('mongodb');
const uri = 'mongodb://admin:powerautomate@127.0.0.1:27017/admin?authSource=admin';
const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    const db = client.db('admin');
    
    // Reset running indiannumbers to inactive
    const result1 = await db.collection('indiannumbers').updateMany(
      { is_active: 'running' },
      { $set: { is_active: 'inactive', rdp_id: null } }
    );
    console.log(`Reset ${result1.modifiedCount} running Indian numbers to inactive.`);

    // Reset running global phonenumbers to inactive
    const result2 = await db.collection('phonenumbers').updateMany(
      { is_active: 'running' },
      { $set: { is_active: 'inactive', rdp_id: null } }
    );
    console.log(`Reset ${result2.modifiedCount} running global phone numbers to inactive.`);
    
  } catch (err) {
    console.error('Error resetting numbers:', err);
  } finally {
    await client.close();
  }
}
run();
