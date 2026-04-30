const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  hsn: { type: String, default: '' },
  rate: { type: Number, default: 0 },
  unit: { type: String, default: 'NOS' },
  gst: { type: Number, default: 18 },
  description: { type: String, default: '' },
}, { timestamps: true });

productSchema.index({ name: 1 });

module.exports = mongoose.model('Product', productSchema);
