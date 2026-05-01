const express = require('express');
const AuditLog = require('../models/AuditLog');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET audit logs — Super Admin and Admin only
router.get('/', authenticate, requireRole('Super Admin', 'Admin'), async (req, res) => {
  try {
    const { entity, entity_id, performed_by, from, to, action, limit: qLimit } = req.query;
    const filter = {};
    if (entity) filter.entity = entity;
    if (entity_id) filter.entity_id = entity_id;
    if (performed_by) filter.performed_by = performed_by;
    if (action) filter.action = { $regex: action, $options: 'i' };
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to + 'T23:59:59.999Z');
    }

    const limit = Math.min(parseInt(qLimit, 10) || 100, 500);
    const logs = await AuditLog.find(filter)
      .populate('performed_by', 'username email role')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json(logs.map(l => ({
      id: l._id,
      action: l.action,
      entity: l.entity,
      entity_id: l.entity_id,
      performed_by: l.performed_by?._id || l.performed_by,
      performed_by_name: l.performed_by?.username || '',
      performed_by_email: l.performed_by?.email || '',
      performed_by_role: l.performed_by?.role || '',
      details: l.details,
      ip_address: l.ip_address,
      changes: l.changes,
      created_at: l.createdAt,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// GET audit stats
router.get('/stats', authenticate, requireRole('Super Admin', 'Admin'), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [todayCount, weekCount, totalCount, topUsers, entityBreakdown] = await Promise.all([
      AuditLog.countDocuments({ createdAt: { $gte: today } }),
      AuditLog.countDocuments({ createdAt: { $gte: weekAgo } }),
      AuditLog.countDocuments(),
      AuditLog.aggregate([
        { $match: { createdAt: { $gte: weekAgo } } },
        { $group: { _id: '$performed_by', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        { $project: { username: '$user.username', count: 1 } },
      ]),
      AuditLog.aggregate([
        { $match: { createdAt: { $gte: weekAgo } } },
        { $group: { _id: '$entity', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    res.json({ todayCount, weekCount, totalCount, topUsers, entityBreakdown });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit stats' });
  }
});

module.exports = router;
