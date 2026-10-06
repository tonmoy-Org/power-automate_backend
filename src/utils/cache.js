const createTtlCache = (defaultTtlMs = 3000) => {
  const map = new Map();
  return {
    get: (key) => {
      const entry = map.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiry) {
        map.delete(key);
        return null;
      }
      return entry.data;
    },
    set: (key, data, ttlMs = defaultTtlMs) => {
      map.set(key, { data, expiry: Date.now() + ttlMs });
    },
    clear: () => map.clear(),
    delete: (key) => map.delete(key)
  };
};

const phoneNumbersCache = createTtlCache(3000);
const indianNumbersCache = createTtlCache(3000);
const phoneCredentialsCache = createTtlCache(3000);
const indianPhoneCredentialsCache = createTtlCache(3000);

const getPhoneNumbersCache = (userId) => phoneNumbersCache.get(userId);
const setPhoneNumbersCache = (userId, val, ttl) => phoneNumbersCache.set(userId, val, ttl);
const clearPhoneNumbersCache = () => phoneNumbersCache.clear();

const getIndianNumbersCache = (userId) => indianNumbersCache.get(userId);
const setIndianNumbersCache = (userId, val, ttl) => indianNumbersCache.set(userId, val, ttl);
const clearIndianNumbersCache = () => indianNumbersCache.clear();

const getPhoneCredentialsCache = (userId) => phoneCredentialsCache.get(userId);
const setPhoneCredentialsCache = (userId, val, ttl) => phoneCredentialsCache.set(userId, val, ttl);
const clearPhoneCredentialsCache = () => phoneCredentialsCache.clear();

const getIndianPhoneCredentialsCache = (userId) => indianPhoneCredentialsCache.get(userId);
const setIndianPhoneCredentialsCache = (userId, val, ttl) => indianPhoneCredentialsCache.set(userId, val, ttl);
const clearIndianPhoneCredentialsCache = () => indianPhoneCredentialsCache.clear();

module.exports = {
  getPhoneNumbersCache,
  setPhoneNumbersCache,
  clearPhoneNumbersCache,
  getIndianNumbersCache,
  setIndianNumbersCache,
  clearIndianNumbersCache,
  getPhoneCredentialsCache,
  setPhoneCredentialsCache,
  clearPhoneCredentialsCache,
  getIndianPhoneCredentialsCache,
  setIndianPhoneCredentialsCache,
  clearIndianPhoneCredentialsCache
};
