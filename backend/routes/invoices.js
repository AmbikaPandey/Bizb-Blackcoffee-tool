const express = require('express');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const { authenticate } = require('../middleware/auth');
const { getNextInvoiceNumber, processInvoiceItems, recalcClientOutstanding, cleanInvoiceNumber } = require('../helpers/invoiceHelpers');
const { generateInvoicePdfBuffer, cleanInvoiceNumber: pdfClean } = require('../helpers/pdfGenerator');
const Setting = require('../models/Setting');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const { type, status, search } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { invoice_number: { $regex: search, $options: 'i' } },
      ];
    }

    const invoices = await Invoice.find(filter)
      .populate('client_id', 'name gstin city state contact email phone')
      .sort({ _id: -1 }).lean();

    const result = invoices.map((inv) => ({
      id: inv._id,
      ...inv,
      invoice_number: cleanInvoiceNumber(inv.invoice_number),
      client_name: inv.client_id?.name || '',
      client_id: inv.client_id?._id || inv.client_id,
    }));

    if (search) {
      const regex = new RegExp(search, 'i');
      return res.json(result.filter((inv) =>
        regex.test(inv.invoice_number) || regex.test(inv.client_name)
      ));
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

router.get('/next-number', authenticate, async (req, res) => {
  try {
    const type = req.query.type || 'tax';
    res.json({ number: await getNextInvoiceNumber(type) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate invoice number' });
  }
});

router.get('/:id/pdf', authenticate, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('client_id', 'name gstin address city state contact email phone')
      .lean();
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    // Get company and bank settings
    const settings = await Setting.find({ key: { $in: ['company', 'bank'] } }).lean();
    const settingsMap = {};
    settings.forEach((s) => { settingsMap[s.key] = s.value; });
    const company = settingsMap.company || {};
    const bank = settingsMap.bank || {};

    // Build full invoice object with client details
    const fullInvoice = {
      ...invoice,
      client_name: invoice.client_id?.name || '',
      client_gstin: invoice.client_id?.gstin || '',
      client_address: invoice.client_id?.address || '',
      client_city: invoice.client_id?.city || '',
      client_state: invoice.client_id?.state || '',
      client_contact: invoice.client_id?.contact || '',
      client_email: invoice.client_id?.email || '',
      client_phone: invoice.client_id?.phone || '',
    };

    const pdfBuffer = await generateInvoicePdfBuffer(fullInvoice, company, bank);
    const cleanNum = cleanInvoiceNumber(invoice.invoice_number) || 'draft';
    const filename = `Invoice-${cleanNum}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('client_id', 'name gstin address city state contact email phone')
      .lean();
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    res.json({
      id: invoice._id,
      ...invoice,
      invoice_number: cleanInvoiceNumber(invoice.invoice_number),
      client_name: invoice.client_id?.name || '',
      client_gstin: invoice.client_id?.gstin || '',
      client_address: invoice.client_id?.address || '',
      client_city: invoice.client_id?.city || '',
      client_state: invoice.client_id?.state || '',
      client_contact: invoice.client_id?.contact || '',
      client_email: invoice.client_id?.email || '',
      client_phone: invoice.client_id?.phone || '',
      client_id: invoice.client_id?._id || invoice.client_id,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const {
      invoice_number, client_id, invoice_type, tax_type,
      invoice_date, credit_period, place_of_supply, po_number,
      transport, vehicle_no, gr_rr_no, eway_bill,
      notes, terms, items, type,
    } = req.body;

    if (!client_id || !invoice_date) {
      return res.status(400).json({ error: 'Client and invoice date are required' });
    }

    const invoiceType = type || 'tax';
    const finalNumber = invoice_number || await getNextInvoiceNumber(invoiceType);
    const { processedItems, subtotal, taxableAmount, grandTotal } = processInvoiceItems(items);

    const invoice = await Invoice.create({
      invoice_number: finalNumber, client_id,
      invoice_type: invoice_type || 'Tax Invoice',
      tax_type: tax_type || 'IGST',
      invoice_date, credit_period: credit_period || null,
      place_of_supply: place_of_supply || null,
      po_number: po_number || null,
      transport: transport || null,
      vehicle_no: vehicle_no || null,
      gr_rr_no: gr_rr_no || null,
      eway_bill: eway_bill || null,
      notes: notes || null, terms: terms || null,
      subtotal, taxable_amount: taxableAmount,
      grand_total: grandTotal,
      amount_paid: 0,
      balance: grandTotal,
      status: 'Draft', type: invoiceType,
      items: processedItems,
    });

    const populated = await Invoice.findById(invoice._id)
      .populate('client_id', 'name').lean();

    res.status(201).json({
      id: populated._id, ...populated,
      client_name: populated.client_id?.name || '',
      client_id: populated.client_id?._id || populated.client_id,
    });
  } catch (err) {
    console.error('Invoice create error:', err);
    if (err.code === 11000) return res.status(409).json({ error: 'Invoice number already exists' });
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const existing = await Invoice.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Invoice not found' });

    const {
      status, client_id, invoice_type, tax_type,
      invoice_date, credit_period, place_of_supply, po_number,
      transport, vehicle_no, gr_rr_no, eway_bill,
      notes, terms, items,
    } = req.body;

    if (status && !items) {
      existing.status = status;
      await existing.save();
      return res.json({ id: existing._id, ...existing.toObject() });
    }

    if (!client_id || !invoice_date) {
      return res.status(400).json({ error: 'Client and invoice date are required' });
    }

    const { processedItems, subtotal, taxableAmount, grandTotal } = processInvoiceItems(items);

    existing.client_id = client_id;
    existing.invoice_type = invoice_type || 'Tax Invoice';
    existing.tax_type = tax_type || 'IGST';
    existing.invoice_date = invoice_date;
    existing.credit_period = credit_period || null;
    existing.place_of_supply = place_of_supply || null;
    existing.po_number = po_number || null;
    existing.transport = transport || null;
    existing.vehicle_no = vehicle_no || null;
    existing.gr_rr_no = gr_rr_no || null;
    existing.eway_bill = eway_bill || null;
    existing.notes = notes || null;
    existing.terms = terms || null;
    existing.subtotal = subtotal;
    existing.taxable_amount = taxableAmount;
    existing.grand_total = grandTotal;
    existing.balance = Math.round((grandTotal - existing.amount_paid) * 100) / 100;
    existing.status = status || existing.status;
    existing.items = processedItems;
    await existing.save();

    const populated = await Invoice.findById(existing._id)
      .populate('client_id', 'name').lean();

    res.json({
      id: populated._id, ...populated,
      client_name: populated.client_id?.name || '',
      client_id: populated.client_id?._id || populated.client_id,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const clientId = invoice.client_id;
    await Payment.deleteMany({ invoice_id: req.params.id });
    await Invoice.findByIdAndDelete(req.params.id);
    await recalcClientOutstanding(clientId);

    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

module.exports = router;
