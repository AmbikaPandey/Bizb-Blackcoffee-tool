const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  category: { type: String, default: 'General' },
  amount: { type: Number, required: true },
  date: { type: String, required: true },
  paid_by: { type: String, default: '' },
  invoice_number: { type: String, default: '' },
  project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  submitted_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  receipt_url: { type: String, default: '' },
  notes: { type: String, default: '' },
  // Reimbursement fields (set when Admin approves)
  payment_status: { type: String, enum: ['', 'Paid', 'Unpaid'], default: '' },
  payment_date: { type: String, default: '' },
  paid_from_account: { type: String, default: '' },
  approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approved_at: { type: Date, default: null },
}, { timestamps: true });

expenseSchema.index({ category: 1 });
expenseSchema.index({ status: 1 });
expenseSchema.index({ submitted_by: 1 });
expenseSchema.index({ project_id: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
