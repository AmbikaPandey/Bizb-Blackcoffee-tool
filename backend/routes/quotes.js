const express = require('express');
const Quote = require('../models/Quote');
const Costing = require('../models/Costing');
const Invoice = require('../models/Invoice');
const AuditLog = require('../models/AuditLog');
const Setting = require('../models/Setting');
const { authenticate, requireRole } = require('../middleware/auth');
const { generateQuotePdfBuffer } = require('../helpers/quotePdfGenerator');

const router = express.Router();

function sanitize(str) {
  return typeof str === 'string' ? str.replace(/[<>]/g, '').trim() : '';
}

function processQuoteItems(items, agencyChargePct = 0) {
  let subtotal = 0;
  let taxAmount = 0;

  const processed = (items || []).map(item => {
    const qty = parseFloat(item.qty) || 0;
    const rate = parseFloat(item.rate) || 0;
    const discPct = parseFloat(item.discount_pct) || 0;
    const gstPct = parseFloat(item.gst_pct) || 18;

    const lineTotal = qty * rate;
    const afterDiscount = lineTotal - lineTotal * (discPct / 100);
    const itemTax = Math.round(afterDiscount * (gstPct / 100) * 100) / 100;
    const amount = Math.round((afterDiscount + itemTax) * 100) / 100;

    subtotal += afterDiscount;
    taxAmount += itemTax;

    return {
      product_id: item.product_id || null,
      description: item.description || '',
      hsn: item.hsn || '',
      qty, unit: item.unit || 'NOS', rate,
      discount_pct: discPct, gst_pct: gstPct, amount,
    };
  });

  subtotal = Math.round(subtotal * 100) / 100;
  taxAmount = Math.round(taxAmount * 100) / 100;
  const agencyCharge = Math.round(subtotal * (agencyChargePct / 100) * 100) / 100;
  const grandTotal = Math.round((subtotal + agencyCharge + taxAmount) * 100) / 100;

  return { items: processed, subtotal, tax_amount: taxAmount, agency_service_charge: agencyCharge, grand_total: grandTotal };
}

// GET next quote number
router.get('/next-number', authenticate, async (req, res) => {
  try {
    const last = await Quote.findOne({ parent_quote_id: null }).sort({ _id: -1 }).select('quote_number').lean();
    if (!last) return res.json({ number: 'QT-001' });
    const base = last.quote_number.split('-R')[0];
    const numStr = base.replace(/^QT-/, '');
    const num = parseInt(numStr, 10) || 0;
    res.json({ number: 'QT-' + String(num + 1).padStart(3, '0') });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate quote number' });
  }
});

// POST create quote from costing (auto-generate)
router.post('/from-costing/:costingId', authenticate, requireRole('Super Admin', 'Admin', 'Sales Manager'), async (req, res) => {
  try {
    const costing = await Costing.findById(req.params.costingId)
      .populate('client_id', 'name').lean();
    if (!costing) return res.status(404).json({ error: 'Costing not found' });

    // Generate quote number
    const last = await Quote.findOne({ parent_quote_id: null }).sort({ _id: -1 }).select('quote_number').lean();
    const num = last ? (parseInt(last.quote_number.replace(/^QT-/, '').split('-R')[0], 10) || 0) + 1 : 1;
    const quoteNumber = 'QT-' + String(num).padStart(3, '0');

    // Convert costing items to quote items (use selling_rate as rate, hide vendor costs)
    const quoteItems = (costing.items || []).map(item => ({
      product_id: item.product_id,
      description: item.description,
      hsn: item.hsn,
      qty: item.qty,
      unit: item.unit,
      rate: item.selling_rate,
      discount_pct: 0,
      gst_pct: item.gst_pct,
      amount: item.amount + Math.round(item.amount * (item.gst_pct / 100) * 100) / 100,
    }));

    const calc = processQuoteItems(quoteItems.map(qi => ({ ...qi, rate: qi.rate })), costing.agency_service_charge_pct);

    const quote = await Quote.create({
      quote_number: quoteNumber,
      costing_id: costing._id,
      client_id: costing.client_id?._id || costing.client_id,
      project_id: costing.project_id,
      title: costing.title,
      description: costing.description,
      items: calc.items,
      agency_service_charge_pct: costing.agency_service_charge_pct,
      ...calc,
      notes: costing.notes,
      created_by: req.user.id,
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    // Update costing status
    await Costing.findByIdAndUpdate(costing._id, { status: 'Quoted', quote_id: quote._id });

    await AuditLog.create({
      action: 'created', entity: 'Quote', entity_id: quote._id,
      performed_by: req.user.id, ip_address: req.ip,
      details: `Quote ${quoteNumber} auto-generated from costing ${costing.costing_number}`,
    });

    res.status(201).json({ id: quote._id, ...quote.toObject() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate quote from costing' });
  }
});

// GET all quotes
router.get('/', authenticate, requireRole('Super Admin', 'Admin', 'Sales Manager', 'Accounts'), async (req, res) => {
  try {
    const { status, client_id, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (client_id) filter.client_id = client_id;
    if (search) {
      filter.$or = [
        { quote_number: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
      ];
    }

    const quotes = await Quote.find(filter)
      .populate('client_id', 'name')
      .populate('project_id', 'name')
      .populate('created_by', 'username')
      .populate('costing_id', 'costing_number')
      .sort({ _id: -1 }).lean();

    res.json(quotes.map(q => ({
      id: q._id, ...q,
      client_name: q.client_id?.name || '',
      client_id: q.client_id?._id || q.client_id,
      project_name: q.project_id?.name || '',
      created_by_name: q.created_by?.username || '',
      costing_number: q.costing_id?.costing_number || '',
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch quotes' });
  }
});

// GET single quote with revision history
router.get('/:id', authenticate, requireRole('Super Admin', 'Admin', 'Sales Manager', 'Accounts'), async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id)
      .populate('client_id', 'name gstin city state address contact email phone')
      .populate('project_id', 'name')
      .populate('created_by', 'username')
      .populate('costing_id', 'costing_number')
      .populate('parent_quote_id', 'quote_number revision')
      .populate('converted_to_invoice', 'invoice_number').lean();
    if (!quote) return res.status(404).json({ error: 'Quote not found' });

    // Get revision history (all quotes with same base number)
    const baseNumber = quote.quote_number.split('-R')[0];
    const revisions = await Quote.find({
      $or: [
        { quote_number: { $regex: '^' + baseNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } },
        { parent_quote_id: quote.parent_quote_id || quote._id },
      ]
    }).select('quote_number revision status createdAt').sort({ revision: 1 }).lean();

    res.json({
      id: quote._id, ...quote,
      client_name: quote.client_id?.name || '',
      project_name: quote.project_id?.name || '',
      created_by_name: quote.created_by?.username || '',
      costing_number: quote.costing_id?.costing_number || '',
      parent_quote_number: quote.parent_quote_id?.quote_number || '',
      converted_to_invoice_number: quote.converted_to_invoice?.invoice_number || '',
      revisions: revisions.map(r => ({ id: r._id, number: r.quote_number, revision: r.revision, status: r.status, date: r.createdAt })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch quote' });
  }
});

// POST create quote (manually)
router.post('/', authenticate, requireRole('Super Admin', 'Admin', 'Sales Manager'), async (req, res) => {
  try {
    const { quote_number, client_id, project_id, title, description, items, agency_service_charge_pct, terms, notes, valid_until } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    if (!client_id) return res.status(400).json({ error: 'Client is required' });

    let quoteNum = quote_number;
    if (!quoteNum) {
      const last = await Quote.findOne({ parent_quote_id: null }).sort({ _id: -1 }).select('quote_number').lean();
      const num = last ? (parseInt(last.quote_number.replace(/^QT-/, '').split('-R')[0], 10) || 0) + 1 : 1;
      quoteNum = 'QT-' + String(num).padStart(3, '0');
    }

    const agencyPct = agency_service_charge_pct !== undefined ? parseFloat(agency_service_charge_pct) : 0;
    const calc = processQuoteItems(items, agencyPct);

    const quote = await Quote.create({
      quote_number: quoteNum,
      client_id,
      project_id: project_id || null,
      title: sanitize(title),
      description: sanitize(description),
      items: calc.items,
      agency_service_charge_pct: agencyPct,
      ...calc,
      terms: terms || undefined,
      notes: sanitize(notes),
      valid_until: valid_until || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      created_by: req.user.id,
    });

    await AuditLog.create({
      action: 'created', entity: 'Quote', entity_id: quote._id,
      performed_by: req.user.id, ip_address: req.ip,
      details: `Created quote ${quoteNum}`,
    });

    res.status(201).json({ id: quote._id, ...quote.toObject() });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Quote number already exists' });
    res.status(500).json({ error: 'Failed to create quote' });
  }
});

// PUT update quote
router.put('/:id', authenticate, requireRole('Super Admin', 'Admin', 'Sales Manager'), async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Quote not found' });
    if (quote.status === 'Converted') return res.status(400).json({ error: 'Cannot edit a converted quote' });

    const { title, description, client_id, project_id, items, agency_service_charge_pct, status, terms, notes, valid_until } = req.body;

    if (title !== undefined) quote.title = sanitize(title);
    if (description !== undefined) quote.description = sanitize(description);
    if (client_id !== undefined) quote.client_id = client_id;
    if (project_id !== undefined) quote.project_id = project_id || null;
    if (terms !== undefined) quote.terms = terms;
    if (notes !== undefined) quote.notes = sanitize(notes);
    if (valid_until !== undefined) quote.valid_until = valid_until;
    if (agency_service_charge_pct !== undefined) quote.agency_service_charge_pct = parseFloat(agency_service_charge_pct);

    if (items !== undefined) {
      const calc = processQuoteItems(items, quote.agency_service_charge_pct);
      quote.items = calc.items;
      quote.subtotal = calc.subtotal;
      quote.tax_amount = calc.tax_amount;
      quote.agency_service_charge = calc.agency_service_charge;
      quote.grand_total = calc.grand_total;
    }

    if (status !== undefined && status !== quote.status) {
      quote.status = status;
      await AuditLog.create({
        action: status.toLowerCase(), entity: 'Quote', entity_id: quote._id,
        performed_by: req.user.id, ip_address: req.ip,
        details: `Quote ${quote.quote_number} marked as ${status}`,
      });
    }

    await quote.save();
    res.json({ id: quote._id, ...quote.toObject() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update quote' });
  }
});

// POST create revision of a quote
router.post('/:id/revise', authenticate, requireRole('Super Admin', 'Admin', 'Sales Manager'), async (req, res) => {
  try {
    const original = await Quote.findById(req.params.id).lean();
    if (!original) return res.status(404).json({ error: 'Quote not found' });

    // Mark original as Revised
    await Quote.findByIdAndUpdate(original._id, { status: 'Revised' });

    const newRevision = (original.revision || 1) + 1;
    const baseNumber = original.quote_number.split('-R')[0];
    const newNumber = `${baseNumber}-R${newRevision}`;

    const { _id, __v, createdAt, updatedAt, quote_number, revision, status, ...rest } = original;

    const revised = await Quote.create({
      ...rest,
      quote_number: newNumber,
      revision: newRevision,
      parent_quote_id: original.parent_quote_id || original._id,
      status: 'Draft',
      created_by: req.user.id,
      converted_to_invoice: null,
      converted_at: null,
    });

    await AuditLog.create({
      action: 'revised', entity: 'Quote', entity_id: revised._id,
      performed_by: req.user.id, ip_address: req.ip,
      details: `Quote ${newNumber} (revision ${newRevision}) created from ${original.quote_number}`,
    });

    res.status(201).json({ id: revised._id, ...revised.toObject() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create revision' });
  }
});

// POST convert quote to proforma invoice
router.post('/:id/convert-to-invoice', authenticate, requireRole('Super Admin', 'Admin', 'Sales Manager'), async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id)
      .populate('client_id', 'name gstin state').lean();
    if (!quote) return res.status(404).json({ error: 'Quote not found' });
    if (quote.status === 'Converted') return res.status(400).json({ error: 'Quote already converted' });

    // Generate proforma invoice number
    const { getNextInvoiceNumber, processInvoiceItems } = require('../helpers/invoiceHelpers');
    const invNumber = await getNextInvoiceNumber('proforma');

    // Determine tax type from client state vs company state
    const settings = await Setting.find({ key: 'company' }).lean();
    const companySetting = settings[0]?.value || {};
    const companyState = companySetting.state || '';
    const clientState = quote.client_id?.state || '';
    const taxType = companyState && clientState && companyState === clientState ? 'CGST/SGST' : 'IGST';

    // Convert quote items to invoice items
    const invoiceItems = (quote.items || []).map(item => ({
      product_id: item.product_id,
      product_name: item.description,
      description: item.description,
      hsn: item.hsn,
      qty: item.qty,
      unit: item.unit,
      rate: item.rate,
      discount_pct: item.discount_pct,
      tax_pct: item.gst_pct,
    }));

    const calc = processInvoiceItems(invoiceItems);

    const invoice = await Invoice.create({
      invoice_number: invNumber,
      client_id: quote.client_id?._id || quote.client_id,
      invoice_type: 'Proforma Invoice',
      tax_type: taxType,
      invoice_date: new Date().toISOString().slice(0, 10),
      credit_period: 30,
      place_of_supply: clientState,
      type: 'proforma',
      items: calc.processedItems,
      subtotal: calc.subtotal,
      taxable_amount: calc.taxableAmount,
      grand_total: calc.grandTotal,
      balance: calc.grandTotal,
      notes: quote.notes,
      terms: quote.terms,
      status: 'Draft',
    });

    // Update quote status
    await Quote.findByIdAndUpdate(quote._id, {
      status: 'Converted',
      converted_to_invoice: invoice._id,
      converted_at: new Date(),
    });

    // Update costing if linked
    if (quote.costing_id) {
      await Costing.findByIdAndUpdate(quote.costing_id, { status: 'Converted' });
    }

    await AuditLog.create({
      action: 'converted', entity: 'Quote', entity_id: quote._id,
      performed_by: req.user.id, ip_address: req.ip,
      details: `Quote ${quote.quote_number} converted to proforma invoice ${invNumber}`,
    });

    res.status(201).json({
      id: invoice._id,
      invoice_number: invNumber,
      quote_number: quote.quote_number,
      message: 'Quote converted to proforma invoice',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to convert quote to invoice' });
  }
});

// GET quote PDF
router.get('/:id/pdf', authenticate, async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id)
      .populate('client_id', 'name gstin address city state contact email phone')
      .lean();
    if (!quote) return res.status(404).json({ error: 'Quote not found' });

    const settings = await Setting.find({ key: { $in: ['company', 'bank'] } }).lean();
    const settingsMap = {};
    settings.forEach(s => { settingsMap[s.key] = s.value; });

    const pdfBuffer = await generateQuotePdfBuffer(quote, settingsMap.company || {}, settingsMap.bank || {});

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${quote.quote_number}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate quote PDF' });
  }
});

// DELETE quote
router.delete('/:id', authenticate, requireRole('Super Admin', 'Admin'), async (req, res) => {
  try {
    const quote = await Quote.findByIdAndDelete(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Quote not found' });
    res.json({ message: 'Quote deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete quote' });
  }
});

module.exports = router;
