const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { buildDefaultPermissions } = require('../config/permissions');

const bankDetailsSchema = new mongoose.Schema({
  account_number: { type: String, default: '' },
  ifsc_code: { type: String, default: '' },
  bank_name: { type: String, default: '' },
  branch_name: { type: String, default: '' },
  bank_address: { type: String, default: '' },
}, { _id: false });

// Build a flexible permission sub-schema from the constants
const permissionActionSchema = new mongoose.Schema({
  view: { type: Boolean, default: false },
  create: { type: Boolean, default: false },
  edit: { type: Boolean, default: false },
  delete: { type: Boolean, default: false },
  export: { type: Boolean, default: false },
}, { _id: false, strict: false });

const permissionsSchema = new mongoose.Schema({
  dashboard: { type: permissionActionSchema, default: () => ({}) },
  clients: { type: permissionActionSchema, default: () => ({}) },
  vendors: { type: permissionActionSchema, default: () => ({}) },
  products: { type: permissionActionSchema, default: () => ({}) },
  invoices: { type: permissionActionSchema, default: () => ({}) },
  payments: { type: permissionActionSchema, default: () => ({}) },
  projects: { type: permissionActionSchema, default: () => ({}) },
  expenses: { type: permissionActionSchema, default: () => ({}) },
  reports: { type: permissionActionSchema, default: () => ({}) },
  settings: { type: permissionActionSchema, default: () => ({}) },
  users: { type: permissionActionSchema, default: () => ({}) },
  hsnMaster: { type: permissionActionSchema, default: () => ({}) },
  busyExports: { type: permissionActionSchema, default: () => ({}) },
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['Admin', 'Manager', 'Accountant', 'Executive', 'Staff', 'Custom'], default: 'Executive' },
  permissions: { type: permissionsSchema, default: () => buildDefaultPermissions(false) },
  is_active: { type: Boolean, default: true },
  contact_number: { type: String, default: '' },
  pan: { type: String, default: '' },
  address: { type: String, default: '' },
  employee_code: { type: String, default: '', trim: true },
  designation: { type: String, default: '' },
  pincode: { type: String, default: '' },
  office_branch: { type: String, default: '' },
  bank_details: { type: bankDetailsSchema, default: () => ({}) },
}, { timestamps: true });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  obj.id = obj._id;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
