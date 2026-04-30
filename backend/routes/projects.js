const express = require('express');
const Project = require('../models/Project');
const Expense = require('../models/Expense');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const projects = await Project.find()
      .populate('client_id', 'name')
      .sort({ _id: -1 }).lean();
    res.json(projects.map((p) => ({
      id: p._id, ...p,
      client: p.client_id?.name || '',
      client_id: p.client_id?._id || p.client_id,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

router.get('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('client_id', 'name').lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({
      id: project._id, ...project,
      client: project.client_id?.name || '',
      client_id: project.client_id?._id || project.client_id,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, client_id, budget, start_date, end_date, status, code } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Project name is required' });

    let projectCode = code?.trim();
    if (!projectCode) {
      const year = new Date().getFullYear();
      const prefix = `PRJ-${year}-`;
      const last = await Project.findOne({ code: new RegExp(`^${prefix}`) })
        .sort({ _id: -1 }).select('code').lean();
      const num = last ? (parseInt(last.code.split('-').pop(), 10) || 0) + 1 : 1;
      projectCode = prefix + String(num).padStart(3, '0');
    }

    const project = await Project.create({ name: name.trim(), code: projectCode, client_id: client_id || null, budget, start_date, end_date, status: status || 'Active' });
    res.status(201).json({ id: project._id, ...project.toObject() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create project' });
  }
});

router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const updates = { ...req.body };
    if (!updates.client_id) updates.client_id = null;
    const project = await Project.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({ id: project._id, ...project });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update project' });
  }
});

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    await Expense.updateMany({ project_id: req.params.id }, { $set: { project_id: null } });
    await Project.findByIdAndDelete(req.params.id);
    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;
