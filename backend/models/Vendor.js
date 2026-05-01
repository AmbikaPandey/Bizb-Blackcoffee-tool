const mongoose = require('mongoose');

const bankDetailsSchema = new mongoose.Schema({
  account_number: { type: String, default: '' },
  ifsc_code: { type: String, default: '' },
  bank_name: { type: String, default: '' },
  branch_name: { type: String, default: '' },
  bank_address: { type: String, default: '' },
}, { _id: false });

const vendorPaymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  date: { type: String, required: true },
  mode: { type: String, default: 'Bank Transfer' },
  reference: { type: String, default: '' },
  project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  notes: { type: String, default: '' },
  recorded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

const vendorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  gstin: { type: String, default: '' },
  pan: { type: String, default: '' },
  contact: { type: String, default: '' },
  city: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  address: { type: String, default: '' },
  pincode: { type: String, default: '' },
  state: { type: String, default: '' },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  bank_details: { type: bankDetailsSchema, default: () => ({}) },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  payments: [vendorPaymentSchema],
  total_paid: { type: Number, default: 0 },
}, { timestamps: true });

vendorSchema.index({ name: 1 });

module.exports = mongoose.model('Vendor', vendorSchema);
