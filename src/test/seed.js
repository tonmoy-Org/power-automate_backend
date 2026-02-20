const mongoose = require('mongoose');
const PhoneNumber = require('../models/PhoneNumber');
const PhoneCredential = require('../models/PhoneCredential');

const seed = async () => {
    await mongoose.connect('mongodb://localhost:27017/financeDB');

    let pa = await PhoneNumber.findOne({ pa_id: 'PA_102' });
    if (!pa) {
        console.log('PA_102 not found');
        process.exit(1);
    }

    const dummyData = [
        { pa_id: 'PA_102', phone: '01711000001', password: 'pass1234', type: 'A' },
        { pa_id: 'PA_102', phone: '01711000002', password: 'pass5678', type: 'B' },
        { pa_id: 'PA_102', phone: '01711000003', password: 'pass9012', type: 'C' },
        { pa_id: 'PA_102', phone: '01711000004', password: 'pass3456', type: 'A' },
        { pa_id: 'PA_102', phone: '01711000005', password: 'pass7890', type: 'B' },
    ];

    await PhoneCredential.insertMany(dummyData);
    console.log('Dummy data inserted for PA_102');
    process.exit(0);
};

seed().catch(err => {
    console.error(err);
    process.exit(1);
});