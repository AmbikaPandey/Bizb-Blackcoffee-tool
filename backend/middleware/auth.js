const Session = require('../models/Session');
const User = require('../models/User');

// Role hierarchy: Super Admin > Admin > Sales Manager > Sales Executive / Accounts
const ROLE_HIERARCHY = {
  'Super Admin': 5,
  'Admin': 4,
  'Sales Manager': 3,
  'Sales Executive': 2,
  'Accounts': 2,
};

function getRoleLevel(role) {
  return ROLE_HIERARCHY[role] || 0;
}

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = authHeader.split(' ')[1];
  const session = await Session.findOne({ token, expires_at: { $gt: new Date() } });
  if (!session) return res.status(401).json({ error: 'Invalid or expired session' });

  // Check idle timeout
  if (session.isIdle()) {
    await session.deleteOne();
    return res.status(401).json({ error: 'Session timed out due to inactivity' });
  }

  const user = await User.findById(session.user_id).lean();
  if (!user || !user.is_active) return res.status(401).json({ error: 'User not found or inactive' });

  // Sliding expiry — extend session on each request
  const expiresHours = parseInt(process.env.SESSION_EXPIRY_HOURS, 10) || 24;
  session.expires_at = new Date(Date.now() + expiresHours * 60 * 60 * 1000);
  session.last_active_at = new Date();
  await session.save();

  req.user = { id: user._id, username: user.username, email: user.email, role: user.role };
  req.token = token;
  next();
}

function requireAdmin(req, res, next) {
  if (!['Super Admin', 'Admin'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== 'Super Admin') {
    return res.status(403).json({ error: 'Super Admin access required' });
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

module.exports = { authenticate, requireAdmin, requireSuperAdmin, requireRole, getRoleLevel, ROLE_HIERARCHY };
