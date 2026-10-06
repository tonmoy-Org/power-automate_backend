const { MongoClient } = require('mongodb');
const uri = 'mongodb://admin:powerautomate@127.0.0.1:27017/admin?authSource=admin';
const client = new MongoClient(uri);
async function run() {
  try {
    await client.connect();
    const db = client.db('admin');
    const counts = await db.collection('indiannumbers').aggregate([
      { $group: { _id: '$is_active', count: { $sum: 1 } } }
    ]).toArray();
    console.log("Indian numbers counts:", counts);
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}
run();
