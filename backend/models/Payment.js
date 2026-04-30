const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  invoice_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
  amount: { type: Number, required: true, min: 0.01 },
  date: { type: String, required: true },
  method: { type: String, enum: ['Bank Transfer', 'Cash', 'UPI', 'Cheque', 'Card', 'Other'], default: 'Bank Transfer' },
  reference: { type: String, default: '' },
  notes: { type: String, default: '' },
}, { timestamps: true });

paymentSchema.index({ client_id: 1 });
paymentSchema.index({ invoice_id: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
