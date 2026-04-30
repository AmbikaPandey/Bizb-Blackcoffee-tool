const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  gstin: { type: String, default: '' },
  contact: { type: String, default: '' },
  address: { type: String, default: '' },
  city: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  state: { type: String, default: '' },
  outstanding: { type: Number, default: 0 },
}, { timestamps: true });

clientSchema.index({ name: 1 });

module.exports = mongoose.model('Client', clientSchema);
