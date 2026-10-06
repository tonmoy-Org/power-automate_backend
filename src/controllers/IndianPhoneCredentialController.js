const IndianNumber = require("../models/IndianNumber");
const IndianPhoneCredential = require("../models/IndianPhoneCredential");
const DailyHistory = require("../models/DailyHistory");
const operatorResolver = require("../utils/operatorResolver");
const networkIntelligence = require("../utils/networkIntelligence");
const cache = require("../utils/cache");

const googleSheets = require("../utils/googleSheets");

// Create or update Indian credential
const createCredential = async (req, res) => {
  try {
    const { 
      phone, 
      password, 
      type, 
      operator, 
      circle,
      proxy,
      proxyStr,
      live_isp,
      live_asn,
      live_ip,
      live_city,
      live_region
    } = req.body;
    const country_code = "91"; // Forced to Indian country code
    const userId = req.user.id;

    if (!phone) {
      return res.status(400).json({
        message: "Phone number is required",
      });
    }

    // Resolve Dual-Layer Network & Telecom Intelligence
    const proxyInput = proxyStr || proxy || req.headers['x-proxy-string'] || '';
    const netAnalysis = networkIntelligence.analyzeDualLayer(phone, {
      proxyStr: proxyInput,
      asn: live_asn,
      isp: live_isp,
      ip: live_ip || req.ip,
      city: live_city,
      region: live_region
    });

    const resolvedPrefix = netAnalysis.prefix;

    // Master series always takes precedence and legacy names (Docomo/Telewings/etc) are strictly normalized
    let resolvedOperator = (netAnalysis.series_operator && netAnalysis.series_operator !== 'Unknown')
      ? netAnalysis.series_operator
      : operatorResolver.normalizeOperator(operator);

    let resolvedCircle = (netAnalysis.series_circle && netAnalysis.series_circle !== 'Unknown')
      ? netAnalysis.series_circle
      : operatorResolver.normalizeCircle(circle);

    const updateData = {
      country_code,
      phone,
      password,
      type: type || "default",
      operator: resolvedOperator,
      circle: resolvedCircle,
      userId,
      ...(netAnalysis.live_isp ? { live_isp: netAnalysis.live_isp } : {}),
      ...(netAnalysis.live_asn ? { live_asn: netAnalysis.live_asn } : {}),
      ...(netAnalysis.live_ip ? { live_ip: netAnalysis.live_ip } : {}),
      ...(netAnalysis.live_city ? { live_city: netAnalysis.live_city } : {}),
      ...(netAnalysis.live_region ? { live_region: netAnalysis.live_region } : {}),
      ...(netAnalysis.network_match_type ? { network_match_type: netAnalysis.network_match_type } : {})
    };

    const credential = await IndianPhoneCredential.findOneAndUpdate(
      { phone, userId },
      { $set: updateData },
      { new: true, upsert: true }
    );

    // Always push to Google Sheets after DB upsert for all valid requests.
    // Dedup guard inside googleSheets.pushCredential() prevents duplicate sheet rows.
    googleSheets.pushCredential({
      phone: credential.phone,
      password: credential.password,
      type: credential.type,
      prefix: resolvedPrefix,
      operator: credential.operator,
      circle: credential.circle
    }).catch(err => console.error("[IndianPhoneCredential] Google Sheets push error:", err));

    res.status(201).json({
      message: "Indian credential saved successfully",
      data: credential,
    });
  } catch (error) {
    res.status(200).json({
      message: error.message,
    });
  }
};

// Get Indian credentials
const getCredentials = async (req, res) => {
  try {
    const { phone, aggregate, search } = req.query;

    const cacheKey = req.query.userId || req.user.id;
    if (aggregate === 'true') {
      if (!search && req.user.role === 'superadmin') {
        const cached = cache.getIndianPhoneCredentialsCache(cacheKey);
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
        circleSummaryResult,
        cardsAggResult
      ] = await Promise.all([
        IndianPhoneCredential.countDocuments(matchFilter),
        IndianPhoneCredential.aggregate([
          { $match: matchFilter },
          { $group: { _id: "$type", count: { $sum: 1 } } },
          { $sort: { _id: 1 } }
        ]),
        IndianPhoneCredential.aggregate([
          { $match: matchFilter },
          { $group: { _id: "$operator", count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        IndianPhoneCredential.aggregate([
          { $match: matchFilter },
          { $group: { _id: "$circle", count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        IndianPhoneCredential.aggregate([
          { $match: matchFilter },
          {
            $group: {
              _id: {
                circle: "$circle",
                type: "$type",
                operator: "$operator"
              },
              count: { $sum: 1 }
            }
          }
        ])
      ]);

      const totalCount = totalCountResult;
      const typeSummary = typeAggResult.map(t => ({ type: t._id || 'Unknown', count: t.count }));
      const operatorSummary = operatorAggResult.map(o => ({ label: o._id || 'Unknown', count: o.count }));
      const circleSummaryFormatted = circleSummaryResult.map(c => ({ label: c._id || 'Unknown', count: c.count }));
      const cardsAgg = cardsAggResult;

      const circlesMap = {};
      cardsAgg.forEach(item => {
        const circleName = item._id.circle || 'Unknown';
        const typeName = item._id.type || 'Unknown';
        const opName = item._id.operator || '';
        const count = item.count;

        if (!circlesMap[circleName]) {
          circlesMap[circleName] = {
            circle: circleName,
            count: 0,
            typesMap: {}
          };
        }

        circlesMap[circleName].count += count;

        if (!circlesMap[circleName].typesMap[typeName]) {
          circlesMap[circleName].typesMap[typeName] = {
            type: typeName,
            count: 0,
            operatorsMap: {}
          };
        }

        circlesMap[circleName].typesMap[typeName].count += count;

        if (opName) {
          if (!circlesMap[circleName].typesMap[typeName].operatorsMap[opName]) {
            circlesMap[circleName].typesMap[typeName].operatorsMap[opName] = 0;
          }
          circlesMap[circleName].typesMap[typeName].operatorsMap[opName] += count;
        }
      });

      const circles = Object.values(circlesMap).map(c => {
        const types = Object.values(c.typesMap).map(t => {
          const operators = Object.entries(t.operatorsMap).map(([operator, count]) => ({
            operator,
            count
          })).sort((a, b) => b.count - a.count);
          return {
            type: t.type,
            count: t.count,
            operators
          };
        }).sort((a, b) => a.type.localeCompare(b.type));

        return {
          circle: c.circle,
          count: c.count,
          types
        };
      }).sort((a, b) => b.count - a.count);

      const responseData = {
        totalCount,
        summary: {
          typeSummary,
          operatorSummary,
          circleSummary: circleSummaryFormatted
        },
        circles
      };

      if (!search && req.user.role === 'superadmin') {
        cache.setIndianPhoneCredentialsCache(cacheKey, responseData);
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
    if (phone) filter.phone = phone;

    const listCacheKey = `raw_list_${req.query.userId || req.user.id}_${phone || 'all'}`;
    if (!phone && req.user.role === 'superadmin') {
      const cached = cache.getIndianPhoneCredentialsCache(listCacheKey);
      if (cached) return res.json(cached);
    }

    const credentials = await IndianPhoneCredential.find(filter)
      .select('phone password type operator circle country_code createdAt')
      .sort({ createdAt: -1 })
      .lean();

    if (!phone && req.user.role === 'superadmin') {
      cache.setIndianPhoneCredentialsCache(listCacheKey, credentials, 3000);
    }

    res.json(credentials);
  } catch (error) {
    res.status(200).json({ message: error.message });
  }
};


// Get Indian credential by ID
const getCredentialById = async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.user.role !== 'superadmin') {
      query.userId = req.user.id;
    }

    const credential = await IndianPhoneCredential.findOne(query).lean();

    if (!credential) {
      return res.status(404).json({ message: "Credential not found" });
    }

    res.json(credential);
  } catch (error) {
    res.status(200).json({ message: error.message });
  }
};

// Update Indian credential
const updateCredential = async (req, res) => {
  try {
    const { phone, password, type, operator, circle } = req.body;
    const country_code = "91";

    let resolvedPrefix = "";
    let resolvedOperator = operator;
    let resolvedCircle = circle;

    if (phone) {
      // Check if Indian number exists in system
      const phoneQuery = { number: phone };
      if (req.user.role !== 'superadmin') {
        phoneQuery.userId = req.user.id;
      }

      const phoneExists = await IndianNumber.findOne(phoneQuery);

      if (!phoneExists) {
        return res.status(404).json({
          message: "The specified Indian phone number does not exist in the system",
        });
      }

      const duplicateQuery = {
        phone,
        _id: { $ne: req.params.id },
      };
      if (req.user.role !== 'superadmin') {
        duplicateQuery.userId = req.user.id;
      }

      const existingCredential = await IndianPhoneCredential.findOne(duplicateQuery);

      if (existingCredential) {
        return res.status(400).json({
          message:
            "Duplicate credential: This phone number already exists",
        });
      }

      const resolved = operatorResolver.resolveNumber(phone);
      resolvedPrefix = resolved.prefix;
      if (!resolvedOperator) resolvedOperator = resolved.operator;
      if (!resolvedCircle) resolvedCircle = resolved.circle;
    }

    const updateFields = { country_code, phone, password, type, operator: resolvedOperator, circle: resolvedCircle };

    // Clean undefined fields so they aren't overwritten as undefined if not passed
    Object.keys(updateFields).forEach(
      (key) => updateFields[key] === undefined && delete updateFields[key]
    );

    const query = { _id: req.params.id };
    if (req.user.role !== 'superadmin') {
      query.userId = req.user.id;
    }

    const existing = await IndianPhoneCredential.findOne(query);
    if (!existing) {
      return res.status(404).json({ message: "Credential not found" });
    }

    const isDifferent = (password !== undefined && existing.password !== password) ||
      (phone !== undefined && existing.phone !== phone);

    const credential = await IndianPhoneCredential.findOneAndUpdate(
      query,
      updateFields,
      { new: true, runValidators: true }
    );

    if (isDifferent) {
      if (req.user.role !== 'client') {
        const resolvedInfoForPush = operatorResolver.resolveNumber(credential.phone);
        googleSheets.pushCredential({
          phone: credential.phone,
          password: credential.password,
          type: credential.type,
          prefix: resolvedInfoForPush.prefix,
          operator: credential.operator,
          circle: credential.circle
        }).catch(err => console.error("Google Sheets live push background error:", err));
      }
    } else {
      console.log(`[IndianPhoneCredential] Skipping Google Sheets push for ID ${req.params.id} - no password or phone change`);
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
    res.status(200).json({ message: error.message });
  }
};

// Delete single Indian credential
const deleteCredential = async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.user.role !== 'superadmin') {
      query.userId = req.user.id;
    }

    const credential = await IndianPhoneCredential.findOneAndDelete(query);

    if (!credential) {
      return res.status(404).json({ message: "Credential not found" });
    }

    res.json({ message: "Credential deleted successfully" });
  } catch (error) {
    res.status(200).json({ message: error.message });
  }
};

// Bulk delete Indian credentials
const bulkDeleteCredentials = async (req, res) => {
  try {
    const { ids, circleName, type, operator, deleteAll } = req.body;
    let filter = {};
    if (req.user.role !== 'superadmin') {
      filter.userId = req.user.id;
    }

    if (deleteAll) {
      // Delete all
    } else if (ids && Array.isArray(ids) && ids.length > 0) {
      filter._id = { $in: ids };
    } else if (circleName || type || operator) {
      if (circleName) filter.circle = circleName;
      if (type) filter.type = type;
      if (operator) filter.operator = operator;
    } else if (req.user.role === 'superadmin') {
      return res.status(400).json({
        message: "Please provide ids, criteria (circleName, type, operator), or deleteAll",
      });
    }

    const result = await IndianPhoneCredential.deleteMany(filter);

    res.json({
      message: `Successfully deleted ${result.deletedCount} Indian credential(s)`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(200).json({ message: error.message });
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

    const query = { type: type };
    if (req.user.role !== 'superadmin') {
      query.userId = req.user.id;
    }

    const result = await IndianPhoneCredential.deleteMany(query);

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
    res.status(200).json({ message: error.message });
  }
};

// Download Indian credentials
const downloadCredentials = async (req, res) => {
  try {
    const { circle, type, operator } = req.query;
    let filter = {};
    if (req.user.role !== 'superadmin') {
      filter.userId = req.user.id;
    }
    if (circle) filter.circle = circle;
    if (type) filter.type = type;
    if (operator) filter.operator = operator;

    const credentials = await IndianPhoneCredential.find(filter)
      .select('phone password type')
      .lean();

    const content = credentials
      .map((cred) => `${cred.phone}\t${cred.password}\t${cred.type}`)
      .join("\n");

    const filename = circle
      ? (type ? `${circle}_type_${type}.txt` : `${circle}_all_credentials.txt`)
      : (type ? `all_type_${type}_credentials.txt` : (operator ? `all_operator_${operator}_credentials.txt` : `all_credentials.txt`));

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    res.status(200).json({ message: error.message });
  }
};

// Get history summary for Indian phone credentials (default 3 days, configurable via query)
const getHistory3Days = async (req, res) => {
  try {
    const numDays = Math.min(Math.max(parseInt(req.query.days) || 3, 1), 30);
    const now = new Date();
    const historyList = [];

    for (let i = 0; i < numDays; i++) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
      const dhakaTime = new Date(utc + (3600000 * 6));
      const dateStr = `${dhakaTime.getMonth() + 1}/${dhakaTime.getDate()}/${dhakaTime.getFullYear()}`;

      const [m, day, y] = dateStr.split('/').map(Number);
      const startUTC = new Date(Date.UTC(y, m - 1, day, 0, 0, 0) - 6 * 3600000);
      const endUTC = new Date(Date.UTC(y, m - 1, day, 23, 59, 59, 999) - 6 * 3600000);

      const countInCollection = await IndianPhoneCredential.countDocuments({
        createdAt: { $gte: startUTC, $lte: endUTC }
      });

      const historyDoc = await DailyHistory.findOne({ date: dateStr }).lean();
      const count = Math.max(countInCollection, historyDoc ? (historyDoc.indianCount || 0) : 0);

      historyList.push({
        date: dateStr,
        count: count
      });
    }

    res.json({
      success: true,
      data: historyList
    });
  } catch (error) {
    res.status(200).json({ success: false, message: error.message });
  }
};

// Export credentials as CSV matching exact Google Sheet columns for a specific date
const exportCsvByDate = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: "date parameter (M/D/YYYY) is required" });
    }

    const [m, d, y] = date.split('/').map(Number);
    if (!m || !d || !y) {
      return res.status(400).json({ success: false, message: "Invalid date format. Use M/D/YYYY" });
    }

    const startUTC = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 6 * 3600000);
    const endUTC = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - 6 * 3600000);

    const filter = {
      createdAt: { $gte: startUTC, $lte: endUTC }
    };
    if (req.user && req.user.role !== 'superadmin') {
      filter.userId = req.user.id;
    }

    const credentials = await IndianPhoneCredential.find(filter).lean();

    let csv = "Number,Password,Type,Operator Code,Operator>State,Date | Time\n";

    for (const cred of credentials) {
      const phone = cred.phone || '';
      const pwd = cred.password || '';
      const type = cred.type || 'DP';
      const prefix = cred.prefix || (phone.length >= 4 ? phone.substring(0, 4) : '');
      const opState = `${cred.circle || 'Unknown'}>${cred.operator || 'Unknown'}`;

      const dObj = cred.createdAt ? new Date(cred.createdAt) : new Date();
      // Add 6 hours (6 * 3600000 ms) to convert UTC to Dhaka local time
      const dhakaTime = new Date(dObj.getTime() + (6 * 3600000));
      const hour = dhakaTime.getUTCHours();
      const min = dhakaTime.getUTCMinutes();
      const sec = dhakaTime.getUTCSeconds();
      const period = hour >= 6 && hour < 12 ? 'Shokal' : (hour >= 12 && hour < 17 ? 'Dupur' : (hour >= 17 && hour < 20 ? 'Shondha' : 'Rat'));
      const hour12 = (hour % 12) || 12;
      const timeStr = `${hour12}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')} ${period}`;
      const dateTimeStr = `${m}/${d}/${y} | ${timeStr}`;

      csv += `"${phone}","${pwd}","${type}","${prefix}","${opState}","${dateTimeStr}"\n`;
    }

    const cleanFilename = `indian_credentials_${date.replace(/\//g, '-')}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"`);
    res.status(200).send(csv);
  } catch (error) {
    res.status(200).json({ success: false, message: error.message });
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
  downloadCredentials,
  getHistory3Days,
  exportCsvByDate
};
