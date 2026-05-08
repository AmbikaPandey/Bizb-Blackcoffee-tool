const express = require('express');
const HsnCode = require('../models/HsnCode');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Regex for valid HSN/SAC codes: 4, 6, or 8 digits
const HSN_RE = /^[0-9]{4,8}$/;

/**
 * GET /api/hsn/search?q=&page=1&limit=20
 * Search HSN codes by code or product name (partial match)
 */
router.get('/search', authenticate, async (req, res) => {
  try {
    const { q = '', page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    if (!q.trim()) {
      return res.json({ results: [], total: 0, page: pageNum, limit: limitNum });
    }

    const searchTerm = q.trim();
    // Build filter: search by HSN code (starts with) or product name (contains)
    const filter = {
      isActive: true,
      $or: [
        { hsnCode: { $regex: `^${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, $options: 'i' } },
        { productName: { $regex: searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      ],
    };

    const [results, total] = await Promise.all([
      HsnCode.find(filter).sort({ hsnCode: 1 }).skip(skip).limit(limitNum).lean(),
      HsnCode.countDocuments(filter),
    ]);

    res.json({
      results: results.map(r => ({
        id: r._id,
        hsnCode: r.hsnCode,
        productName: r.productName,
        description: r.description,
        gstRate: r.gstRate,
        category: r.category,
        type: r.type,
      })),
      total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to search HSN codes' });
  }
});

/**
 * GET /api/hsn/:code
 * Fetch HSN details by exact code
 */
router.get('/:code', authenticate, async (req, res) => {
  try {
    const code = (req.params.code || '').trim();

    if (!HSN_RE.test(code)) {
      return res.status(400).json({ error: 'Invalid HSN code format. Must be 4-8 digits.' });
    }

    const hsn = await HsnCode.findOne({ hsnCode: code, isActive: true }).lean();
    if (!hsn) {
      return res.status(404).json({ error: 'HSN code not found' });
    }

    res.json({
      hsnCode: hsn.hsnCode,
      productName: hsn.productName,
      gstRate: hsn.gstRate,
      category: hsn.category,
      description: hsn.description,
      type: hsn.type,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch HSN code' });
  }
});

module.exports = router;
