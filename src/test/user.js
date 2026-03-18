const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const seed = async () => {
    await mongoose.connect('mongodb://admin:powerautomate@23.95.140.149:27017/admin');

    const users = [
        { name: 'Super Admin', email: 'admin@gmail.com', password: 'admin', role: 'superadmin', isActive: true },
    ];

    for (const userData of users) {
        const existing = await User.findOne({ email: userData.email });
        if (existing) {
            console.log(`Skipping ${userData.email} — already exists`);
            continue;
        }

        // Hash the password before saving
        const hashedPassword = await bcrypt.hash(userData.password, 10);

        const user = new User({ ...userData, password: hashedPassword });
        await user.save();
        console.log(`Created: ${user.email} (${user.role})`);
    }

    console.log('Done');
    process.exit(0);
};

seed().catch(err => {
    console.error(err);
    process.exit(1);
});