const express = require('express');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const { authenticate, authorize } = require('../middleware/auth');
const { getNextInvoiceNumber, processInvoiceItems, recalcClientOutstanding, cleanInvoiceNumber } = require('../helpers/invoiceHelpers');
const { generateInvoicePdfBuffer, cleanInvoiceNumber: pdfClean } = require('../helpers/pdfGenerator');
const Setting = require('../models/Setting');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const { type, status, search } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (status) {
      if (status === 'Overdue') {
        // Match invoices explicitly marked Overdue OR unpaid invoices whose credit period has elapsed
        filter.$or = [
          { status: 'Overdue' },
          {
            status: { $in: ['Draft', 'Sent', 'Partially Paid'] },
            balance: { $gt: 0 },
            credit_period: { $ne: null },
            $expr: {
              $lt: [
                { $dateAdd: { startDate: { $dateFromString: { dateString: '$invoice_date' } }, unit: 'day', amount: '$credit_period' } },
                new Date(),
              ],
            },
          },
        ];
      } else {
        filter.status = status;
      }
    }
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
      grand_total: Math.round(inv.grand_total || 0),
      balance: Math.round(inv.balance || 0),
      subtotal: Math.round(inv.subtotal || 0),
      taxable_amount: Math.round(inv.taxable_amount || 0),
      amount_paid: Math.round(inv.amount_paid || 0),
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
    // Use stored contact_person if available (preserves snapshot at invoice creation)
    const cp = invoice.contact_person;
    const fullInvoice = {
      ...invoice,
      client_name: invoice.client_id?.name || '',
      client_gstin: invoice.client_id?.gstin || '',
      client_address: invoice.client_id?.address || '',
      client_city: invoice.client_id?.city || '',
      client_state: invoice.client_id?.state || '',
      client_contact: cp?.name || invoice.client_id?.contact || '',
      client_email: cp?.email || invoice.client_id?.email || '',
      client_phone: cp?.phone || invoice.client_id?.phone || '',
    };

    const pdfBuffer = await generateInvoicePdfBuffer(fullInvoice, company, bank, { mode: req.query.mode || 'download' });
    const cleanNum = cleanInvoiceNumber(invoice.invoice_number) || 'draft';
    const filename = `Invoice-${cleanNum}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': req.query.mode === 'print' ? 'inline' : `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  } catch (err) {
    logger.error('PDF generation error: ' + err.message);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('client_id', 'name gstin address city state contact email phone contacts')
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
      client_contacts: invoice.client_id?.contacts || [],
      client_id: invoice.client_id?._id || invoice.client_id,
      grand_total: Math.round(invoice.grand_total || 0),
      balance: Math.round(invoice.balance || 0),
      subtotal: Math.round(invoice.subtotal || 0),
      taxable_amount: Math.round(invoice.taxable_amount || 0),
      amount_paid: Math.round(invoice.amount_paid || 0),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

router.post('/', authenticate, authorize('invoices', 'create'), async (req, res) => {
  try {
    const {
      invoice_number, client_id, invoice_type, tax_type,
      invoice_date, credit_period, place_of_supply, po_number, po_date, contact_person,
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
      po_date: po_date || null,
      contact_person: contact_person || null,
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
      grand_total: Math.round(populated.grand_total || 0),
      balance: Math.round(populated.balance || 0),
      subtotal: Math.round(populated.subtotal || 0),
      taxable_amount: Math.round(populated.taxable_amount || 0),
      amount_paid: Math.round(populated.amount_paid || 0),
    });
  } catch (err) {
    logger.error('Invoice create error: ' + err.message);
    if (err.code === 11000) return res.status(409).json({ error: 'Invoice number already exists' });
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

router.put('/:id', authenticate, authorize('invoices', 'edit'), async (req, res) => {
  try {
    const existing = await Invoice.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Invoice not found' });

    const {
      status, client_id, invoice_type, tax_type,
      invoice_date, credit_period, place_of_supply, po_number, po_date, contact_person,
      transport, vehicle_no, gr_rr_no, eway_bill,
      notes, terms, items, type,
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
    if (type) existing.type = type;
    existing.tax_type = tax_type || 'IGST';
    existing.invoice_date = invoice_date;
    existing.credit_period = credit_period || null;
    existing.place_of_supply = place_of_supply || null;
    existing.po_number = po_number || null;
    existing.po_date = po_date || null;
    if (contact_person !== undefined) existing.contact_person = contact_person || null;
    existing.transport = transport || null;
    existing.vehicle_no = vehicle_no || null;
    existing.gr_rr_no = gr_rr_no || null;
    existing.eway_bill = eway_bill || null;
    existing.notes = notes || null;
    existing.terms = terms || null;
    existing.subtotal = subtotal;
    existing.taxable_amount = taxableAmount;
    existing.grand_total = grandTotal;
    existing.balance = Math.round(grandTotal - existing.amount_paid);
    existing.status = status || existing.status;
    existing.items = processedItems;
    await existing.save();

    const populated = await Invoice.findById(existing._id)
      .populate('client_id', 'name').lean();

    res.json({
      id: populated._id, ...populated,
      client_name: populated.client_id?.name || '',
      client_id: populated.client_id?._id || populated.client_id,
      grand_total: Math.round(populated.grand_total || 0),
      balance: Math.round(populated.balance || 0),
      subtotal: Math.round(populated.subtotal || 0),
      taxable_amount: Math.round(populated.taxable_amount || 0),
      amount_paid: Math.round(populated.amount_paid || 0),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

router.delete('/:id', authenticate, authorize('invoices', 'delete'), async (req, res) => {
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
