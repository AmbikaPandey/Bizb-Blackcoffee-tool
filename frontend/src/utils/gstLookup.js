const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const STATE_CODES = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
  '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
  '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
  '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli & Daman & Diu', '27': 'Maharashtra', '29': 'Karnataka',
  '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu',
  '34': 'Puducherry', '35': 'Andaman & Nicobar Islands', '36': 'Telangana',
  '37': 'Andhra Pradesh', '38': 'Ladakh',
};

/**
 * Validate GSTIN format
 */
export function isValidGSTIN(gstin) {
  return GSTIN_RE.test(gstin);
}

/**
 * Extract PAN from GSTIN (chars 3-12)
 */
export function extractPanFromGstin(gstin) {
  if (!gstin || gstin.length < 12) return '';
  return gstin.substring(2, 12);
}

/**
 * Get state name from GSTIN state code
 */
export function getStateFromGstin(gstin) {
  if (!gstin || gstin.length < 2) return '';
  return STATE_CODES[gstin.substring(0, 2)] || '';
}

/**
 * Look up GST details — tries backend Sandbox API first, then free API fallback.
 * Returns { name, address, state, registration_type, pincode, pan, trade_name } or null on failure.
 */
export async function lookupGST(gstin) {
  if (!isValidGSTIN(gstin)) return null;

  // 1. Try backend Sandbox GST API (preferred)
  try {
    const { api } = await import('../services/api');
    const data = await api.lookupGST(gstin);
    if (data && (data.name || data.trade_name)) {
      return {
        name: data.trade_name || data.name || '',
        address: data.address || '',
        state: data.state || getStateFromGstin(gstin),
        registration_type: data.registration_type || '',
        pincode: data.pincode || '',
        pan: data.pan || extractPanFromGstin(gstin),
        trade_name: data.trade_name || '',
        legal_name: data.name || '',
        status: data.status || '',
        state_code: data.state_code || gstin.substring(0, 2),
        city: data.city || '',
      };
    }
  } catch {
    // Sandbox API unavailable, fall through to free API
  }

  // 2. Fallback — free GST search API
  try {
    const res = await fetch(`https://sheet.gstincheck.co.in/check/${gstin}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.flag) {
        return {
          name: data.data?.lgnm || data.data?.tradeNam || '',
          address: [data.data?.pradr?.addr?.bno, data.data?.pradr?.addr?.st, data.data?.pradr?.addr?.loc, data.data?.pradr?.addr?.dst].filter(Boolean).join(', '),
          state: data.data?.pradr?.addr?.stcd || getStateFromGstin(gstin),
          registration_type: data.data?.dty || '',
          pincode: data.data?.pradr?.addr?.pncd || '',
          pan: extractPanFromGstin(gstin),
          trade_name: data.data?.tradeNam || '',
          legal_name: data.data?.lgnm || '',
          city: data.data?.pradr?.addr?.dst || '',
        };
      }
    }
  } catch {
    // API failed, fall back to offline extraction
  }

  // 3. Offline fallback — extract what we can from the GSTIN itself
  return {
    name: '',
    address: '',
    state: getStateFromGstin(gstin),
    registration_type: '',
    pincode: '',
    pan: extractPanFromGstin(gstin),
  };
}
