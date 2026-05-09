const express = require('express');
const HsnMaster = require('../models/HsnMaster');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const HSN_RE = /^[0-9]{4,8}$/;

// ── GET /api/hsn-master — list all (paginated, filterable) ───
router.get('/', authenticate, authorize('hsnMaster', 'view'), async (req, res) => {
  try {
    const { page = 1, limit = 50, type, status, q } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (type === 'HSN' || type === 'SAC') filter.type = type;
    if (status === 'active') filter.isActive = true;
    else if (status === 'inactive') filter.isActive = false;

    if (q && q.trim()) {
      const term = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { code: { $regex: term, $options: 'i' } },
        { keywords: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
      ];
    }

    const [results, total] = await Promise.all([
      HsnMaster.find(filter).sort({ code: 1 }).skip(skip).limit(limitNum).lean(),
      HsnMaster.countDocuments(filter),
    ]);

    res.json({ results, total, page: pageNum, limit: limitNum });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch HSN/SAC codes' });
  }
});

// ── GET /api/hsn-master/search?q= — keyword/code search for autocomplete ───
router.get('/search', authenticate, async (req, res) => {
  try {
    const { q = '', limit = 15 } = req.query;
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 15));

    if (!q.trim()) return res.json({ results: [] });

    const term = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = {
      isActive: true,
      $or: [
        { code: { $regex: `^${term}`, $options: 'i' } },
        { keywords: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
      ],
    };

    const results = await HsnMaster.find(filter)
      .sort({ code: 1 })
      .limit(limitNum)
      .select('code type keywords gstRate description')
      .lean();

    res.json({
      results: results.map(r => ({
        id: r._id,
        hsnCode: r.code,
        code: r.code,
        type: r.type,
        keywords: r.keywords,
        productName: r.keywords.join(', '),
        gstRate: r.gstRate,
        description: r.description,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// ── POST /api/hsn-master — create ───
router.post('/', authenticate, authorize('hsnMaster', 'create'), async (req, res) => {
  try {
    const { code, type, keywords, description, gstRate } = req.body;

    // Validate code
    if (!code || !HSN_RE.test(code)) {
      return res.status(400).json({ error: 'HSN/SAC code must be 4-8 digits' });
    }
    if (!type || !['HSN', 'SAC'].includes(type)) {
      return res.status(400).json({ error: 'Type must be HSN or SAC' });
    }

    // Parse keywords
    const kw = parseKeywords(keywords);
    if (kw.length === 0) {
      return res.status(400).json({ error: 'At least one keyword is required' });
    }

    // Check gstRate
    const rate = parseFloat(gstRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      return res.status(400).json({ error: 'GST rate must be 0-100' });
    }

    // Duplicate check
    const existing = await HsnMaster.findOne({ code });
    if (existing) {
      return res.status(409).json({ error: `HSN/SAC code ${code} already exists` });
    }

    const doc = await HsnMaster.create({
      code,
      type,
      keywords: kw,
      description: description || '',
      gstRate: rate,
      createdBy: req.user.id,
    });

    res.status(201).json(doc);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Duplicate HSN/SAC code' });
    }
    res.status(500).json({ error: 'Failed to create HSN/SAC code' });
  }
});

// ── PUT /api/hsn-master/:id — update ───
router.put('/:id', authenticate, authorize('hsnMaster', 'edit'), async (req, res) => {
  try {
    const { code, type, keywords, description, gstRate, isActive } = req.body;

    const doc = await HsnMaster.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    if (code !== undefined) {
      if (!HSN_RE.test(code)) return res.status(400).json({ error: 'HSN/SAC code must be 4-8 digits' });
      // Check duplicate if code changed
      if (code !== doc.code) {
        const dup = await HsnMaster.findOne({ code });
        if (dup) return res.status(409).json({ error: `HSN/SAC code ${code} already exists` });
      }
      doc.code = code;
    }

    if (type !== undefined) {
      if (!['HSN', 'SAC'].includes(type)) return res.status(400).json({ error: 'Type must be HSN or SAC' });
      doc.type = type;
    }

    if (keywords !== undefined) {
      const kw = parseKeywords(keywords);
      if (kw.length === 0) return res.status(400).json({ error: 'At least one keyword is required' });
      doc.keywords = kw;
    }

    if (description !== undefined) doc.description = description;

    if (gstRate !== undefined) {
      const rate = parseFloat(gstRate);
      if (isNaN(rate) || rate < 0 || rate > 100) return res.status(400).json({ error: 'GST rate must be 0-100' });
      doc.gstRate = rate;
    }

    if (typeof isActive === 'boolean') doc.isActive = isActive;

    await doc.save();
    res.json(doc);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Duplicate HSN/SAC code' });
    res.status(500).json({ error: 'Failed to update' });
  }
});

// ── DELETE /api/hsn-master/:id ───
router.delete('/:id', authenticate, authorize('hsnMaster', 'delete'), async (req, res) => {
  try {
    const doc = await HsnMaster.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// ── POST /api/hsn-master/import — CSV/bulk import ───
router.post('/import', authenticate, authorize('hsnMaster', 'create'), async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'records array is required' });
    }
    if (records.length > 500) {
      return res.status(400).json({ error: 'Maximum 500 records per import' });
    }

    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      try {
        if (!r.code || !HSN_RE.test(r.code)) {
          errors.push(`Row ${i + 1}: Invalid code`);
          skipped++;
          continue;
        }
        const kw = parseKeywords(r.keywords);
        if (kw.length === 0) {
          errors.push(`Row ${i + 1}: No keywords`);
          skipped++;
          continue;
        }
        await HsnMaster.findOneAndUpdate(
          { code: r.code },
          {
            $set: {
              type: r.type === 'SAC' ? 'SAC' : 'HSN',
              keywords: kw,
              description: r.description || '',
              gstRate: parseFloat(r.gstRate) || 18,
              isActive: true,
              createdBy: req.user.id,
            },
          },
          { upsert: true },
        );
        imported++;
      } catch {
        errors.push(`Row ${i + 1}: Failed`);
        skipped++;
      }
    }

    res.json({ imported, skipped, errors: errors.slice(0, 20) });
  } catch (err) {
    res.status(500).json({ error: 'Import failed' });
  }
});

/**
 * Parse keywords from string or array.
 * Accepts: "Laptop, Computer, Desktop" OR ["Laptop", "Computer"]
 */
function parseKeywords(input) {
  if (Array.isArray(input)) {
    return input.map(k => String(k).trim()).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input.split(',').map(k => k.trim()).filter(Boolean);
  }
  return [];
}

module.exports = router;
