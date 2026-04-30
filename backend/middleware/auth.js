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
  const expiresHours = parseInt(process.env.SESSION_EXPIRY_HOURS, 10) || 24;
  session.expires_at = new Date(Date.now() + expiresHours * 60 * 60 * 1000);
  session.last_active_at = new Date();
  await session.save();

  req.user = { id: user._id, username: user.username, email: user.email, role: user.role };
  req.token = token;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'Admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { authenticate, requireAdmin };
