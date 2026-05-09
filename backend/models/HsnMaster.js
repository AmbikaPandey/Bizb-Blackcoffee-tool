const mongoose = require('mongoose');

const hsnMasterSchema = new mongoose.Schema({
  code: { type: String, required: true, trim: true, unique: true },
  type: { type: String, enum: ['HSN', 'SAC'], required: true, default: 'HSN' },
  keywords: [{ type: String, trim: true }],
  description: { type: String, default: '' },
  gstRate: { type: Number, required: true, min: 0, max: 100 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

// Indexes for fast search (code unique index created by schema definition)
hsnMasterSchema.index({ keywords: 1 });
hsnMasterSchema.index({ type: 1 });
hsnMasterSchema.index({ keywords: 'text', description: 'text', code: 'text' });

module.exports = mongoose.model('HsnMaster', hsnMasterSchema);
