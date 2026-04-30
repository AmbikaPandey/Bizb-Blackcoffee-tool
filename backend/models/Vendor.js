const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  gstin: { type: String, default: '' },
  contact: { type: String, default: '' },
  city: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  state: { type: String, default: '' },
}, { timestamps: true });

vendorSchema.index({ name: 1 });

module.exports = mongoose.model('Vendor', vendorSchema);
