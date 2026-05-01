const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const bankDetailsSchema = new mongoose.Schema({
  account_number: { type: String, default: '' },
  ifsc_code: { type: String, default: '' },
  bank_name: { type: String, default: '' },
  branch_name: { type: String, default: '' },
  bank_address: { type: String, default: '' },
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['Admin', 'Manager', 'Executive'], default: 'Executive' },
  is_active: { type: Boolean, default: true },
  contact_number: { type: String, default: '' },
  pan: { type: String, default: '' },
  address: { type: String, default: '' },
  employee_code: { type: String, default: '', trim: true },
  designation: { type: String, default: '' },
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
