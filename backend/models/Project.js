const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, unique: true, sparse: true, trim: true },
  client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
  assigned_manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assigned_executives: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  vendors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' }],
  venue: { type: String, default: '', trim: true },
  budget: { type: Number, default: 0 },
  spent: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 },
  start_date: { type: String, default: '' },
  end_date: { type: String, default: '' },
  status: { type: String, default: 'Active' },
  description: { type: String, default: '' },
}, { timestamps: true });

projectSchema.index({ assigned_manager: 1 });
projectSchema.index({ assigned_executives: 1 });

module.exports = mongoose.model('Project', projectSchema);
