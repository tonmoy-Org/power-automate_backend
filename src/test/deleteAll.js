const mongoose = require('mongoose');
const User = require('../models/User');

const deleteAll = async () => {
    await mongoose.connect('mongodb+srv://Vercel-Admin-atlas-indigo-mountain:iRZa21avCUKzwo6o@atlas-indigo-mountain.wacqtgn.mongodb.net/?retryWrites=true&w=majority');

    const result = await User.deleteMany({});
    console.log(`Deleted ${result.deletedCount} users`);

    process.exit(0);
};

deleteAll().catch(err => {
    console.error(err);
    process.exit(1);
});