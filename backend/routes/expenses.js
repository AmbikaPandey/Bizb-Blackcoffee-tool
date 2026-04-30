const express = require('express');
const Expense = require('../models/Expense');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const expenses = await Expense.find()
      .populate('project_id', 'name')
      .sort({ _id: -1 }).lean();
    res.json(expenses.map((e) => ({
      id: e._id, ...e,
      project: e.project_id?.name || '',
      project_id: e.project_id?._id || e.project_id,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

router.get('/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    const [totalResult, pendingResult, monthResult, count] = await Promise.all([
      Expense.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
      Expense.aggregate([{ $match: { status: 'Pending' } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
      Expense.aggregate([{ $match: { date: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Expense.countDocuments(),
    ]);

    res.json({
      totalExpenses: count,
      totalAmount: totalResult[0]?.total || 0,
      pendingAmount: pendingResult[0]?.total || 0,
      pendingCount: pendingResult[0]?.count || 0,
      thisMonth: monthResult[0]?.total || 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch expense stats' });
  }
});

router.get('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id)
      .populate('project_id', 'name').lean();
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.json({
      id: expense._id, ...expense,
      project: expense.project_id?.name || '',
      project_id: expense.project_id?._id || expense.project_id,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { description, category, amount, date, paid_by, project_id, status } = req.body;
    if (!description || !amount) return res.status(400).json({ error: 'Description and amount are required' });
    const expense = await Expense.create({ description, category, amount, date, paid_by, project_id: project_id || null, status: status || 'Pending' });
    res.status(201).json({ id: expense._id, ...expense.toObject() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const expense = await Expense.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).lean();
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.json({ id: expense._id, ...expense });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

module.exports = router;
