const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true, unique: true },
  expires_at: { type: Date, required: true },
  ip_address: { type: String, default: null },
  user_agent: { type: String, default: null },
  last_active_at: { type: Date, default: Date.now },
}, { timestamps: true });

sessionSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ user_id: 1 });

module.exports = mongoose.model('Session', sessionSchema);
