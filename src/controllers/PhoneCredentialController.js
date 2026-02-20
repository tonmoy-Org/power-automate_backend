const PhoneNumber = require('../models/PhoneNumber');
const PhoneCredential = require('../models/PhoneCredential');

const createCredential = async (req, res) => {
    try {
        const { pa_id, phone, password, type } = req.body;

        const paRecord = await PhoneNumber.findOne({ pa_id });
        if (!paRecord) {
            return res.status(404).json({ message: "PA_ID not found" });
        }

        const existingCredential = await PhoneCredential.findOne({
            pa_id: pa_id,
            phone: phone
        });

        if (existingCredential) {
            return res.status(400).json({
                message: "Credential with this phone already exists for this PA"
            });
        }

        const credential = await PhoneCredential.create({
            pa_id: pa_id,
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
                message: "Duplicate credential: This phone already exists for this PA"
            });
        }
        res.status(500).json({ message: error.message });
    }
};

const getCredentials = async (req, res) => {
    try {
        const { pa_id } = req.query;

        let filter = {};

        if (pa_id) {
            const paRecord = await PhoneNumber.findOne({ pa_id });
            if (!paRecord) {
                return res.status(404).json({ message: "PA_ID not found" });
            }
            filter.pa_id = pa_id;
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
        const { phone, password, type } = req.body;

        const credential = await PhoneCredential.findByIdAndUpdate(
            req.params.id,
            { phone, password, type },
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
                message: "Duplicate credential: This phone already exists for this PA"
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