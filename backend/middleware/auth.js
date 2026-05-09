const Session = require('../models/Session');
const User = require('../models/User');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = authHeader.split(' ')[1];
  const session = await Session.findOne({ token, expires_at: { $gt: new Date() } });
  if (!session) return res.status(401).json({ error: 'Invalid or expired session' });
  const user = await User.findById(session.user_id).lean();
  if (!user || !user.is_active) return res.status(401).json({ error: 'User not found or inactive' });

  // Sliding expiry — extend session on each request
  const expiresMinutes = parseInt(process.env.SESSION_EXPIRY_MINUTES, 10) || 20;
  session.expires_at = new Date(Date.now() + expiresMinutes * 60 * 1000);
  session.last_active_at = new Date();
  await session.save();

  req.user = {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    permissions: user.permissions || {},
  };
  req.token = token;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'Admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: `Access restricted to: ${roles.join(', ')}` });
    }
    next();
  };
}

/**
 * Permission-based authorization middleware.
 * Admin role always bypasses permission checks.
 * Usage: authorize('clients', 'edit')
 */
function authorize(module, action) {
  return (req, res, next) => {
    // Admin bypasses all permission checks
    if (req.user?.role === 'Admin') return next();

    const perms = req.user?.permissions;
    if (!perms || !perms[module] || !perms[module][action]) {
      return res.status(403).json({
        error: 'Permission denied',
        detail: `You do not have ${action} access to ${module}`,
      });
    }
    next();
  };
}

module.exports = { authenticate, requireAdmin, requireRole, authorize };
