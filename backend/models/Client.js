const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  gstin: { type: String, default: '' },
  pan: { type: String, default: '' },
  contact: { type: String, default: '' },
  service_type: { type: String, default: '', trim: true },
  address: { type: String, default: '' },
  pincode: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
  outstanding: { type: Number, default: 0 },
}, { timestamps: true });

clientSchema.index({ name: 1 });
clientSchema.index({ state: 1 });
clientSchema.index({ gstin: 1 });
clientSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Client', clientSchema);
