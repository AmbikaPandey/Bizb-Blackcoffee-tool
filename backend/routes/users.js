const express = require('express');
const User = require('../models/User');
const Expense = require('../models/Expense');
const AuditLog = require('../models/AuditLog');
const { authenticate, authorize } = require('../middleware/auth');
const { getPresetForRole, sanitizePermissions } = require('../config/permissions');

const router = express.Router();

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const PHONE_RE = /^[+\d][\d\s\-().]{5,17}$/;;
const PINCODE_RE = /^\d{6}$/;

function sanitize(str) {
  return typeof str === 'string' ? str.replace(/[<>]/g, '').trim() : '';
}

function maskAccountNumber(num) {
  if (!num || num.length < 4) return num || '';
  return '●'.repeat(num.length - 4) + num.slice(-4);
}

// GET all users — Admin sees all, Manager sees Executives, others see only self
router.get('/', authenticate, async (req, res) => {
  try {
    let filter;
    if (req.user.role === 'Admin') filter = {};
    else if (req.user.role === 'Manager') filter = { $or: [{ role: 'Executive' }, { _id: req.user.id }] };
    else filter = { _id: req.user.id };

    const users = await User.find(filter)
      .select('-password')
      .sort({ username: 1 }).lean();
    res.json(users.map((u) => ({
      id: u._id, username: u.username, email: u.email, role: u.role,
      is_active: u.is_active, created_at: u.createdAt,
      contact_number: u.contact_number, designation: u.designation,
      employee_code: u.employee_code, address: u.address, pan: u.pan,
      pincode: u.pincode, office_branch: u.office_branch,
      bank_details: u.bank_details,
      permissions: u.permissions || {},
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET single user with reimbursement history
router.get('/:id', authenticate, async (req, res) => {
  try {
    const isSelf = String(req.user.id) === req.params.id;
    const user = await User.findById(req.params.id).select('-password').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Non-admin/manager can only view themselves
    if (!isSelf && req.user.role === 'Executive') {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!isSelf && req.user.role === 'Manager' && user.role !== 'Executive') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get reimbursement history
    const reimbursements = await Expense.find({
      submitted_by: user._id,
      status: { $in: ['Approved', 'Rejected'] },
    }).populate('project_id', 'name').populate('approved_by', 'username').sort({ _id: -1 }).lean();

    const maskedBank = user.bank_details ? {
      ...user.bank_details,
      account_number_masked: maskAccountNumber(user.bank_details.account_number),
    } : {};

    res.json({
      id: user._id, ...user,
      bank_details: { ...maskedBank, account_number: user.bank_details?.account_number || '' },
      reimbursements: reimbursements.map(e => ({
        id: e._id, description: e.description, amount: e.amount, date: e.date,
        category: e.category, status: e.status,
        project: e.project_id?.name || '',
        payment_status: e.payment_status || '',
        payment_date: e.payment_date || '',
        approved_by_name: e.approved_by?.username || '',
        approved_at: e.approved_at,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST create user
router.post('/', authenticate, authorize('users', 'create'), async (req, res) => {
  try {
    const { username, email, password, role, contact_number, address, employee_code, designation, bank_details, pan, pincode, office_branch, permissions } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (contact_number && !PHONE_RE.test(contact_number)) {
      return res.status(400).json({ error: 'Invalid phone number (10 digits starting with 6-9)' });
    }
    if (pan && !PAN_RE.test(pan)) {
      return res.status(400).json({ error: 'Invalid PAN format' });
    }
    if (pincode && !PINCODE_RE.test(pincode)) {
      return res.status(400).json({ error: 'Invalid pincode (must be 6 digits)' });
    }

    const assignedRole = req.user.role === 'Manager' ? 'Executive' : (role || 'Executive');
    if (req.user.role === 'Manager' && assignedRole !== 'Executive') {
      return res.status(403).json({ error: 'Managers can only create Executives' });
    }

    // Auto-generate employee code with BC- prefix if not provided
    let finalEmpCode = sanitize(employee_code);
    if (!finalEmpCode) {
      const lastUser = await User.findOne({ employee_code: /^BC-\d+$/ })
        .sort({ employee_code: -1 }).lean();
      let nextNum = 1;
      if (lastUser) {
        const match = lastUser.employee_code.match(/^BC-(\d+)$/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      finalEmpCode = `BC-${String(nextNum).padStart(3, '0')}`;
    } else if (!finalEmpCode.startsWith('BC-')) {
      finalEmpCode = `BC-${finalEmpCode}`;
    }

    // Compute permissions: use explicit permissions for Custom role, else use role preset
    const finalPermissions = assignedRole === 'Custom'
      ? sanitizePermissions(permissions)
      : getPresetForRole(assignedRole);

    const user = await User.create({
      username: sanitize(username), email, password, role: assignedRole,
      permissions: finalPermissions,
      contact_number: sanitize(contact_number),
      address: sanitize(address),
      employee_code: finalEmpCode,
      designation: sanitize(designation),
      pan: sanitize(pan),
      pincode: sanitize(pincode),
      office_branch: sanitize(office_branch),
      bank_details: bank_details || {},
    });

    await AuditLog.create({
      action: 'created', entity: 'User', entity_id: user._id,
      performed_by: req.user.id,
      details: `Created user ${user.username} (${user.role})`,
    });

    res.status(201).json(user.toSafeJSON());
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Email already in use' });
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT update user
router.put('/:id', authenticate, async (req, res) => {
  try {
    const isSelf = String(req.user.id) === req.params.id;
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    // Non-admin/manager can only edit themselves
    if (!isSelf && req.user.role === 'Executive') {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!isSelf && req.user.role === 'Manager' && target.role !== 'Executive') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { username, email, role, is_active, contact_number, address, employee_code, designation, bank_details, pan, pincode, office_branch, permissions } = req.body;

    if (contact_number && !PHONE_RE.test(contact_number)) {
      return res.status(400).json({ error: 'Invalid phone number (10 digits starting with 6-9)' });
    }
    if (pan && !PAN_RE.test(pan)) {
      return res.status(400).json({ error: 'Invalid PAN format' });
    }
    if (pincode && !PINCODE_RE.test(pincode)) {
      return res.status(400).json({ error: 'Invalid pincode (must be 6 digits)' });
    }

    // Non-admins editing self: can only change personal fields
    if (isSelf && req.user.role !== 'Admin') {
      if (contact_number !== undefined) target.contact_number = sanitize(contact_number);
      if (address !== undefined) target.address = sanitize(address);
      if (pan !== undefined) target.pan = sanitize(pan);
      if (pincode !== undefined) target.pincode = sanitize(pincode);
      if (office_branch !== undefined) target.office_branch = sanitize(office_branch);
      if (bank_details !== undefined) target.bank_details = bank_details;
      if (designation !== undefined) target.designation = sanitize(designation);
      // Cannot change: role, is_active, email, username, employee_code
    } else {
      if (username !== undefined) target.username = sanitize(username);
      if (email !== undefined) target.email = email;
      if (is_active !== undefined) target.is_active = is_active;
      if (contact_number !== undefined) target.contact_number = sanitize(contact_number);
      if (address !== undefined) target.address = sanitize(address);
      if (employee_code !== undefined) target.employee_code = sanitize(employee_code);
      if (designation !== undefined) target.designation = sanitize(designation);
      if (pan !== undefined) target.pan = sanitize(pan);
      if (pincode !== undefined) target.pincode = sanitize(pincode);
      if (office_branch !== undefined) target.office_branch = sanitize(office_branch);
      if (bank_details !== undefined) target.bank_details = bank_details;
      if (role !== undefined && req.user.role === 'Admin') {
        target.role = role;
        // When role changes, auto-apply preset (unless Custom)
        if (role !== 'Custom') {
          target.permissions = getPresetForRole(role);
        }
      }
      if (permissions !== undefined && req.user.role === 'Admin') {
        target.permissions = sanitizePermissions(permissions);
      }
    }

    await target.save();
    res.json(target.toSafeJSON());
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Email already in use' });
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// PUT change password — any user can change their own, Admin can change any, Manager can change Executives
router.put('/:id/password', authenticate, async (req, res) => {
  try {
    const isSelf = String(req.user.id) === req.params.id;
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    // Non-admin/manager can only change their own password
    if (!isSelf && req.user.role === 'Executive') {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!isSelf && req.user.role === 'Manager' && target.role !== 'Executive') {
      return res.status(403).json({ error: 'Access denied' });
    }

    target.password = password;
    await target.save();
    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// DELETE user
router.delete('/:id', authenticate, authorize('users', 'delete'), async (req, res) => {
  try {
    if (String(req.user.id) === req.params.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
