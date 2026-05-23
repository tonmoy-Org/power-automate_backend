const IndianNumber = require("../models/IndianNumber");
const IndianPhoneCredential = require("../models/IndianPhoneCredential");

// Create or update Indian credential
const createCredential = async (req, res) => {
  try {
    const { phone, password, type, operator, circle } = req.body;
    const country_code = "91"; // Forced to Indian country code

    if (!phone) {
      return res.status(400).json({
        message: "Phone number is required",
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

    const credential = await IndianPhoneCredential.findOneAndUpdate(
      { phone },
      { $set: updateData },
      { new: true, upsert: true }
    );

    res.status(201).json({
      message: "Indian credential saved successfully",
      data: credential,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// Get Indian credentials
const getCredentials = async (req, res) => {
  try {
    const { phone, summary } = req.query;
    let filter = {
      circle: { $exists: true, $ne: "" },
      operator: { $exists: true, $ne: "" }
    };

    if (phone) filter.phone = phone;

    if (summary === 'true') {
      const summaryData = await IndianPhoneCredential.aggregate([
        { $match: filter },
        {
          $group: {
            _id: { circle: "$circle", operator: "$operator", type: "$type" },
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            circle: "$_id.circle",
            operator: "$_id.operator",
            type: "$_id.type",
            count: "$count"
          }
        }
      ]);
      return res.json({ summary: true, data: summaryData });
    }

    const credentials = await IndianPhoneCredential.find(filter)
      .select('phone password type operator circle createdAt')
      .sort({ createdAt: -1 })
      .lean();

    res.json(credentials);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Indian credential by ID
const getCredentialById = async (req, res) => {
  try {
    const credential = await IndianPhoneCredential.findById(req.params.id).lean();

    if (!credential) {
      return res.status(404).json({ message: "Credential not found" });
    }

    res.json(credential);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Indian credential
const updateCredential = async (req, res) => {
  try {
    const { phone, password, type, operator, circle } = req.body;
    const country_code = "91";

    if (phone) {
      // Check if Indian number exists in system
      const phoneExists = await IndianNumber.findOne({
        number: phone,
      });

      if (!phoneExists) {
        return res.status(404).json({
          message: "The specified Indian phone number does not exist in the system",
        });
      }

      const existingCredential = await IndianPhoneCredential.findOne({
        phone,
        _id: { $ne: req.params.id },
      });

      if (existingCredential) {
        return res.status(400).json({
          message:
            "Duplicate credential: This phone number already exists",
        });
      }
    }

    const updateFields = { country_code, phone, password, type, operator, circle };

    // Clean undefined fields so they aren't overwritten as undefined if not passed
    Object.keys(updateFields).forEach(
      (key) => updateFields[key] === undefined && delete updateFields[key]
    );

    const credential = await IndianPhoneCredential.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
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
          "Duplicate credential: This phone number already exists",
      });
    }
    res.status(500).json({ message: error.message });
  }
};

// Delete single Indian credential
const deleteCredential = async (req, res) => {
  try {
    const credential = await IndianPhoneCredential.findByIdAndDelete(req.params.id);

    if (!credential) {
      return res.status(404).json({ message: "Credential not found" });
    }

    res.json({ message: "Credential deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Bulk delete Indian credentials
const bulkDeleteCredentials = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        message: "Please provide an array of credential IDs to delete",
      });
    }

    const result = await IndianPhoneCredential.deleteMany({
      _id: { $in: ids }
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        message: "No Indian credentials found with the provided IDs",
      });
    }

    res.json({
      message: `Successfully deleted ${result.deletedCount} Indian credential(s)`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete credentials by type
const deleteCredentialsByType = async (req, res) => {
  try {
    const { type } = req.body;

    if (!type) {
      return res.status(400).json({
        message: "Type is required",
      });
    }

    const result = await IndianPhoneCredential.deleteMany({
      type: type
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        message: `No Type ${type} Indian credentials found`,
      });
    }

    res.json({
      message: `Successfully deleted ${result.deletedCount} Type ${type} Indian credential(s)`,
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
  deleteCredentialsByType,
};
