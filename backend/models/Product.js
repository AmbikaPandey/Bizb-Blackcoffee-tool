const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  vendor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },
  category: { type: String, default: '', trim: true },
  hsn: { type: String, required: true },
  rate: { type: Number, default: 0 },
  unit: { type: String, default: 'NOS' },
  gst: { type: Number, default: 18 },
  description: { type: String, default: '' },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
}, { timestamps: true });

productSchema.index({ name: 1 });
productSchema.index({ vendor_id: 1 });

module.exports = mongoose.model('Product', productSchema);
