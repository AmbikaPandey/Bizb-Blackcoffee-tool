const express = require('express');
const Client = require('../models/Client');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const { authenticate, requireRole } = require('../middleware/auth');
const { cleanInvoiceNumber } = require('../helpers/invoiceHelpers');

const router = express.Router();

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const PHONE_RE = /^[6-9]\d{9}$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

function sanitize(str) {
  return typeof str === 'string' ? str.replace(/[<>]/g, '').trim() : '';
}

router.get('/', authenticate, async (req, res) => {
  try {
    const clients = await Client.find().sort({ name: 1 }).lean();

    // Aggregate outstanding per client from invoices (excludes Paid & Cancelled)
    const outstandingAgg = await Invoice.aggregate([
      { $match: { status: { $nin: ['Paid', 'Cancelled'] } } },
      { $group: { _id: '$client_id', total: { $sum: '$balance' } } },
    ]);
    const outstandingMap = {};
    for (const row of outstandingAgg) {
      outstandingMap[String(row._id)] = Math.max(0, row.total || 0);
    }

    res.json(clients.map((c) => ({
      id: c._id, ...c,
      outstanding: outstandingMap[String(c._id)] || 0,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id).lean();
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const [invoices, payments] = await Promise.all([
      Invoice.find({ client_id: client._id, status: { $ne: 'Cancelled' } })
        .select('invoice_number invoice_date grand_total balance status')
        .sort({ invoice_date: -1 }).lean(),
      Payment.find({ client_id: client._id })
        .select('date amount method reference')
        .sort({ date: -1 }).lean(),
    ]);

    const totalInvoiced = invoices.reduce((s, inv) => s + (inv.grand_total || 0), 0);
    const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const outstanding = Math.max(0, totalInvoiced - totalPaid);

    const ledger = [];
    for (const inv of invoices) {
      const num = cleanInvoiceNumber(inv.invoice_number);
      ledger.push({ type: 'invoice', date: inv.invoice_date, reference: num, description: `Invoice #${num}`, debit: inv.grand_total, credit: 0 });
    }
    for (const pay of payments) {
      ledger.push({ type: 'payment', date: pay.date, reference: pay.reference || '', description: `Payment (${pay.method})${pay.reference ? ' - ' + pay.reference : ''}`, debit: 0, credit: pay.amount });
    }
    ledger.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    let runningBalance = 0;
    for (const entry of ledger) {
      runningBalance += entry.debit - entry.credit;
      entry.balance = runningBalance;
    }

    res.json({ id: client._id, ...client, totalInvoiced, totalPaid, outstanding, ledger });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

router.post('/', authenticate, requireRole('Super Admin', 'Admin', 'Sales Manager'), async (req, res) => {
  try {
    const { name, gstin, pan, contact, service_type, city, email, phone, state, address, pincode, latitude, longitude } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Client name is required' });
    if (pincode && !/^\d{6}$/.test(pincode)) return res.status(400).json({ error: 'Invalid pincode format' });
    if (phone && !PHONE_RE.test(phone)) return res.status(400).json({ error: 'Invalid phone number (10 digits starting with 6-9)' });
    if (pan && !PAN_RE.test(pan)) return res.status(400).json({ error: 'Invalid PAN format' });
    if (gstin && !GSTIN_RE.test(gstin)) return res.status(400).json({ error: 'Invalid GSTIN format' });
    const client = await Client.create({
      name: sanitize(name), gstin: sanitize(gstin), pan: sanitize(pan), contact: sanitize(contact),
      service_type: sanitize(service_type), city: sanitize(city), email: sanitize(email),
      phone: sanitize(phone), state: sanitize(state), address: sanitize(address),
      pincode: sanitize(pincode), latitude: latitude || null, longitude: longitude || null,
    });
    res.status(201).json({ id: client._id, ...client.toObject() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create client' });
  }
});

router.put('/:id', authenticate, requireRole('Super Admin', 'Admin', 'Sales Manager'), async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true }).lean();
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json({ id: client._id, ...client });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update client' });
  }
});

router.delete('/:id', authenticate, requireRole('Super Admin', 'Admin'), async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const invoiceCount = await Invoice.countDocuments({ client_id: req.params.id });
    if (invoiceCount > 0) {
      return res.status(400).json({ error: `Cannot delete client with ${invoiceCount} linked invoice(s). Delete invoices first.` });
    }

    await Payment.deleteMany({ client_id: req.params.id });
    await Client.findByIdAndDelete(req.params.id);
    res.json({ message: 'Client deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

module.exports = router;
