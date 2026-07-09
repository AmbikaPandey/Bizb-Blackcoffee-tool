const mongoose = require('mongoose');

const contactPersonSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  designation: { type: String, default: '' },
}, { _id: true });

const clientSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  gstin: { type: String, default: '' },
  gst_status: { type: String, default: '' },
  contact: { type: String, default: '' },   // legacy single contact name (kept for backward compat)
  contacts: { type: [contactPersonSchema], default: [] }, // multiple contact persons
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
