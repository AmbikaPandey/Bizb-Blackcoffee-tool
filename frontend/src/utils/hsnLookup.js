import { api } from '../services/api';

// Cache for recently searched HSN codes
const hsnCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch HSN details by exact code with caching.
 * Tries hsn-master first, then falls back to legacy hsn collection.
 */
export async function fetchHSNDetails(hsnCode) {
  if (!hsnCode || !/^[0-9]{4,8}$/.test(hsnCode)) return null;

  const cached = hsnCache.get(hsnCode);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Search hsn-master by exact code
    const masterResult = await api.searchHsnMaster(hsnCode, 1);
    if (masterResult.results?.length) {
      const r = masterResult.results[0];
      const data = {
        hsnCode: r.code || r.hsnCode,
        productName: r.productName || r.keywords?.join(', ') || '',
        gstRate: r.gstRate,
        category: r.category || '',
        description: r.description || '',
        type: r.type || 'HSN',
      };
      hsnCache.set(hsnCode, { data, time: Date.now() });
      return data;
    }

    // Fallback to legacy
    const data = await api.getHSN(hsnCode);
    hsnCache.set(hsnCode, { data, time: Date.now() });
    return data;
  } catch {
    return null;
  }
}

/**
 * Search HSN codes by query (code or keyword).
 * Searches hsn-master first, then merges legacy results.
 */
export async function searchHSN(query, limit = 10) {
  if (!query || query.trim().length < 2) return [];

  try {
    // Search new hsn-master
    const masterResult = await api.searchHsnMaster(query.trim(), limit);
    const masterHits = (masterResult.results || []).map(r => ({
      id: r.id,
      hsnCode: r.code || r.hsnCode,
      productName: r.productName || r.keywords?.join(', ') || '',
      gstRate: r.gstRate,
      category: r.category || '',
      description: r.description || '',
      type: r.type || 'HSN',
    }));

    if (masterHits.length >= limit) return masterHits.slice(0, limit);

    // Merge with legacy if not enough results
    const legacyResult = await api.searchHSN(query.trim(), 1, limit - masterHits.length);
    const legacyHits = (legacyResult.results || []).filter(
      lr => !masterHits.some(mh => mh.hsnCode === lr.hsnCode)
    );

    return [...masterHits, ...legacyHits].slice(0, limit);
  } catch {
    return [];
  }
}
