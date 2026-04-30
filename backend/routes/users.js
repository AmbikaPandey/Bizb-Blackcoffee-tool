const express = require('express');
const User = require('../models/User');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select('username email role is_active createdAt').sort({ username: 1 }).lean();
    res.json(users.map((u) => ({
      id: u._id, username: u.username, email: u.email, role: u.role,
      is_active: u.is_active, created_at: u.createdAt,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user._id, ...user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { username, email, role, is_active } = req.body;
    const update = {};
    if (username !== undefined) update.username = username;
    if (email !== undefined) update.email = email;
    if (role !== undefined) update.role = role;
    if (is_active !== undefined) update.is_active = is_active;

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .select('-password').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user._id, ...user });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Email already in use' });
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.put('/:id/password', authenticate, requireAdmin, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.password = password;
    await user.save();
    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update password' });
  }
});

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    if (req.user.id === req.params.id) {
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
