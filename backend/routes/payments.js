const express = require('express');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const { authenticate, authorize } = require('../middleware/auth');
const { reconcileInvoice, recalcClientOutstanding, cleanInvoiceNumber } = require('../helpers/invoiceHelpers');

const router = express.Router();

router.get('/', authenticate, authorize('payments', 'view'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.invoice_id) filter.invoice_id = req.query.invoice_id;
    if (req.query.client_id) filter.client_id = req.query.client_id;

    const payments = await Payment.find(filter)
      .populate('client_id', 'name')
      .populate('invoice_id', 'invoice_number grand_total')
      .populate('invoice_ids', 'invoice_number grand_total')
      .sort({ _id: -1 }).lean();
    res.json(payments.map((p) => {
      const ids = p.invoice_ids?.length ? p.invoice_ids : (p.invoice_id ? [p.invoice_id] : []);
      return {
        id: p._id, ...p,
        client: p.client_id?.name || '',
        invoiceNo: ids.map((i) => cleanInvoiceNumber(i?.invoice_number || '')).filter(Boolean).join(', ') || '-',
        invoice_ids: ids.map((i) => i?._id || i),
        client_id: p.client_id?._id || p.client_id,
        invoice_id: p.invoice_id?._id || p.invoice_id,
        amount: Math.round(p.amount || 0),
      };
    }));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

router.get('/:id', authenticate, authorize('payments', 'view'), async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('client_id', 'name')
      .populate('invoice_id', 'invoice_number grand_total')
      .populate('invoice_ids', 'invoice_number grand_total').lean();
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    const ids = payment.invoice_ids?.length ? payment.invoice_ids : (payment.invoice_id ? [payment.invoice_id] : []);
    res.json({
      id: payment._id, ...payment,
      client: payment.client_id?.name || '',
      invoiceNo: ids.map((i) => cleanInvoiceNumber(i?.invoice_number || '')).filter(Boolean).join(', ') || '-',
      invoice_ids: ids.map((i) => i?._id || i),
      client_id: payment.client_id?._id || payment.client_id,
      invoice_id: payment.invoice_id?._id || payment.invoice_id,
      amount: Math.round(payment.amount || 0),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payment' });
  }
});

router.post('/', authenticate, authorize('payments', 'create'), async (req, res) => {
  try {
    const { client_id, invoice_ids: rawIds, invoice_id, amount, date, method, reference, notes } = req.body;
    // Support both invoice_ids (multi) and invoice_id (single legacy)
    const invoiceIds = Array.isArray(rawIds) && rawIds.length ? rawIds : (invoice_id ? [invoice_id] : []);

    if (!client_id || !amount || !date) {
      return res.status(400).json({ error: 'Client, amount, and date are required' });
    }

    for (const id of invoiceIds) {
      const inv = await Invoice.findById(id);
      if (!inv) return res.status(404).json({ error: `Invoice ${id} not found` });
      if (inv.status === 'Cancelled') return res.status(400).json({ error: 'Cannot record payment for a cancelled invoice' });
    }

    const payment = await Payment.create({
      client_id,
      invoice_id: invoiceIds[0] || null,
      invoice_ids: invoiceIds,
      amount: parseFloat(amount),
      date, method: method || 'Bank Transfer',
      reference: reference || '', notes: notes || '',
    });

    for (const id of invoiceIds) {
      await reconcileInvoice(id);
    }
    await recalcClientOutstanding(client_id);

    const populated = await Payment.findById(payment._id)
      .populate('client_id', 'name')
      .populate('invoice_ids', 'invoice_number grand_total').lean();
    const ids = populated.invoice_ids?.length ? populated.invoice_ids : [];
    res.status(201).json({
      id: populated._id, ...populated,
      client: populated.client_id?.name || '',
      invoiceNo: ids.map((i) => cleanInvoiceNumber(i?.invoice_number || '')).filter(Boolean).join(', ') || '-',
      invoice_ids: ids.map((i) => i?._id || i),
      amount: Math.round(populated.amount || 0),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

router.put('/:id', authenticate, authorize('payments', 'edit'), async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    const oldInvoiceId = payment.invoice_id;
    const oldClientId = payment.client_id;

    const { amount, date, method, reference, notes, invoice_id, client_id } = req.body;
    if (amount !== undefined) payment.amount = parseFloat(amount);
    if (date !== undefined) payment.date = date;
    if (method !== undefined) payment.method = method;
    if (reference !== undefined) payment.reference = reference;
    if (notes !== undefined) payment.notes = notes;
    if (invoice_id !== undefined) payment.invoice_id = invoice_id || null;
    if (client_id !== undefined) payment.client_id = client_id;
    await payment.save();

    if (oldInvoiceId) await reconcileInvoice(oldInvoiceId);
    if (payment.invoice_id && String(payment.invoice_id) !== String(oldInvoiceId)) {
      await reconcileInvoice(payment.invoice_id);
    }
    await recalcClientOutstanding(payment.client_id);
    if (String(oldClientId) !== String(payment.client_id)) {
      await recalcClientOutstanding(oldClientId);
    }

    const populated = await Payment.findById(payment._id)
      .populate('client_id', 'name')
      .populate('invoice_id', 'invoice_number grand_total').lean();
    res.json({
      id: populated._id, ...populated,
      client: populated.client_id?.name || '',
      invoiceNo: cleanInvoiceNumber(populated.invoice_id?.invoice_number || ''),
      amount: Math.round(populated.amount || 0),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

router.delete('/:id', authenticate, authorize('payments', 'delete'), async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    const { invoice_id, client_id } = payment;
    await Payment.findByIdAndDelete(req.params.id);

    if (invoice_id) await reconcileInvoice(invoice_id);
    await recalcClientOutstanding(client_id);

    res.json({ message: 'Payment deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

module.exports = router;
