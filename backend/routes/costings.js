const express = require('express');
const Costing = require('../models/Costing');
const AuditLog = require('../models/AuditLog');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

function sanitize(str) {
  return typeof str === 'string' ? str.replace(/[<>]/g, '').trim() : '';
}

// Calculate costing item fields
function processItems(items, agencyChargePct = 15) {
  let subtotalVendor = 0;
  let subtotalSelling = 0;
  let taxAmount = 0;

  const processed = (items || []).map(item => {
    const qty = parseFloat(item.qty) || 0;
    const vendorCost = parseFloat(item.vendor_cost) || 0;
    const markupPct = parseFloat(item.markup_pct) || 0;
    const gstPct = parseFloat(item.gst_pct) || 18;

    const sellingRate = Math.round(vendorCost * (1 + markupPct / 100) * 100) / 100;
    const vendorAmount = Math.round(vendorCost * qty * 100) / 100;
    const amount = Math.round(sellingRate * qty * 100) / 100;
    const itemTax = Math.round(amount * (gstPct / 100) * 100) / 100;
    const profit = Math.round((amount - vendorAmount) * 100) / 100;

    subtotalVendor += vendorAmount;
    subtotalSelling += amount;
    taxAmount += itemTax;

    return {
      product_id: item.product_id || null,
      description: item.description || '',
      hsn: item.hsn || '',
      qty, unit: item.unit || 'NOS',
      vendor_cost: vendorCost,
      markup_pct: markupPct,
      selling_rate: sellingRate,
      gst_pct: gstPct,
      amount,
      vendor_amount: vendorAmount,
      profit,
    };
  });

  subtotalVendor = Math.round(subtotalVendor * 100) / 100;
  subtotalSelling = Math.round(subtotalSelling * 100) / 100;
  taxAmount = Math.round(taxAmount * 100) / 100;
  const totalMarkup = Math.round((subtotalSelling - subtotalVendor) * 100) / 100;
  const agencyCharge = Math.round(subtotalSelling * (agencyChargePct / 100) * 100) / 100;
  const grandTotal = Math.round((subtotalSelling + agencyCharge + taxAmount) * 100) / 100;
  const totalProfit = Math.round((totalMarkup + agencyCharge) * 100) / 100;
  const profitMarginPct = grandTotal > 0 ? Math.round((totalProfit / grandTotal) * 10000) / 100 : 0;

  return {
    items: processed,
    subtotal_vendor: subtotalVendor,
    subtotal_selling: subtotalSelling,
    total_markup: totalMarkup,
    agency_service_charge: agencyCharge,
    tax_amount: taxAmount,
    grand_total: grandTotal,
    total_profit: totalProfit,
    profit_margin_pct: profitMarginPct,
  };
}

// Helper to strip vendor cost info for non-admin roles
function stripVendorCosts(costing) {
  const obj = typeof costing.toObject === 'function' ? costing.toObject() : { ...costing };
  obj.items = (obj.items || []).map(item => {
    const { vendor_cost, vendor_amount, profit, ...rest } = item;
    return rest;
  });
  delete obj.subtotal_vendor;
  delete obj.total_markup;
  delete obj.total_profit;
  delete obj.profit_margin_pct;
  return obj;
}

// GET next costing number
router.get('/next-number', authenticate, async (req, res) => {
  try {
    const last = await Costing.findOne().sort({ _id: -1 }).select('costing_number').lean();
    if (!last) return res.json({ number: 'CST-001' });
    const numStr = last.costing_number.replace(/^CST-/, '');
    const num = parseInt(numStr, 10) || 0;
    res.json({ number: 'CST-' + String(num + 1).padStart(3, '0') });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate costing number' });
  }
});

// GET all costings — vendor costs visible only to Super Admin & Admin
router.get('/', authenticate, requireRole('Super Admin', 'Admin', 'Sales Manager', 'Accounts'), async (req, res) => {
  try {
    const { status, client_id, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (client_id) filter.client_id = client_id;
    if (search) {
      filter.$or = [
        { costing_number: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
      ];
    }

    const costings = await Costing.find(filter)
      .populate('client_id', 'name')
      .populate('project_id', 'name')
      .populate('created_by', 'username')
      .sort({ _id: -1 }).lean();

    const canSeeVendorCosts = ['Super Admin', 'Admin'].includes(req.user.role);

    res.json(costings.map(c => {
      const obj = canSeeVendorCosts ? c : stripVendorCosts(c);
      return {
        id: c._id,
        ...obj,
        client_name: c.client_id?.name || '',
        client_id: c.client_id?._id || c.client_id,
        project_name: c.project_id?.name || '',
        project_id: c.project_id?._id || c.project_id,
        created_by_name: c.created_by?.username || '',
        created_by: c.created_by?._id || c.created_by,
      };
    }));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch costings' });
  }
});

// GET single costing
router.get('/:id', authenticate, requireRole('Super Admin', 'Admin', 'Sales Manager', 'Accounts'), async (req, res) => {
  try {
    const costing = await Costing.findById(req.params.id)
      .populate('client_id', 'name gstin city state')
      .populate('project_id', 'name')
      .populate('created_by', 'username')
      .populate('approved_by', 'username').lean();
    if (!costing) return res.status(404).json({ error: 'Costing not found' });

    const canSeeVendorCosts = ['Super Admin', 'Admin'].includes(req.user.role);
    const obj = canSeeVendorCosts ? costing : stripVendorCosts(costing);

    res.json({
      id: costing._id,
      ...obj,
      client_name: costing.client_id?.name || '',
      project_name: costing.project_id?.name || '',
      created_by_name: costing.created_by?.username || '',
      approved_by_name: costing.approved_by?.username || '',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch costing' });
  }
});

// POST create costing
router.post('/', authenticate, requireRole('Super Admin', 'Admin', 'Sales Manager'), async (req, res) => {
  try {
    const { costing_number, client_id, project_id, title, description, items, agency_service_charge_pct, notes } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    if (!client_id) return res.status(400).json({ error: 'Client is required' });

    let costingNum = costing_number;
    if (!costingNum) {
      const last = await Costing.findOne().sort({ _id: -1 }).select('costing_number').lean();
      const num = last ? (parseInt(last.costing_number.replace(/^CST-/, ''), 10) || 0) + 1 : 1;
      costingNum = 'CST-' + String(num).padStart(3, '0');
    }

    const agencyPct = agency_service_charge_pct !== undefined ? parseFloat(agency_service_charge_pct) : 15;
    const calc = processItems(items, agencyPct);

    const costing = await Costing.create({
      costing_number: costingNum,
      client_id,
      project_id: project_id || null,
      title: sanitize(title),
      description: sanitize(description),
      items: calc.items,
      agency_service_charge_pct: agencyPct,
      ...calc,
      notes: sanitize(notes),
      created_by: req.user.id,
    });

    await AuditLog.create({
      action: 'created', entity: 'Costing', entity_id: costing._id,
      performed_by: req.user.id, ip_address: req.ip,
      details: `Created costing ${costingNum} for ${title}`,
    });

    res.status(201).json({ id: costing._id, ...costing.toObject() });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Costing number already exists' });
    res.status(500).json({ error: 'Failed to create costing' });
  }
});

// PUT update costing
router.put('/:id', authenticate, requireRole('Super Admin', 'Admin', 'Sales Manager'), async (req, res) => {
  try {
    const costing = await Costing.findById(req.params.id);
    if (!costing) return res.status(404).json({ error: 'Costing not found' });

    if (costing.status === 'Converted') {
      return res.status(400).json({ error: 'Cannot edit a converted costing' });
    }

    const { title, description, client_id, project_id, items, agency_service_charge_pct, status, notes } = req.body;

    if (title !== undefined) costing.title = sanitize(title);
    if (description !== undefined) costing.description = sanitize(description);
    if (client_id !== undefined) costing.client_id = client_id;
    if (project_id !== undefined) costing.project_id = project_id || null;
    if (notes !== undefined) costing.notes = sanitize(notes);
    if (agency_service_charge_pct !== undefined) costing.agency_service_charge_pct = parseFloat(agency_service_charge_pct);

    if (items !== undefined) {
      const calc = processItems(items, costing.agency_service_charge_pct);
      costing.items = calc.items;
      costing.subtotal_vendor = calc.subtotal_vendor;
      costing.subtotal_selling = calc.subtotal_selling;
      costing.total_markup = calc.total_markup;
      costing.agency_service_charge = calc.agency_service_charge;
      costing.tax_amount = calc.tax_amount;
      costing.grand_total = calc.grand_total;
      costing.total_profit = calc.total_profit;
      costing.profit_margin_pct = calc.profit_margin_pct;
    }

    if (status !== undefined && status !== costing.status) {
      costing.status = status;
      if (status === 'Approved') {
        costing.approved_by = req.user.id;
        costing.approved_at = new Date();
      }
      await AuditLog.create({
        action: status.toLowerCase(), entity: 'Costing', entity_id: costing._id,
        performed_by: req.user.id, ip_address: req.ip,
        details: `Costing ${costing.costing_number} ${status.toLowerCase()}`,
      });
    }

    await costing.save();
    res.json({ id: costing._id, ...costing.toObject() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update costing' });
  }
});

// DELETE costing — Super Admin/Admin only
router.delete('/:id', authenticate, requireRole('Super Admin', 'Admin'), async (req, res) => {
  try {
    const costing = await Costing.findByIdAndDelete(req.params.id);
    if (!costing) return res.status(404).json({ error: 'Costing not found' });
    res.json({ message: 'Costing deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete costing' });
  }
});

module.exports = router;
