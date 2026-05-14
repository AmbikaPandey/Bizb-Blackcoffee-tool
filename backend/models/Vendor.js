const mongoose = require('mongoose');

const bankDetailsSchema = new mongoose.Schema({
  account_number: { type: String, default: '' },
  ifsc_code: { type: String, default: '' },
  bank_name: { type: String, default: '' },
  branch_name: { type: String, default: '' },
  bank_address: { type: String, default: '' },
}, { _id: false });

const vendorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  gstin: { type: String, default: '' },
  gst_status: { type: String, default: '' },
  pan: { type: String, default: '' },
  contact: { type: String, default: '' },
  contact1: { type: String, default: '' },
  contact2: { type: String, default: '' },
  city: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  address: { type: String, default: '' },
  pincode: { type: String, default: '' },
  state: { type: String, default: '' },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  bank_details: { type: bankDetailsSchema, default: () => ({}) },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

vendorSchema.index({ name: 1 });

module.exports = mongoose.model('Vendor', vendorSchema);
