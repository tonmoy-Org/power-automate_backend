const PhoneNumber = require('../models/PhoneNumber');
const PhoneCredential = require('../models/PhoneCredential');

const createCredential = async (req, res) => {
    try {
        const { country_code, phone, password, type } = req.body;

        if (!country_code || !phone) {
            return res.status(400).json({
                message: "Country code and phone are required"
            });
        }

        // Check existing credential only
        const existingCredential = await PhoneCredential.findOne({
            country_code: country_code,
            phone: phone
        });

        if (existingCredential) {
            return res.status(400).json({
                message: "Credential with this country code and phone already exists"
            });
        }

        // Create credential directly
        const credential = await PhoneCredential.create({
            country_code,
            phone,
            password,
            type: type || 'default'
        });

        res.status(201).json({
            message: "Credential created successfully",
            data: credential
        });

    } catch (error) {

        if (error.code === 11000) {
            return res.status(400).json({
                message: "Duplicate credential: This country code and phone combination already exists"
            });
        }

        res.status(500).json({
            message: error.message
        });
    }
};

const getCredentials = async (req, res) => {
    try {
        const { country_code, phone } = req.query;
        let filter = {};

        if (country_code) {
            filter.country_code = country_code;
        }

        if (phone) {
            filter.phone = phone;
        }

        const credentials = await PhoneCredential
            .find(filter)
            .sort({ createdAt: -1 });

        res.json(credentials);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getCredentialById = async (req, res) => {
    try {
        const credential = await PhoneCredential
            .findById(req.params.id);

        if (!credential) {
            return res.status(404).json({ message: "Credential not found" });
        }

        res.json(credential);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateCredential = async (req, res) => {
    try {
        const { country_code, phone, password, type } = req.body;

        if (country_code || phone) {
            const newCountryCode = country_code || req.body.country_code;
            const newPhone = phone || req.body.phone;

            const phoneExists = await PhoneNumber.findOne({
                country_code: newCountryCode,
                phone: newPhone
            });

            if (!phoneExists) {
                return res.status(404).json({
                    message: "The specified phone number does not exist in the system"
                });
            }

            const existingCredential = await PhoneCredential.findOne({
                country_code: newCountryCode,
                phone: newPhone,
                _id: { $ne: req.params.id }
            });

            if (existingCredential) {
                return res.status(400).json({
                    message: "Duplicate credential: This country code and phone combination already exists"
                });
            }
        }

        const credential = await PhoneCredential.findByIdAndUpdate(
            req.params.id,
            { country_code, phone, password, type },
            { new: true, runValidators: true }
        );

        if (!credential) {
            return res.status(404).json({ message: "Credential not found" });
        }

        res.json({
            message: "Credential updated successfully",
            data: credential
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                message: "Duplicate credential: This country code and phone combination already exists"
            });
        }
        res.status(500).json({ message: error.message });
    }
};

const deleteCredential = async (req, res) => {
    try {
        const credential = await PhoneCredential.findByIdAndDelete(req.params.id);

        if (!credential) {
            return res.status(404).json({ message: "Credential not found" });
        }

        res.json({ message: "Credential deleted successfully" });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createCredential,
    getCredentials,
    getCredentialById,
    updateCredential,
    deleteCredential
};