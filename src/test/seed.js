const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const PasswordFormatter = require('../models/PasswordFormatter');
const PhoneNumber = require('../models/PhoneNumber');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const clearPasswordFormatters = async () => {
    try {
        console.log('--------------------------------------------');
        console.log('🗑️  Starting PasswordFormatter Drop operation...');
        
        // 1. Clear references in PhoneNumbers first
        console.log('🧹 Removing references from all PhoneNumbers...');
        const updateResult = await PhoneNumber.updateMany(
            {}, 
            { $set: { password_formatters: [] } }
        );
        console.log(`✅ References cleared from ${updateResult.modifiedCount} phone numbers.`);

        // 2. Drop all formatters
        console.log('🔥 Dropping all PasswordFormatter documents...');
        const deleteResult = await PasswordFormatter.deleteMany({});
        console.log(`✅ Successfully deleted ${deleteResult.deletedCount} formatters.`);
        
        console.log('✨ Operation completed successfully.');
        console.log('--------------------------------------------');
    } catch (error) {
        console.error('❌ Error during drop operation:', error);
        throw error;
    }
};

const run = async () => {
    if (!process.env.MONGODB_URI) {
        console.error('❌ Error: MONGODB_URI not found in environment variables.');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('📡 Connected to MongoDB.');

        await clearPasswordFormatters();

        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB.');
        process.exit(0);
    } catch (error) {
        process.exit(1);
    }
};

run();
