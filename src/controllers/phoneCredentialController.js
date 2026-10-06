const PhoneNumber = require("../models/PhoneNumber");
const PhoneCredential = require("../models/PhoneCredential");
const cache = require("../utils/cache");
const googleSheets = require("../utils/googleSheets");
const operatorResolver = require("../utils/operatorResolver");

const createCredential = async (req, res) => {
  try {
    const { country_code, phone, password, type, operator, circle } = req.body;
    const userId = req.user.id;

    if (!country_code || !phone) {
      return res.status(400).json({
        message: "Country code and phone are required",
      });
    }

    let resolvedOperator = operator;
    let resolvedCircle = circle;
    let resolvedPrefix = country_code;

    const resolved = operatorResolver.resolveNumber(phone, country_code);
    resolvedPrefix = resolved.prefix || country_code;
    resolvedOperator = (operator && operator !== 'Unknown') ? operator : resolved.operator;
    resolvedCircle = (circle && circle !== 'Unknown') ? circle : resolved.circle;

    const updateData = {
      country_code,
      phone,
      password,
      type: type || "default",
      operator: resolvedOperator,
      circle: resolvedCircle,
      userId
    };

    // Check if credential already exists with identical password & type
    const existing = await PhoneCredential.findOne({ country_code, phone, userId }).select('password type').lean();
    const isNewOrUpdated = !existing || existing.password !== password || existing.type !== (type || "default");

    const credential = await PhoneCredential.findOneAndUpdate(
      { country_code, phone, userId },
      { $set: updateData },
      { new: true, upsert: true }
    );

    // Always push to Google Sheets after DB upsert unless already pushed with same pass/type.
    // Dedup guard inside googleSheets.pushCredential() prevents duplicate sheet rows.
    if (isNewOrUpdated) {
      googleSheets.pushCredential({
        country_code: credential.country_code,
        phone: credential.phone,
        password: credential.password,
        type: credential.type,
        prefix: resolvedPrefix,
        operator: credential.operator,
        circle: credential.circle
      }).catch(err => console.error("[PhoneCredential] Google Sheets push error:", err));
    }

    res.status(201).json({
      message: "Credential saved successfully",
      data: credential,
    });
  } catch (error) {
    res.status(200).json({
      message: error.message,
    });
  }
};

const getCredentials = async (req, res) => {
  try {
    const { country_code, exclude_country_code, phone, aggregate, search } = req.query;

    const cacheKey = req.query.userId || req.user.id;
    if (aggregate === 'true') {
      if (!search && req.user.role === 'superadmin') {
        const cached = cache.getPhoneCredentialsCache(cacheKey);
        if (cached) {
          return res.json(cached);
        }
      }

      const andConditions = [];
      if (req.user.role !== 'superadmin') {
        andConditions.push({ userId: req.user.id });
      } else if (req.query.userId) {
        if (req.query.userId !== 'all') {
          andConditions.push({ userId: req.query.userId });
        }
      } else {
        andConditions.push({ userId: req.user.id });
      }

      if (country_code) {
        andConditions.push({ country_code });
      } else if (exclude_country_code) {
        andConditions.push({ country_code: { $ne: exclude_country_code } });
      }

      if (search) {
        const regex = new RegExp(search, 'i');
        andConditions.push({
          $or: [
            { phone: regex },
            { password: regex },
            { type: regex },
            { operator: regex },
            { circle: regex }
          ]
        });
      }

      const matchFilter = andConditions.length > 0
        ? (andConditions.length === 1 ? andConditions[0] : { $and: andConditions })
        : {};

      const [
        totalCountResult,
        typeAggResult,
        operatorAggResult,
        countryAggResult,
        cardsAggResult
      ] = await Promise.all([
        PhoneCredential.countDocuments(matchFilter),
        PhoneCredential.aggregate([
          { $match: matchFilter },
          { $group: { _id: "$type", count: { $sum: 1 } } },
          { $sort: { _id: 1 } }
        ]),
        PhoneCredential.aggregate([
          { $match: matchFilter },
          { $group: { _id: "$operator", count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        PhoneCredential.aggregate([
          { $match: matchFilter },
          { $group: { _id: "$country_code", count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        PhoneCredential.aggregate([
          { $match: matchFilter },
          {
            $group: {
              _id: {
                country_code: "$country_code",
                type: "$type",
                operator: "$operator",
                circle: "$circle"
              },
              count: { $sum: 1 }
            }
          }
        ])
      ]);

      const totalCount = totalCountResult;
      const typeSummary = typeAggResult.map(t => ({ type: t._id || 'Unknown', count: t.count }));
      const operatorSummary = operatorAggResult.map(o => ({ label: o._id || 'Unknown', count: o.count }));
      const countrySummary = countryAggResult.map(c => ({ label: c._id || 'Unknown', count: c.count }));
      const cardsAgg = cardsAggResult;

      const countriesMap = {};
      cardsAgg.forEach(item => {
        const cCode = item._id.country_code || 'Unknown';
        const typeName = item._id.type || 'Unknown';
        const opName = item._id.operator || '';
        const circleName = item._id.circle || '';
        const count = item.count;

        if (!countriesMap[cCode]) {
          countriesMap[cCode] = {
            countryCode: cCode,
            count: 0,
            typesMap: {}
          };
        }

        countriesMap[cCode].count += count;

        if (!countriesMap[cCode].typesMap[typeName]) {
          countriesMap[cCode].typesMap[typeName] = {
            type: typeName,
            count: 0,
            operatorsMap: {},
            circlesMap: {}
          };
        }

        countriesMap[cCode].typesMap[typeName].count += count;

        if (opName) {
          if (!countriesMap[cCode].typesMap[typeName].operatorsMap[opName]) {
            countriesMap[cCode].typesMap[typeName].operatorsMap[opName] = 0;
          }
          countriesMap[cCode].typesMap[typeName].operatorsMap[opName] += count;
        }

        if (circleName) {
          if (!countriesMap[cCode].typesMap[typeName].circlesMap[circleName]) {
            countriesMap[cCode].typesMap[typeName].circlesMap[circleName] = 0;
          }
          countriesMap[cCode].typesMap[typeName].circlesMap[circleName] += count;
        }
      });

      const countries = Object.values(countriesMap).map(c => {
        const types = Object.values(c.typesMap).map(t => {
          const operators = Object.entries(t.operatorsMap).map(([operator, count]) => ({
            operator,
            count
          })).sort((a, b) => b.count - a.count);

          const circles = Object.entries(t.circlesMap).map(([circle, count]) => ({
            circle,
            count
          })).sort((a, b) => b.count - a.count);

          return {
            type: t.type,
            count: t.count,
            operators,
            circles
          };
        }).sort((a, b) => a.type.localeCompare(b.type));

        return {
          countryCode: c.countryCode,
          count: c.count,
          types
        };
      }).sort((a, b) => b.count - a.count);

      const responseData = {
        totalCount,
        summary: {
          typeSummary,
          operatorSummary,
          countrySummary
        },
        countries
      };

      if (!search && req.user.role === 'superadmin') {
        cache.setPhoneCredentialsCache(cacheKey, responseData);
      }

      return res.json(responseData);
    }

    let filter = {};
    if (req.user.role !== 'superadmin') {
      filter.userId = req.user.id;
    } else if (req.query.userId) {
      if (req.query.userId !== 'all') {
        filter.userId = req.query.userId;
      }
    } else {
      filter.userId = req.user.id;
    }
    if (country_code) {
      filter.country_code = country_code;
    } else if (exclude_country_code) {
      filter.country_code = { $ne: exclude_country_code };
    }
    if (phone) filter.phone = phone;

    const listCacheKey = `raw_list_${req.query.userId || req.user.id}_${country_code || 'all'}_${exclude_country_code || 'none'}_${phone || 'all'}`;
    if (!phone && req.user.role === 'superadmin') {
      const cached = cache.getPhoneCredentialsCache(listCacheKey);
      if (cached) return res.json(cached);
    }

    const credentials = await PhoneCredential.find(filter)
      .select('country_code phone password type operator circle createdAt')
      .sort({ createdAt: -1 })
      .lean();

    if (!phone && req.user.role === 'superadmin') {
      cache.setPhoneCredentialsCache(listCacheKey, credentials, 3000);
    }

    res.json(credentials);
  } catch (error) {
    res.status(200).json({ message: error.message });
  }
};

const getCredentialById = async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.user.role !== 'superadmin') {
      query.userId = req.user.id;
    }

    const credential = await PhoneCredential.findOne(query).lean();

    if (!credential) {
      return res.status(404).json({ message: "Credential not found" });
    }

    res.json(credential);
  } catch (error) {
    res.status(200).json({ message: error.message });
  }
};

const updateCredential = async (req, res) => {
  try {
    const { country_code, phone, password, type, operator, circle } = req.body;

    if (country_code || phone) {
      const newCountryCode = country_code || req.body.country_code;
      const newPhone = phone || req.body.phone;

      const phoneQuery = {
        country_code: newCountryCode,
        phone: newPhone,
      };
      if (req.user.role !== 'superadmin') {
        phoneQuery.userId = req.user.id;
      }

      const phoneExists = await PhoneNumber.findOne(phoneQuery);

      if (!phoneExists) {
        return res.status(404).json({
          message: "The specified phone number does not exist in the system",
        });
      }

      const duplicateQuery = {
        country_code: newCountryCode,
        phone: newPhone,
        _id: { $ne: req.params.id }
      };
      if (req.user.role !== 'superadmin') {
        duplicateQuery.userId = req.user.id;
      }

      const existingCredential = await PhoneCredential.findOne(duplicateQuery);

      if (existingCredential) {
        return res.status(400).json({
          message:
            "Duplicate credential: This country code and phone combination already exists",
        });
      }
    }

    const query = { _id: req.params.id };
    if (req.user.role !== 'superadmin') {
      query.userId = req.user.id;
    }

    const existing = await PhoneCredential.findOne(query);
    if (!existing) {
      return res.status(404).json({ message: "Credential not found" });
    }

    const resolvedPrefix = country_code !== undefined ? country_code : existing.country_code;
    const checkPhone = phone !== undefined ? phone : existing.phone;
    let resolvedOperator = operator !== undefined ? operator : existing.operator;
    let resolvedCircle = circle !== undefined ? circle : existing.circle;

    const resolved = operatorResolver.resolveNumber(checkPhone, resolvedPrefix);
    if (operator === undefined && resolved.operator && resolved.operator !== 'Unknown') resolvedOperator = resolved.operator;
    if (circle === undefined && resolved.circle && resolved.circle !== 'Unknown') resolvedCircle = resolved.circle;

    const isDifferent = (password !== undefined && existing.password !== password) ||
      (phone !== undefined && existing.phone !== phone) ||
      (country_code !== undefined && existing.country_code !== country_code);

    const updateFields = {
      country_code,
      phone,
      password,
      type,
      operator: resolvedOperator,
      circle: resolvedCircle
    };

    const credential = await PhoneCredential.findOneAndUpdate(
      query,
      updateFields,
      { new: true, runValidators: true },
    );

    if (isDifferent) {
      const resolved = operatorResolver.resolveNumber(credential.phone, credential.country_code);
      const pushPrefix = resolved.prefix || credential.country_code;
      googleSheets.pushCredential({
        country_code: credential.country_code,
        phone: credential.phone,
        password: credential.password,
        type: credential.type,
        prefix: pushPrefix,
        operator: credential.operator || resolved.operator,
        circle: credential.circle || resolved.circle
      }).catch(err => console.error("Google Sheets live push background error:", err));
    } else {
      console.log(`[PhoneCredential] Skipping Google Sheets push for ID ${req.params.id} - no password, phone or country code change`);
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
    res.status(200).json({ message: error.message });
  }
};

const deleteCredential = async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.user.role !== 'superadmin') {
      query.userId = req.user.id;
    }

    const credential = await PhoneCredential.findOneAndDelete(query);

    if (!credential) {
      return res.status(404).json({ message: "Credential not found" });
    }

    res.json({ message: "Credential deleted successfully" });
  } catch (error) {
    res.status(200).json({ message: error.message });
  }
};

const bulkDeleteCredentials = async (req, res) => {
  try {
    const { ids, countryCode, type, operator, circle, deleteAll } = req.body;
    let filter = {};
    if (req.user.role !== 'superadmin') {
      filter.userId = req.user.id;
    }

    if (deleteAll) {
      // Delete all
    } else if (ids && Array.isArray(ids) && ids.length > 0) {
      filter._id = { $in: ids };
    } else if (countryCode || type || operator || circle) {
      if (countryCode) filter.country_code = countryCode;
      if (type) filter.type = type;
      if (operator) filter.operator = operator;
      if (circle) filter.circle = circle;
    } else if (req.user.role === 'superadmin') {
      return res.status(400).json({
        message: "Please provide ids, criteria (countryCode, type, operator, circle), or deleteAll",
      });
    }

    const result = await PhoneCredential.deleteMany(filter);

    res.json({
      message: `Successfully deleted ${result.deletedCount} credential(s)`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(200).json({ message: error.message });
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

    const query = {
      type: type,
      country_code: countryCode,
    };
    if (req.user.role !== 'superadmin') {
      query.userId = req.user.id;
    }

    const result = await PhoneCredential.deleteMany(query);

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
    res.status(200).json({ message: error.message });
  }
};

const downloadCredentials = async (req, res) => {
  try {
    const { country_code, type, operator, circle } = req.query;
    let filter = {};
    if (req.user.role !== 'superadmin') {
      filter.userId = req.user.id;
    }
    if (country_code) filter.country_code = country_code;
    if (type) filter.type = type;
    if (operator) filter.operator = operator;
    if (circle) filter.circle = circle;

    const credentials = await PhoneCredential.find(filter)
      .select('phone password type operator circle country_code')
      .lean();

    const content = credentials
      .map((cred) => {
        let op = cred.operator;
        let cir = cred.circle;
        if (!op || op === 'Unknown' || !cir || cir === 'Unknown') {
          const resolved = operatorResolver.resolveNumber(cred.phone, cred.country_code);
          if (resolved.operator && resolved.operator !== 'Unknown') op = resolved.operator;
          if (resolved.circle && resolved.circle !== 'Unknown') cir = resolved.circle;
        }
        op = op || 'Unknown';
        cir = cir || 'Unknown';
        const opState = `${cir}>${op}`;
        return `${cred.phone}\t${cred.password}\t${cred.type}\t${opState}`;
      })
      .join("\n");

    const filename = country_code
      ? (type ? `${country_code}_type_${type}.txt` : `${country_code}_all_credentials.txt`)
      : (type ? `all_type_${type}_credentials.txt` : (operator ? `all_operator_${operator}_credentials.txt` : `all_credentials.txt`));

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    res.status(200).json({ message: error.message });
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
  downloadCredentials,
};