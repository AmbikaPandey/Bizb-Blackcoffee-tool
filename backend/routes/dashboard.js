const express = require('express');
const Client = require('../models/Client');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Project = require('../models/Project');
const { authenticate, requireRole } = require('../middleware/auth');
const { cleanInvoiceNumber } = require('../helpers/invoiceHelpers');

const router = express.Router();

router.get('/stats', authenticate, requireRole('Admin', 'Manager'), async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    const [totalClients, totalInvoices, outstandingResult, overdueInvoices, revenueResult, collectionsResult, totalRevenueResult, recentInvoices, pendingPayments, recentTransactions, activeProjects] = await Promise.all([
      Client.countDocuments(),
      Invoice.countDocuments(),
      Invoice.aggregate([
        { $match: { status: { $nin: ['Paid', 'Cancelled'] } } },
        { $group: { _id: null, total: { $sum: '$balance' } } },
      ]),
      Invoice.countDocuments({ status: 'Overdue' }),
      Invoice.aggregate([
        { $match: { status: 'Paid', invoice_date: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$grand_total' } } },
      ]),
      Payment.aggregate([
        { $match: { date: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Invoice.aggregate([
        { $match: { status: 'Paid' } },
        { $group: { _id: null, total: { $sum: '$grand_total' } } },
      ]),
      Invoice.find().populate('client_id', 'name').sort({ _id: -1 }).limit(5).lean(),
      Invoice.find({ status: { $in: ['Draft', 'Sent', 'Overdue', 'Partially Paid'] }, credit_period: { $ne: null } })
        .populate('client_id', 'name').sort({ invoice_date: 1 }).limit(5).lean(),
      Payment.find().populate('client_id', 'name').populate('invoice_id', 'invoice_number').sort({ _id: -1 }).limit(10).lean(),
      Project.countDocuments({ status: { $regex: /^active$/i } }),
    ]);

    res.json({
      totalClients, totalInvoices, activeProjects,
      totalRevenue: totalRevenueResult[0]?.total || 0,
      outstanding: outstandingResult[0]?.total || 0,
      overdueInvoices,
      thisMonthRevenue: revenueResult[0]?.total || 0,
      thisMonthCollections: collectionsResult[0]?.total || 0,
      recentInvoices: recentInvoices.map((inv) => ({
        id: inv._id,
        invoice_number: cleanInvoiceNumber(inv.invoice_number),
        client: inv.client_id?.name || '',
        amount: inv.grand_total,
        balance: inv.balance,
        status: inv.status,
        date: inv.invoice_date,
      })),
      pendingPayments: pendingPayments.map((inv) => ({
        id: inv._id,
        invoice_number: cleanInvoiceNumber(inv.invoice_number),
        client: inv.client_id?.name || '',
        creditPeriod: inv.credit_period,
        balance: inv.balance,
      })),
      recentTransactions: recentTransactions.map((p) => ({
        id: p._id,
        client: p.client_id?.name || '',
        invoiceNo: cleanInvoiceNumber(p.invoice_id?.invoice_number || ''),
        amount: p.amount,
        date: p.date,
        method: p.method,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Client map data - returns clients with coordinates
router.get('/client-map', authenticate, requireRole('Admin', 'Manager'), async (req, res) => {
  try {
    const filter = { latitude: { $exists: true, $type: 'number' }, longitude: { $exists: true, $type: 'number' } };
    if (req.query.service_type) filter.service_type = req.query.service_type;
    if (req.query.state) filter.state = req.query.state;

    const clients = await Client.find(filter)
      .select('name service_type city state latitude longitude')
      .sort({ name: 1 }).lean();

    res.json(clients.map(c => ({ id: c._id, ...c })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch client map data' });
  }
});

module.exports = router;
