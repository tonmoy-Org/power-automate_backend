const mongoose = require('mongoose');
const PhoneCredential = require('../models/PhoneCredential');

const seed = async () => {
    try {

        await mongoose.connect('mongodb://localhost:27017/financeDB');

        const dummyData = [
            { country_code: '91', phone: '42345345', password: 'pass1234', type: 'A' },
            { country_code: '91', phone: '45451345', password: 'pass5678', type: 'B' },
            { country_code: '91', phone: '45344345', password: 'pass9012', type: 'C' },
            { country_code: '91', phone: '45345045', password: 'pass3456', type: 'A' },
            { country_code: '91', phone: '45342345', password: 'pass7890', type: 'B' },
        ];

        await PhoneCredential.insertMany(dummyData);

        console.log('Dummy credentials inserted successfully');

        process.exit(0);

    } catch (error) {

        console.error('Seed Error:', error);

        process.exit(1);
    }
};

seed();