const PhoneNumber = require("../models/PhoneNumber");
const PhoneCredential = require("../models/PhoneCredential");

const createCredential = async (req, res) => {
  try {
    const { country_code, phone, password, type, operator, circle } = req.body;

    if (!country_code || !phone) {
      return res.status(400).json({
        message: "Country code and phone are required",
      });
    }

    const updateData = {
      country_code,
      phone,
      password,
      type: type || "default",
      operator,
      circle
    };

    const credential = await PhoneCredential.findOneAndUpdate(
      { country_code, phone },
      { $set: updateData },
      { new: true, upsert: true }
    );

    res.status(201).json({
      message: "Credential saved successfully",
      data: credential,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const getCredentials = async (req, res) => {
  try {
    const { country_code, exclude_country_code, phone } = req.query;
    let filter = {};

    if (country_code) {
      filter.country_code = country_code;
    } else if (exclude_country_code) {
      filter.country_code = { $ne: exclude_country_code };
    }
    if (phone) filter.phone = phone;

    const credentials = await PhoneCredential.find(filter)
      .select('country_code phone password type operator circle createdAt')
      .sort({ createdAt: -1 })
      .lean();

    res.json(credentials);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCredentialById = async (req, res) => {
  try {
    const credential = await PhoneCredential.findById(req.params.id).lean();

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
    const { country_code, phone, password, type, operator, circle } = req.body;

    if (country_code || phone) {
      const newCountryCode = country_code || req.body.country_code;
      const newPhone = phone || req.body.phone;

      const phoneExists = await PhoneNumber.findOne({
        country_code: newCountryCode,
        phone: newPhone,
      });

      if (!phoneExists) {
        return res.status(404).json({
          message: "The specified phone number does not exist in the system",
        });
      }

      const existingCredential = await PhoneCredential.findOne({
        country_code: newCountryCode,
        phone: newPhone,
        _id: { $ne: req.params.id },
      });

      if (existingCredential) {
        return res.status(400).json({
          message:
            "Duplicate credential: This country code and phone combination already exists",
        });
      }
    }

    const updateFields = { country_code, phone, password, type, operator, circle };

    const credential = await PhoneCredential.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true },
    );

    if (!credential) {
      return res.status(404).json({ message: "Credential not found" });
    }

    res.json({
      message: "Credential updated successfully",
      data: credential,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message:
          "Duplicate credential: This country code and phone combination already exists",
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

const bulkDeleteCredentials = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        message: "Please provide an array of credential IDs to delete",
      });
    }

    const result = await PhoneCredential.deleteMany({
      _id: { $in: ids },
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        message: "No credentials found with the provided IDs",
      });
    }

    res.json({
      message: `Successfully deleted ${result.deletedCount} credential(s)`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteCredentialsByTypeAndCountry = async (req, res) => {
  try {
    const { type, countryCode } = req.body;

    if (!type || !countryCode) {
      return res.status(400).json({
        message: "Type and countryCode are required",
      });
    }

    const result = await PhoneCredential.deleteMany({
      type: type,
      country_code: countryCode,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        message: `No Type ${type} credentials found for Country Code ${countryCode}`,
      });
    }

    res.json({
      message: `Successfully deleted ${result.deletedCount} Type ${type} credential(s) for Country Code ${countryCode}`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createCredential,
  getCredentials,
  getCredentialById,
  updateCredential,
  deleteCredential,
  bulkDeleteCredentials,
  deleteCredentialsByTypeAndCountry,
};