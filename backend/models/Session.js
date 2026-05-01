const mongoose = require('mongoose');
const crypto = require('crypto');

const sessionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true, unique: true },
  expires_at: { type: Date, required: true },
  idle_timeout_minutes: { type: Number, default: 30 },
  ip_address: { type: String, default: null },
  user_agent: { type: String, default: null },
  last_active_at: { type: Date, default: Date.now },
}, { timestamps: true });

sessionSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ user_id: 1 });

// Check if session is idle (no activity for idle_timeout_minutes)
sessionSchema.methods.isIdle = function () {
  const timeout = this.idle_timeout_minutes || 30;
  const idleSince = new Date(Date.now() - timeout * 60 * 1000);
  return this.last_active_at < idleSince;
};

module.exports = mongoose.model('Session', sessionSchema);
