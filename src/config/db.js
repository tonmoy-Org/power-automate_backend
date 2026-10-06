const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    const conn = await mongoose.connect(mongoUri, {
      maxPoolSize: 200,           // Up from default 100 for 10K RDP scale
      minPoolSize: 20,            // Keep 20 warm connections ready
      socketTimeoutMS: 30000,     // 30s socket timeout (prevent hung connections)
      serverSelectionTimeoutMS: 10000, // 10s server selection timeout
      maxIdleTimeMS: 60000,       // Close idle connections after 60s
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = { connectDB };