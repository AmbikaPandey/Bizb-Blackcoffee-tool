import { api } from '../services/api';

// Cache for recently searched HSN codes
const hsnCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch HSN details by exact code with caching
 * @param {string} hsnCode - The HSN/SAC code to look up
 * @returns {Promise<object|null>} HSN details or null if not found
 */
export async function fetchHSNDetails(hsnCode) {
  if (!hsnCode || !/^[0-9]{4,8}$/.test(hsnCode)) return null;

  // Check cache first
  const cached = hsnCache.get(hsnCode);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.data;
  }

  try {
    const data = await api.getHSN(hsnCode);
    hsnCache.set(hsnCode, { data, time: Date.now() });
    return data;
  } catch {
    return null;
  }
}

/**
 * Search HSN codes by query (code or product name)
 * @param {string} query - Search term
 * @param {number} limit - Max results
 * @returns {Promise<Array>} Array of matching HSN records
 */
export async function searchHSN(query, limit = 10) {
  if (!query || query.trim().length < 2) return [];

  try {
    const result = await api.searchHSN(query.trim(), 1, limit);
    return result.results || [];
  } catch {
    return [];
  }
}
