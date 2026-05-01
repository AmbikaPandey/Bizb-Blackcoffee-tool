const express = require('express');
const Project = require('../models/Project');
const Expense = require('../models/Expense');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET all projects — filtered by role
router.get('/', authenticate, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'Sales Manager') {
      filter = { assigned_manager: req.user.id };
    } else if (req.user.role === 'Sales Executive') {
      filter = { assigned_executives: req.user.id };
    }

    const projects = await Project.find(filter)
      .populate('client_id', 'name')
      .populate('assigned_manager', 'username')
      .populate('assigned_executives', 'username')
      .populate('products', 'name rate')
      .populate('vendors', 'name')
      .sort({ _id: -1 }).lean();
    res.json(projects.map((p) => ({
      id: p._id, ...p,
      client: p.client_id?.name || '',
      client_id: p.client_id?._id || p.client_id,
      manager_name: p.assigned_manager?.username || '',
      assigned_manager: p.assigned_manager?._id || p.assigned_manager,
      executives: (p.assigned_executives || []).map(e => ({ id: e._id, username: e.username })),
      assigned_executives: (p.assigned_executives || []).map(e => e._id),
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// GET single project
router.get('/:id', authenticate, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('client_id', 'name')
      .populate('assigned_manager', 'username')
      .populate('assigned_executives', 'username')
      .populate('products', 'name rate category')
      .populate('vendors', 'name city').lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Executives can only view their assigned projects
    if (req.user.role === 'Sales Executive' &&
      !project.assigned_executives.some(e => String(e._id) === String(req.user.id))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      id: project._id, ...project,
      client: project.client_id?.name || '',
      client_id: project.client_id?._id || project.client_id,
      manager_name: project.assigned_manager?.username || '',
      assigned_manager: project.assigned_manager?._id || project.assigned_manager,
      executives: (project.assigned_executives || []).map(e => ({ id: e._id, username: e.username })),
      assigned_executives: (project.assigned_executives || []).map(e => e._id),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// POST create project — Admin and Manager
router.post('/', authenticate, requireRole('Super Admin', 'Admin', 'Sales Manager'), async (req, res) => {
  try {
    const { name, client_id, budget, start_date, end_date, status, code, description, assigned_manager, assigned_executives, products, vendors, venue, revenue } = req.body;
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

    // Manager auto-assigns themselves
    const managerId = req.user.role === 'Sales Manager' ? req.user.id : (assigned_manager || null);

    const project = await Project.create({
      name: name.trim(), code: projectCode,
      client_id: client_id || null, budget,
      start_date, end_date, status: status || 'Active',
      description: description || '',
      assigned_manager: managerId,
      assigned_executives: assigned_executives || [],
      products: products || [],
      vendors: vendors || [],
      venue: venue || '',
      revenue: revenue || 0,
    });

    await AuditLog.create({
      action: 'created', entity: 'Project', entity_id: project._id,
      performed_by: req.user.id,
      details: `Created project "${project.name}"`,
    });

    res.status(201).json({ id: project._id, ...project.toObject() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// PUT update project — Admin and Manager (own projects)
router.put('/:id', authenticate, requireRole('Super Admin', 'Admin', 'Sales Manager'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Manager can only update their own projects
    if (req.user.role === 'Sales Manager' && String(project.assigned_manager) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updates = { ...req.body };
    if (!updates.client_id) updates.client_id = null;

    Object.assign(project, updates);
    await project.save();

    res.json({ id: project._id, ...project.toObject() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE project — Admin only
router.delete('/:id', authenticate, requireRole('Super Admin', 'Admin'), async (req, res) => {
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
