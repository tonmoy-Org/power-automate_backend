const mongoose = require('mongoose');
const User = require('../models/User');

const seed = async () => {
    await mongoose.connect('mongodb+srv://Vercel-Admin-atlas-indigo-mountain:iRZa21avCUKzwo6o@atlas-indigo-mountain.wacqtgn.mongodb.net/?retryWrites=true&w=majority');

    const users = [
        { name: 'Super Admin',   email: 'admin@gmail.com', password: 'admin', role: 'superadmin', isActive: true },
    ];

    for (const userData of users) {
        const existing = await User.findOne({ email: userData.email });
        if (existing) {
            console.log(`Skipping ${userData.email} — already exists`);
            continue;
        }
        const user = new User(userData);
        await user.save(); // triggers pre-save hooks (password hashing)
        console.log(`Created: ${user.email} (${user.role})`);
    }

    console.log('Done');
    process.exit(0);
};

seed().catch(err => {
    console.error(err);
    process.exit(1);
});