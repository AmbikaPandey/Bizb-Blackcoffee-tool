const express = require('express');
const { authenticate } = require('../middleware/auth');
const GstCache = require('../models/GstCache');

const router = express.Router();

const RAPIDAPI_URL = 'https://gst-verification.p.rapidapi.com/v3/tasks/sync/verify_with_source/ind_gst_certificate';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'gst-verification.p.rapidapi.com';

// In-memory cache (survives until server restart, DB is the persistent layer)
const memCache = new Map();
const MEM_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetch GSTIN details from RapidAPI GST Verification.
 */
async function fetchGSTIN(gstin) {
  const res = await fetch(RAPIDAPI_URL, {
    method: 'POST',
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      task_id: '74f4c926-250c-43ca-9c53-453e87ceacd1',
      group_id: '8e16424a-58fc-4ba4-ab20-5bc8e7c3c41e',
      data: { gstin },
    }),
  });

  const json = await res.json();
  return { status: res.status, data: json };
}

/**
 * Parse RapidAPI GST response into normalized fields.
 * Response: { result: { source_output: { legal_name, trade_name, principal_place_of_business_fields, ... } } }
 */
function parseGSTResponse(raw) {
  const d = raw?.result?.source_output || raw?.data?.result?.source_output || raw;

  // Handle address from principal_place_of_business_fields
  const ppob = d.principal_place_of_business_fields || {};
  const a = ppob.principal_place_of_business_address || {};
  let address = '', city = '', state = '', pincode = '';

  if (typeof a === 'object' && Object.keys(a).length) {
    address = [a.door_number, a.building_name, a.floor_number, a.street, a.location, a.dst]
      .filter(Boolean).join(', ');
    city = a.dst || a.city || a.location || '';
    state = a.state_name || '';
    pincode = a.pincode || '';
  } else if (d.pradr) {
    // Fallback for older format
    const addr = d.pradr;
    if (typeof addr === 'string') {
      address = addr;
      const pinMatch = addr.match(/(\d{6})/);
      if (pinMatch) pincode = pinMatch[1];
    } else if (typeof addr === 'object') {
      const sub = addr.addr || addr;
      address = [sub.bno, sub.flno, sub.bnm, sub.st, sub.loc, sub.dst].filter(Boolean).join(', ');
      state = sub.stcd || '';
      pincode = sub.pncd || '';
      city = sub.dst || sub.loc || '';
    }
  }

  if (!state) {
    state = d.state_jurisdiction || '';
    if (state.includes(' - ')) state = state.split(' - ')[0];
  }

  return {
    name: d.legal_name || d.legalName || d.lgnm || '',
    trade_name: d.trade_name || d.tradeNam || '',
    address,
    city,
    state,
    pincode,
    latitude: a.latitude || '',
    longitude: a.longitude || '',
    pan: d.gstin ? d.gstin.substring(2, 12) : '',
    status: d.gstin_status || d.sts || '',
    registration_type: d.taxpayer_type || d.dty || '',
    constitution: d.constitution_of_business || d.ctb || '',
    registration_date: d.date_of_registration || d.rgdt || '',
    state_code: d.gstin ? d.gstin.substring(0, 2) : '',
  };
}

/**
 * GET /api/gst/lookup/:gstin
 * Proxy GSTIN verification through RapidAPI with two-layer caching:
 * 1. In-memory cache (1 hour TTL)
 * 2. MongoDB GstCache collection (30-day TTL via Mongo TTL index)
 * 3. RapidAPI call (only if both caches miss)
 */
router.get('/lookup/:gstin', authenticate, async (req, res) => {
  const gstin = req.params.gstin.toUpperCase();
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
  if (!gstinRegex.test(gstin)) {
    return res.status(400).json({ error: 'Invalid GSTIN format' });
  }

  try {
    // 1. Check in-memory cache
    const memEntry = memCache.get(gstin);
    if (memEntry && Date.now() - memEntry.ts < MEM_CACHE_TTL) {
      return res.json({ ...memEntry.data, cached: true });
    }

    // 2. Check MongoDB cache
    const dbEntry = await GstCache.findOne({ gstin });
    if (dbEntry) {
      // Refresh memory cache from DB
      memCache.set(gstin, { data: dbEntry.data, ts: Date.now() });
      return res.json({ ...dbEntry.data, cached: true });
    }

    // 3. Call RapidAPI
    if (!RAPIDAPI_KEY) {
      return res.status(503).json({ error: 'GST verification service not configured' });
    }
    const result = await fetchGSTIN(gstin);

    if (result.status === 200) {
      const parsed = parseGSTResponse(result.data);

      // Store in DB
      await GstCache.findOneAndUpdate(
        { gstin },
        { gstin, data: parsed, rawResponse: result.data, fetchedAt: new Date() },
        { upsert: true, new: true }
      );

      // Store in memory
      memCache.set(gstin, { data: parsed, ts: Date.now() });

      return res.json(parsed);
    }

    return res.status(result.status || 500).json({
      error: result.data?.message || result.data?.error || 'GST lookup failed',
    });
  } catch (err) {
    return res.status(503).json({ error: 'GST verification service unavailable' });
  }
});

module.exports = router;
