const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  product_name: { type: String, default: '' },
  description: { type: String, default: '' },
  hsn: { type: String, default: '' },
  qty: { type: Number, default: 1, min: 0 },
  unit: { type: String, default: 'NOS' },
  rate: { type: Number, default: 0, min: 0 },
  discount_pct: { type: Number, default: 0, min: 0, max: 100 },
  tax_pct: { type: Number, default: 18, min: 0 },
  amount: { type: Number, default: 0 },
}, { _id: true });

const invoiceSchema = new mongoose.Schema({
  invoice_number: { type: String, unique: true, required: true },
  client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  invoice_type: { type: String, default: 'Tax Invoice' },
  tax_type: { type: String, enum: ['IGST', 'CGST/SGST', 'CGST + SGST'], default: 'IGST' },
  invoice_date: { type: String, required: true },
  credit_period: { type: Number, default: null },
  place_of_supply: { type: String, default: null },
  po_number: { type: String, default: null },
  po_date: { type: String, default: null },
  contact_person: {
    type: new mongoose.Schema({
      _id: { type: mongoose.Schema.Types.ObjectId },
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      designation: { type: String, default: '' },
    }, { _id: false }),
    default: null,
  },
  transport: { type: String, default: null },
  vehicle_no: { type: String, default: null },
  gr_rr_no: { type: String, default: null },
  eway_bill: { type: String, default: null },
  notes: { type: String, default: null },
  terms: { type: String, default: '1. Payment is due within 30 days.\n2. Please include invoice number in payment reference.' },
  subtotal: { type: Number, default: 0 },
  taxable_amount: { type: Number, default: 0 },
  grand_total: { type: Number, default: 0 },
  amount_paid: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  status: { type: String, enum: ['Draft', 'Sent', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled'], default: 'Draft' },
  type: { type: String, enum: ['tax', 'proforma'], default: 'tax' },
  items: [invoiceItemSchema],

  // BUSY Accounting sync fields
  busySynced: { type: Boolean, default: false },
  busySyncDate: { type: Date, default: null },
  busyReferenceNo: { type: String, default: null },
  busyExportPath: { type: String, default: null },
  busySyncError: { type: String, default: null },
}, { timestamps: true });

invoiceSchema.index({ client_id: 1 });
invoiceSchema.index({ type: 1, status: 1 });
invoiceSchema.index({ status: 1, credit_period: 1 });
invoiceSchema.index({ busySynced: 1 });
invoiceSchema.index({ createdAt: -1 });
invoiceSchema.index({ invoice_date: -1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
