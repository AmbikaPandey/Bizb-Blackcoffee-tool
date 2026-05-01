const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  vendor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  category: { type: String, default: '', trim: true },
  hsn: { type: String, default: '' },
  base_cost: { type: Number, default: 0 },
  markup_pct: { type: Number, default: 0 },
  selling_price: { type: Number, default: 0 },
  rate: { type: Number, default: 0 },
  unit: { type: String, default: 'NOS' },
  gst: { type: Number, default: 18 },
  description: { type: String, default: '' },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
}, { timestamps: true });

// Auto-calculate selling_price from base_cost + markup
productSchema.pre('save', function () {
  if (this.base_cost > 0 && this.markup_pct >= 0) {
    this.selling_price = Math.round(this.base_cost * (1 + this.markup_pct / 100) * 100) / 100;
    this.rate = this.selling_price;
  }
});

productSchema.index({ name: 1 });
productSchema.index({ vendor_id: 1 });

module.exports = mongoose.model('Product', productSchema);
