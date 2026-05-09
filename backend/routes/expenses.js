const express = require('express');
const Expense = require('../models/Expense');
const Project = require('../models/Project');
const AuditLog = require('../models/AuditLog');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

function sanitize(str) {
  return typeof str === 'string' ? str.replace(/[<>]/g, '').trim() : '';
}

// GET expenses — Admin/Manager see all (with filters), Executive sees own
router.get('/', authenticate, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'Executive') {
      filter = { submitted_by: req.user.id };
    }

    // Optional query filters for Admin/Manager
    if (req.user.role !== 'Executive') {
      if (req.query.project_id) filter.project_id = req.query.project_id;
      if (req.query.submitted_by) filter.submitted_by = req.query.submitted_by;
      if (req.query.status) filter.status = req.query.status;
      if (req.query.from || req.query.to) {
        filter.date = {};
        if (req.query.from) filter.date.$gte = req.query.from;
        if (req.query.to) filter.date.$lte = req.query.to;
      }
    }

    const expenses = await Expense.find(filter)
      .populate('project_id', 'name')
      .populate('submitted_by', 'username')
      .populate('approved_by', 'username')
      .sort({ _id: -1 }).lean();
    res.json(expenses.map((e) => ({
      id: e._id, ...e,
      project: e.project_id?.name || '',
      project_id: e.project_id?._id || e.project_id,
      submitted_by_name: e.submitted_by?.username || '',
      submitted_by: e.submitted_by?._id || e.submitted_by,
      approved_by_name: e.approved_by?.username || '',
      approved_by: e.approved_by?._id || e.approved_by,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// GET reimbursements for a specific user
router.get('/user/:userId', authenticate, authorize('expenses', 'view'), async (req, res) => {
  try {
    const expenses = await Expense.find({ submitted_by: req.params.userId, status: { $in: ['Approved', 'Rejected'] } })
      .populate('project_id', 'name')
      .populate('approved_by', 'username')
      .sort({ _id: -1 }).lean();
    res.json(expenses.map((e) => ({
      id: e._id, ...e,
      project: e.project_id?.name || '',
      project_id: e.project_id?._id || e.project_id,
      approved_by_name: e.approved_by?.username || '',
      approved_by: e.approved_by?._id || e.approved_by,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user expenses' });
  }
});

router.get('/stats', authenticate, authorize('expenses', 'view'), async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    const [totalResult, pendingResult, monthResult, count, approvedUnpaid] = await Promise.all([
      Expense.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
      Expense.aggregate([{ $match: { status: 'Pending' } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
      Expense.aggregate([{ $match: { date: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Expense.countDocuments(),
      Expense.aggregate([{ $match: { status: 'Approved', payment_status: { $ne: 'Paid' } } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    ]);

    res.json({
      totalExpenses: count,
      totalAmount: totalResult[0]?.total || 0,
      pendingAmount: pendingResult[0]?.total || 0,
      pendingCount: pendingResult[0]?.count || 0,
      thisMonth: monthResult[0]?.total || 0,
      unpaidReimbursements: approvedUnpaid[0]?.total || 0,
      unpaidReimbursementCount: approvedUnpaid[0]?.count || 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch expense stats' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id)
      .populate('project_id', 'name')
      .populate('submitted_by', 'username')
      .populate('approved_by', 'username').lean();
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    // Executive can only view own expenses
    if (req.user.role === 'Executive' && String(expense.submitted_by?._id || expense.submitted_by) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      id: expense._id, ...expense,
      project: expense.project_id?.name || '',
      project_id: expense.project_id?._id || expense.project_id,
      submitted_by_name: expense.submitted_by?.username || '',
      submitted_by: expense.submitted_by?._id || expense.submitted_by,
      approved_by_name: expense.approved_by?.username || '',
      approved_by: expense.approved_by?._id || expense.approved_by,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

// POST create expense — All roles, but Executive must be assigned to project
router.post('/', authenticate, async (req, res) => {
  try {
    const { description, category, amount, date, paid_by, project_id, status, receipt_url, notes, invoice_number } = req.body;
    if (!description || !amount) return res.status(400).json({ error: 'Description and amount are required' });

    // If Executive, validate they are assigned to the project
    if (req.user.role === 'Executive') {
      if (!project_id) return res.status(400).json({ error: 'Project is required' });
      const project = await Project.findById(project_id).lean();
      if (!project) return res.status(404).json({ error: 'Project not found' });
      if (!project.assigned_executives.map(String).includes(String(req.user.id))) {
        return res.status(403).json({ error: 'You are not assigned to this project' });
      }
    }

    const expense = await Expense.create({
      description: sanitize(description), category, amount, date,
      paid_by: sanitize(paid_by),
      invoice_number: sanitize(invoice_number),
      project_id: project_id || null,
      submitted_by: req.user.id,
      status: req.user.role === 'Executive' ? 'Pending' : (status || 'Pending'),
      receipt_url: sanitize(receipt_url),
      notes: sanitize(notes),
    });

    await AuditLog.create({
      action: 'submitted', entity: 'Expense', entity_id: expense._id,
      performed_by: req.user.id,
      details: `Expense of ${amount} submitted`,
    });

    res.status(201).json({ id: expense._id, ...expense.toObject() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// PUT update expense — Admin can update status/invoice_number; Executive can only edit own pending
router.put('/:id', authenticate, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    if (req.user.role === 'Executive') {
      if (String(expense.submitted_by) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (expense.status !== 'Pending') {
        return res.status(400).json({ error: 'Can only edit pending expenses' });
      }
      // Executive can only update description, amount, date, receipt
      const { description, amount, date, receipt_url, notes } = req.body;
      if (description !== undefined) expense.description = sanitize(description);
      if (amount !== undefined) expense.amount = amount;
      if (date !== undefined) expense.date = date;
      if (receipt_url !== undefined) expense.receipt_url = sanitize(receipt_url);
      if (notes !== undefined) expense.notes = sanitize(notes);
    } else if (req.user.role === 'Manager') {
      // Manager can update most fields but NOT status or invoice_number
      const { description, category, amount, date, paid_by, project_id, receipt_url, notes } = req.body;
      if (description !== undefined) expense.description = sanitize(description);
      if (category !== undefined) expense.category = category;
      if (amount !== undefined) expense.amount = amount;
      if (date !== undefined) expense.date = date;
      if (paid_by !== undefined) expense.paid_by = sanitize(paid_by);
      if (project_id !== undefined) expense.project_id = project_id || null;
      if (receipt_url !== undefined) expense.receipt_url = sanitize(receipt_url);
      if (notes !== undefined) expense.notes = sanitize(notes);
    } else {
      // Admin can update everything including status and invoice_number
      const { description, category, amount, date, paid_by, project_id, status, receipt_url, notes, invoice_number, payment_status, payment_date, paid_from_account } = req.body;
      if (description !== undefined) expense.description = sanitize(description);
      if (category !== undefined) expense.category = category;
      if (amount !== undefined) expense.amount = amount;
      if (date !== undefined) expense.date = date;
      if (paid_by !== undefined) expense.paid_by = sanitize(paid_by);
      if (project_id !== undefined) expense.project_id = project_id || null;
      if (receipt_url !== undefined) expense.receipt_url = sanitize(receipt_url);
      if (notes !== undefined) expense.notes = sanitize(notes);
      if (invoice_number !== undefined) expense.invoice_number = sanitize(invoice_number);

      // Status change handling
      if (status !== undefined && status !== expense.status) {
        expense.status = status;
        if (status === 'Approved') {
          expense.approved_by = req.user.id;
          expense.approved_at = new Date();
          expense.payment_status = expense.payment_status || 'Unpaid';
        }
        await AuditLog.create({
          action: status.toLowerCase(), entity: 'Expense', entity_id: expense._id,
          performed_by: req.user.id,
          details: `Expense ${status.toLowerCase()} by Admin`,
        });
      }

      // Reimbursement payment updates
      if (payment_status !== undefined) expense.payment_status = payment_status;
      if (payment_date !== undefined) expense.payment_date = payment_date;
      if (paid_from_account !== undefined) expense.paid_from_account = sanitize(paid_from_account);
    }

    await expense.save();

    // Populate before returning
    await expense.populate('project_id', 'name');
    await expense.populate('submitted_by', 'username');
    await expense.populate('approved_by', 'username');
    const obj = expense.toObject();

    res.json({
      id: obj._id, ...obj,
      project: obj.project_id?.name || '',
      project_id: obj.project_id?._id || obj.project_id,
      submitted_by_name: obj.submitted_by?.username || '',
      submitted_by: obj.submitted_by?._id || obj.submitted_by,
      approved_by_name: obj.approved_by?.username || '',
      approved_by: obj.approved_by?._id || obj.approved_by,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// DELETE expense — Admin only
router.delete('/:id', authenticate, authorize('expenses', 'delete'), async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// Export CSV
router.get('/export/csv', authenticate, authorize('expenses', 'export'), async (req, res) => {
  try {
    const expenses = await Expense.find()
      .populate('project_id', 'name')
      .populate('submitted_by', 'username')
      .sort({ _id: -1 }).lean();

    const header = 'Date,Description,Category,Amount,Paid By,Invoice No,Project,Submitted By,Status,Payment Status\n';
    const rows = expenses.map(e =>
      [e.date, `"${(e.description || '').replace(/"/g, '""')}"`, e.category, e.amount, e.paid_by, e.invoice_number, e.project_id?.name || '', e.submitted_by?.username || '', e.status, e.payment_status || ''].join(',')
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=expenses.csv');
    res.send(header + rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export expenses' });
  }
});

module.exports = router;
