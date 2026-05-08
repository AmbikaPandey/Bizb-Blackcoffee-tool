const mongoose = require('mongoose');

const hsnCodeSchema = new mongoose.Schema({
  hsnCode: { type: String, required: true, trim: true },
  productName: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  gstRate: { type: Number, required: true },
  category: { type: String, default: '' },
  type: { type: String, enum: ['HSN', 'SAC'], default: 'HSN' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Indexes for fast lookups
hsnCodeSchema.index({ hsnCode: 1 }, { unique: true });
hsnCodeSchema.index({ productName: 'text' });
hsnCodeSchema.index({ category: 1 });

module.exports = mongoose.model('HsnCode', hsnCodeSchema);
