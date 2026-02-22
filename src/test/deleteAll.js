const mongoose = require('mongoose');
const PhoneNumber = require('../models/PhoneNumber');
const PhoneCredential = require('../models/PhoneCredential');

const deleteAll = async () => {
  try {
    await mongoose.connect(
      'mongodb+srv://Vercel-Admin-atlas-indigo-mountain:iRZa21avCUKzwo6o@atlas-indigo-mountain.wacqtgn.mongodb.net/?retryWrites=true&w=majority'
    );

    console.log('MongoDB Connected');

    // Delete Phone Numbers
    const phoneResult = await PhoneNumber.deleteMany({});
    console.log(`Deleted ${phoneResult.deletedCount} phone numbers`);

    // Delete Credentials
    const credentialResult = await PhoneCredential.deleteMany({});
    console.log(`Deleted ${credentialResult.deletedCount} credentials`);

    console.log('All data deleted successfully');

    process.exit(0);

  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

deleteAll();