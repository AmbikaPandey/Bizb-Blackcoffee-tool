const express = require('express');
const Costing = require('../models/Costing');
const Quote = require('../models/Quote');
const Setting = require('../models/Setting');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET commission settings (agency default %, vendor markup rules)
router.get('/settings', authenticate, requireRole('Super Admin', 'Admin'), async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: 'commission' }).lean();
    res.json(setting?.value || {
      agency_default_pct: 15,
      min_markup_pct: 10,
      max_markup_pct: 100,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch commission settings' });
  }
});

// PUT update commission settings
router.put('/settings', authenticate, requireRole('Super Admin', 'Admin'), async (req, res) => {
  try {
    const { agency_default_pct, min_markup_pct, max_markup_pct } = req.body;
    const value = {
      agency_default_pct: parseFloat(agency_default_pct) || 15,
      min_markup_pct: parseFloat(min_markup_pct) || 10,
      max_markup_pct: parseFloat(max_markup_pct) || 100,
    };
    await Setting.findOneAndUpdate({ key: 'commission' }, { key: 'commission', value }, { upsert: true });
    res.json({ message: 'Commission settings saved', ...value });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save commission settings' });
  }
});

// GET vendor markup tracking — internal only (Super Admin/Admin)
router.get('/vendor-markup', authenticate, requireRole('Super Admin', 'Admin'), async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = {};
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to + 'T23:59:59.999Z');
    }

    const costings = await Costing.find(filter)
      .populate('client_id', 'name')
      .sort({ _id: -1 }).lean();

    // Flatten to per-item vendor markup data
    const markupData = [];
    for (const c of costings) {
      for (const item of (c.items || [])) {
        markupData.push({
          costing_id: c._id,
          costing_number: c.costing_number,
          client_name: c.client_id?.name || '',
          description: item.description,
          vendor_cost: item.vendor_cost,
          markup_pct: item.markup_pct,
          selling_rate: item.selling_rate,
          qty: item.qty,
          vendor_amount: item.vendor_amount,
          selling_amount: item.amount,
          profit: item.profit,
          date: c.createdAt,
        });
      }
    }

    // Summary stats
    const totalVendorCost = markupData.reduce((s, d) => s + (d.vendor_amount || 0), 0);
    const totalSellingAmount = markupData.reduce((s, d) => s + (d.selling_amount || 0), 0);
    const totalProfit = markupData.reduce((s, d) => s + (d.profit || 0), 0);
    const avgMarkupPct = markupData.length > 0
      ? markupData.reduce((s, d) => s + (d.markup_pct || 0), 0) / markupData.length
      : 0;

    res.json({
      items: markupData,
      summary: {
        totalItems: markupData.length,
        totalVendorCost: Math.round(totalVendorCost * 100) / 100,
        totalSellingAmount: Math.round(totalSellingAmount * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
        avgMarkupPct: Math.round(avgMarkupPct * 100) / 100,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vendor markup data' });
  }
});

// GET agency service charge report
router.get('/agency-charges', authenticate, requireRole('Super Admin', 'Admin'), async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = {};
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to + 'T23:59:59.999Z');
    }

    const costings = await Costing.find(filter)
      .populate('client_id', 'name')
      .sort({ _id: -1 }).lean();

    const charges = costings.map(c => ({
      costing_id: c._id,
      costing_number: c.costing_number,
      client_name: c.client_id?.name || '',
      title: c.title,
      subtotal_selling: c.subtotal_selling,
      agency_pct: c.agency_service_charge_pct,
      agency_charge: c.agency_service_charge,
      total_markup: c.total_markup,
      total_profit: c.total_profit,
      profit_margin_pct: c.profit_margin_pct,
      status: c.status,
      date: c.createdAt,
    }));

    const totalAgencyCharge = charges.reduce((s, c) => s + (c.agency_charge || 0), 0);
    const totalMarkup = charges.reduce((s, c) => s + (c.total_markup || 0), 0);
    const totalProfit = charges.reduce((s, c) => s + (c.total_profit || 0), 0);

    res.json({
      items: charges,
      summary: {
        totalCostings: charges.length,
        totalAgencyCharge: Math.round(totalAgencyCharge * 100) / 100,
        totalMarkup: Math.round(totalMarkup * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch agency charge data' });
  }
});

// GET profit summary dashboard
router.get('/profit-summary', authenticate, requireRole('Super Admin', 'Admin'), async (req, res) => {
  try {
    const [costings, quotes] = await Promise.all([
      Costing.aggregate([
        { $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalVendorCost: { $sum: '$subtotal_vendor' },
          totalSelling: { $sum: '$subtotal_selling' },
          totalMarkup: { $sum: '$total_markup' },
          totalAgencyCharge: { $sum: '$agency_service_charge' },
          totalProfit: { $sum: '$total_profit' },
          totalGrandTotal: { $sum: '$grand_total' },
        }},
        { $sort: { _id: 1 } },
      ]),
      Quote.aggregate([
        { $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalGrandTotal: { $sum: '$grand_total' },
        }},
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Monthly profit trend (last 12 months)
    const monthlyProfit = await Costing.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        vendorCost: { $sum: '$subtotal_vendor' },
        selling: { $sum: '$subtotal_selling' },
        markup: { $sum: '$total_markup' },
        agencyCharge: { $sum: '$agency_service_charge' },
        profit: { $sum: '$total_profit' },
        revenue: { $sum: '$grand_total' },
        count: { $sum: 1 },
      }},
      { $sort: { _id: 1 } },
    ]);

    res.json({
      costingsByStatus: costings,
      quotesByStatus: quotes,
      monthlyProfit,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profit summary' });
  }
});

module.exports = router;
