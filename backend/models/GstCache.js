const mongoose = require('mongoose');

const gstCacheSchema = new mongoose.Schema({
  gstin: { type: String, required: true, unique: true, uppercase: true, index: true },
  data: {
    name: String,
    trade_name: String,
    address: String,
    city: String,
    state: String,
    pincode: String,
    pan: String,
    status: String,
    registration_type: String,
    constitution: String,
    registration_date: String,
    state_code: String,
  },
  rawResponse: mongoose.Schema.Types.Mixed,
  fetchedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Auto-expire after 30 days — forces a fresh API call for stale data
gstCacheSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('GstCache', gstCacheSchema);
