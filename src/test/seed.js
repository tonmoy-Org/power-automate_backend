const mongoose = require('mongoose');
const PhoneCredential = require('../models/PhoneCredential');

const seed = async () => {
    try {
        await mongoose.connect('mongodb+srv://Vercel-Admin-atlas-orange-dog:4p3RNZSxbs3ulp70@atlas-orange-dog.qvqvlxw.mongodb.net/?retryWrites=true&w=majority');

        // Clear existing data
        // await PhoneCredential.deleteMany({});
        // console.log('Cleared existing credentials');

        const dummyData = [];
        const countryCode = '91'; // Same country code for all entries
        const types = ['A', 'B', 'C', 'D', 'E'];
        
        // Generate 200 dummy entries with same country code
        for (let i = 0; i < 800; i++) {
            // Generate random 8-10 digit phone number
            const phoneLength = Math.floor(Math.random() * 3) + 8; // 8-10 digits
            let phone = '';
            for (let j = 0; j < phoneLength; j++) {
                phone += Math.floor(Math.random() * 10).toString();
            }
            
            // Generate random password (8-12 characters)
            const passwordLength = Math.floor(Math.random() * 5) + 8; // 8-12 chars
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
            let password = '';
            for (let j = 0; j < passwordLength; j++) {
                password += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            
            dummyData.push({
                country_code: countryCode,
                phone: phone,
                password: password,
                type: types[Math.floor(Math.random() * types.length)],
                createdAt: new Date(Date.now() - Math.floor(Math.random() * 90) * 24 * 60 * 60 * 1000) // Random date within last 90 days
            });
        }

        // Add some sequential test data for easy identification
        for (let i = 1; i <= 20; i++) {
            dummyData.push({
                country_code: countryCode,
                phone: `98765432${i.toString().padStart(2, '0')}`, // 9876543201, 9876543202, etc.
                password: `Test@Password${i}`,
                type: types[i % types.length],
                createdAt: new Date()
            });
        }

        // Shuffle the array to mix random and sequential data
        for (let i = dummyData.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [dummyData[i], dummyData[j]] = [dummyData[j], dummyData[i]];
        }

        await PhoneCredential.insertMany(dummyData);
        
        // Count by type
        const typeCounts = {};
        dummyData.forEach(item => {
            typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
        });

        console.log('=================================');
        console.log('✅ 200 dummy credentials inserted successfully');
        console.log('=================================');
        console.log(`Country Code: +${countryCode}`);
        console.log('---------------------------------');
        console.log('Distribution by type:');
        Object.entries(typeCounts).forEach(([type, count]) => {
            console.log(`  Type ${type}: ${count} entries (${Math.round(count/220*100)}%)`);
        });
        console.log('=================================');
        console.log('Sample entries:');
        console.log('---------------------------------');
        
        // Show 5 random samples
        const samples = dummyData.sort(() => 0.5 - Math.random()).slice(0, 5);
        samples.forEach((item, index) => {
            console.log(`${index + 1}. +${item.country_code} ${item.phone} (Type ${item.type}) - ${item.password}`);
        });
        console.log('=================================');

        process.exit(0);

    } catch (error) {
        console.error('Seed Error:', error);
        process.exit(1);
    }
};

seed();