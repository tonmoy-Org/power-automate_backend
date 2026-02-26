const mongoose = require('mongoose');
const PhoneNumber = require('../models/PhoneNumber');

const deleteAll = async () => {
  try {
    await mongoose.connect(
      'mongodb+srv://Vercel-Admin-atlas-orange-dog:4p3RNZSxbs3ulp70@atlas-orange-dog.qvqvlxw.mongodb.net/?retryWrites=true&w=majority'
    );

    console.log('MongoDB Connected');

    // Delete Phone Numbers
    const phoneResult = await PhoneNumber.deleteMany({});
    console.log(`Deleted ${phoneResult.deletedCount} phone numbers`);

    console.log('All data deleted successfully');

    process.exit(0);

  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

deleteAll();