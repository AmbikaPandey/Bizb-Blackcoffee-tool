const express = require('express');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const Client = require('../models/Client');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { cleanInvoiceNumber } = require('../helpers/invoiceHelpers');

const router = express.Router();

router.get('/summary', authenticate, requireAdmin, async (req, res) => {
  try {
    const [totalRevenueResult, pendingResult, paidCount, unpaidCount, overdueCount, partialCount] = await Promise.all([
      Invoice.aggregate([
        { $match: { status: 'Paid' } },
        { $group: { _id: null, total: { $sum: '$grand_total' } } },
      ]),
      Invoice.aggregate([
        { $match: { status: { $nin: ['Paid', 'Cancelled'] } } },
        { $group: { _id: null, total: { $sum: '$balance' } } },
      ]),
      Invoice.countDocuments({ status: 'Paid' }),
      Invoice.countDocuments({ status: { $in: ['Draft', 'Sent'] } }),
      Invoice.countDocuments({ status: 'Overdue' }),
      Invoice.countDocuments({ status: 'Partially Paid' }),
    ]);

    res.json({
      totalRevenue: totalRevenueResult[0]?.total || 0,
      pendingAmount: pendingResult[0]?.total || 0,
      paidInvoices: paidCount,
      unpaidInvoices: unpaidCount,
      overdueInvoices: overdueCount,
      partiallyPaidInvoices: partialCount,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch report summary' });
  }
});

router.get('/monthly', authenticate, requireAdmin, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const [invoiceData, paymentData, expenseData] = await Promise.all([
      Invoice.aggregate([
        { $match: { invoice_date: { $gte: `${year}-01-01`, $lt: `${year + 1}-01-01` }, status: { $ne: 'Cancelled' } } },
        { $group: {
          _id: { $substr: ['$invoice_date', 5, 2] },
          invoiced: { $sum: '$grand_total' },
          count: { $sum: 1 },
        }},
      ]),
      Payment.aggregate([
        { $match: { date: { $gte: `${year}-01-01`, $lt: `${year + 1}-01-01` } } },
        { $group: {
          _id: { $substr: ['$date', 5, 2] },
          collected: { $sum: '$amount' },
        }},
      ]),
      Expense.aggregate([
        { $match: { date: { $gte: `${year}-01-01`, $lt: `${year + 1}-01-01` } } },
        { $group: {
          _id: { $substr: ['$date', 5, 2] },
          expenses: { $sum: '$amount' },
        }},
      ]),
    ]);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const result = monthNames.map((name, i) => {
      const mm = String(i + 1).padStart(2, '0');
      const inv = invoiceData.find((d) => d._id === mm);
      const pay = paymentData.find((d) => d._id === mm);
      const exp = expenseData.find((d) => d._id === mm);
      return {
        month: name,
        invoiced: inv?.invoiced || 0,
        invoiceCount: inv?.count || 0,
        collected: pay?.collected || 0,
        expenses: exp?.expenses || 0,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch monthly report' });
  }
});

// ── Ageing Report ──────────────────────────────
router.get('/ageing', authenticate, requireAdmin, async (req, res) => {
  try {
    const today = new Date();
    const invoices = await Invoice.find({
      status: { $nin: ['Paid', 'Cancelled'] },
      balance: { $gt: 0 },
    }).populate('client_id', 'name').lean();

    const buckets = { current: 0, '1_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0 };
    const clientMap = {};

    for (const inv of invoices) {
      const invoiceDate = new Date(inv.invoice_date);
      const creditDays = inv.credit_period || 0;
      const dueDate = new Date(invoiceDate.getTime() + creditDays * 24 * 60 * 60 * 1000);
      const daysOverdue = Math.max(0, Math.floor((today - dueDate) / (1000 * 60 * 60 * 24)));
      const balance = inv.balance || 0;
      const clientName = inv.client_id?.name || 'Unknown';
      const clientId = String(inv.client_id?._id || inv.client_id);

      let bucket;
      if (daysOverdue <= 0) bucket = 'current';
      else if (daysOverdue <= 30) bucket = '1_30';
      else if (daysOverdue <= 60) bucket = '31_60';
      else if (daysOverdue <= 90) bucket = '61_90';
      else bucket = '90_plus';

      buckets[bucket] += balance;

      if (!clientMap[clientId]) {
        clientMap[clientId] = { client: clientName, current: 0, '1_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0, total: 0 };
      }
      clientMap[clientId][bucket] += balance;
      clientMap[clientId].total += balance;
    }

    const totalOutstanding = Object.values(buckets).reduce((s, v) => s + v, 0);
    const clients = Object.values(clientMap).sort((a, b) => b.total - a.total);

    res.json({ buckets, totalOutstanding, clients });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ageing report' });
  }
});

// ── GST Summary ──────────────────────────────
router.get('/gst-summary', authenticate, requireAdmin, async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = { status: { $nin: ['Draft', 'Cancelled'] } };
    if (from) filter.invoice_date = { ...(filter.invoice_date || {}), $gte: from };
    if (to) filter.invoice_date = { ...(filter.invoice_date || {}), $lte: to };

    const invoices = await Invoice.find(filter)
      .populate('client_id', 'name gstin state')
      .sort({ invoice_date: 1 }).lean();

    let totalTaxable = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0, totalAmount = 0;
    const rows = invoices.map((inv) => {
      const taxable = inv.taxable_amount || 0;
      const tax = inv.grand_total - inv.taxable_amount;
      let cgst = 0, sgst = 0, igst = 0;
      if (inv.tax_type === 'CGST/SGST') { cgst = tax / 2; sgst = tax / 2; }
      else { igst = tax; }

      totalTaxable += taxable;
      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;
      totalAmount += inv.grand_total;

      return {
        id: inv._id,
        invoice_number: cleanInvoiceNumber(inv.invoice_number),
        date: inv.invoice_date,
        client: inv.client_id?.name || '',
        gstin: inv.client_id?.gstin || '',
        taxable, cgst, sgst, igst,
        total: inv.grand_total,
      };
    });

    res.json({ rows, totals: { taxable: totalTaxable, cgst: totalCgst, sgst: totalSgst, igst: totalIgst, total: totalAmount } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch GST summary' });
  }
});

// ── Client Ledger ──────────────────────────────
router.get('/client-ledger', authenticate, requireAdmin, async (req, res) => {
  try {
    const { client_id, from, to } = req.query;
    if (!client_id) return res.status(400).json({ error: 'client_id is required' });

    const client = await Client.findById(client_id).select('name gstin').lean();
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const invFilter = { client_id };
    const payFilter = { client_id };
    if (from) {
      invFilter.invoice_date = { $gte: from };
      payFilter.date = { $gte: from };
    }
    if (to) {
      invFilter.invoice_date = { ...(invFilter.invoice_date || {}), $lte: to };
      payFilter.date = { ...(payFilter.date || {}), $lte: to };
    }

    const [invoices, payments] = await Promise.all([
      Invoice.find(invFilter).select('invoice_number invoice_date grand_total balance status').sort({ invoice_date: 1 }).lean(),
      Payment.find(payFilter).select('date amount method reference').sort({ date: 1 }).lean(),
    ]);

    const entries = [];
    for (const inv of invoices) {
      const num = cleanInvoiceNumber(inv.invoice_number);
      entries.push({ type: 'invoice', date: inv.invoice_date, reference: num, description: `Invoice #${num}`, debit: inv.grand_total, credit: 0, status: inv.status });
    }
    for (const pay of payments) {
      entries.push({ type: 'payment', date: pay.date, reference: pay.reference || '', description: `Payment (${pay.method})${pay.reference ? ' - ' + pay.reference : ''}`, debit: 0, credit: pay.amount });
    }
    entries.sort((a, b) => a.date.localeCompare(b.date));

    let runningBalance = 0;
    for (const entry of entries) {
      runningBalance += entry.debit - entry.credit;
      entry.balance = runningBalance;
    }

    const totalInvoiced = invoices.reduce((s, inv) => s + (inv.grand_total || 0), 0);
    const outstanding = invoices.filter(inv => inv.status !== 'Paid' && inv.status !== 'Cancelled').reduce((s, inv) => s + (inv.balance || 0), 0);

    res.json({ client: { name: client.name, gstin: client.gstin }, entries, totalInvoiced, outstanding, closingBalance: runningBalance });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch client ledger' });
  }
});

// ── Employee Reimbursements ──────────────────────────────
router.get('/reimbursements', authenticate, requireAdmin, async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = {};
    if (from) filter.date = { $gte: from };
    if (to) filter.date = { ...(filter.date || {}), $lte: to };

    const expenses = await Expense.find(filter).sort({ date: -1 }).lean();

    const employeeMap = {};
    for (const exp of expenses) {
      const name = exp.paid_by || 'Unassigned';
      if (!employeeMap[name]) {
        employeeMap[name] = { name, totalAmount: 0, approved: 0, pending: 0, count: 0, items: [] };
      }
      employeeMap[name].totalAmount += exp.amount;
      employeeMap[name].count += 1;
      if (exp.status === 'Reimbursed') employeeMap[name].approved += exp.amount;
      else employeeMap[name].pending += exp.amount;
      employeeMap[name].items.push({
        id: exp._id, description: exp.description, category: exp.category,
        amount: exp.amount, date: exp.date, status: exp.status,
      });
    }

    const employees = Object.values(employeeMap).sort((a, b) => b.totalAmount - a.totalAmount);
    const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);
    const totalPending = expenses.filter((e) => e.status !== 'Reimbursed').reduce((s, e) => s + e.amount, 0);
    const totalReimbursed = expenses.filter((e) => e.status === 'Reimbursed').reduce((s, e) => s + e.amount, 0);

    res.json({ employees, totals: { total: totalAmount, pending: totalPending, reimbursed: totalReimbursed, count: expenses.length } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reimbursements' });
  }
});

module.exports = router;
