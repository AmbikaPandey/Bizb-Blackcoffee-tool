const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Session = require('../models/Session');
const { authenticate, requireAdmin, authorize } = require('../middleware/auth');

const router = express.Router();

// Rate limit login — 5 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Login ────────────────────────────────────────────
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = await User.findOne({ email: email.toLowerCase(), is_active: true });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresMinutes = parseInt(process.env.SESSION_EXPIRY_MINUTES, 10) || 20;
    const expires_at = new Date(Date.now() + expiresMinutes * 60 * 1000);

    await Session.create({
      user_id: user._id,
      token,
      expires_at,
      ip_address: req.ip || req.connection?.remoteAddress,
      user_agent: req.headers['user-agent'] || null,
      last_active_at: new Date(),
    });

    const userPerms = user.permissions ? user.permissions.toObject() : {};
    res.json({
      token,
      user: {
        id: user._id, username: user.username, email: user.email,
        role: user.role, permissions: userPerms,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── Logout (current session) ─────────────────────────
router.post('/logout', authenticate, async (req, res) => {
  try {
    await Session.deleteOne({ token: req.token });
    res.json({ message: 'Logged out' });
  } catch (err) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ── Logout all sessions ──────────────────────────────
router.post('/logout-all', authenticate, async (req, res) => {
  try {
    const result = await Session.deleteMany({ user_id: req.user.id });
    res.json({ message: `Logged out from ${result.deletedCount} session(s)` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to logout all sessions' });
  }
});

// ── Current user ─────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  res.json(req.user);
});

// ── List active sessions for current user ────────────
router.get('/sessions', authenticate, async (req, res) => {
  try {
    const sessions = await Session.find(
      { user_id: req.user.id, expires_at: { $gt: new Date() } },
      'ip_address user_agent last_active_at createdAt'
    ).sort({ last_active_at: -1 }).lean();

    const currentToken = req.token;
    const result = sessions.map((s) => ({
      id: s._id,
      ip_address: s.ip_address,
      user_agent: s.user_agent,
      last_active_at: s.last_active_at,
      created_at: s.createdAt,
      is_current: s._id.toString() === (currentToken ? undefined : undefined),
    }));

    // Mark current session
    const currentSession = await Session.findOne({ token: currentToken }, '_id').lean();
    for (const s of result) {
      s.is_current = currentSession && s.id.toString() === currentSession._id.toString();
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// ── Revoke a specific session ────────────────────────
router.delete('/sessions/:id', authenticate, async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, user_id: req.user.id });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Don't allow revoking current session via this route (use /logout)
    if (session.token === req.token) {
      return res.status(400).json({ error: 'Use /logout to end current session' });
    }

    await session.deleteOne();
    res.json({ message: 'Session revoked' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

// ── Register (admin only) ────────────────────────────
router.post('/register', authenticate, requireAdmin, async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const user = await User.create({ username, email, password, role: role || 'User' });
    res.status(201).json({
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      created_at: user.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

module.exports = router;
