const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  category: { type: String, default: 'General' },
  amount: { type: Number, required: true },
  date: { type: String, required: true },
  paid_by: { type: String, default: '' },
  project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  status: { type: String, default: 'Approved' },
  receipt_url: { type: String, default: '' },
  notes: { type: String, default: '' },
}, { timestamps: true });

expenseSchema.index({ category: 1 });
expenseSchema.index({ status: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
