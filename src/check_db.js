const { MongoClient } = require('mongodb');
const uri = 'mongodb://admin:powerautomate@127.0.0.1:27017/admin?authSource=admin';
const client = new MongoClient(uri);
async function run() {
  try {
    await client.connect();
    const db = client.db('admin');
    
    // Find some running numbers
    const running = await db.collection('indiannumbers').find({ is_active: 'running' }).limit(5).toArray();
    console.log("Sample running numbers:", running.map(n => ({
      _id: n._id,
      number: n.number,
      updatedAt: n.updatedAt,
      createdAt: n.createdAt
    })));
    
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}
run();
