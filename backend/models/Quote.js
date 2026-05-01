const mongoose = require('mongoose');

const quoteItemSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  description: { type: String, default: '' },
  hsn: { type: String, default: '' },
  qty: { type: Number, default: 1, min: 0 },
  unit: { type: String, default: 'NOS' },
  rate: { type: Number, default: 0, min: 0 },
  discount_pct: { type: Number, default: 0, min: 0, max: 100 },
  gst_pct: { type: Number, default: 18, min: 0 },
  amount: { type: Number, default: 0 },
}, { _id: true });

const quoteSchema = new mongoose.Schema({
  quote_number: { type: String, unique: true, required: true },
  revision: { type: Number, default: 1 },
  parent_quote_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Quote', default: null },
  costing_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Costing', default: null },

  client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },

  items: [quoteItemSchema],

  subtotal: { type: Number, default: 0 },
  tax_amount: { type: Number, default: 0 },
  grand_total: { type: Number, default: 0 },

  // Agency service charge included in quote
  agency_service_charge_pct: { type: Number, default: 15, min: 0 },
  agency_service_charge: { type: Number, default: 0 },

  status: { type: String, enum: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Revised', 'Converted'], default: 'Draft' },
  valid_until: { type: Date, default: null },

  terms: { type: String, default: '1. This quotation is valid for 30 days.\n2. Payment terms: 50% advance, 50% on delivery.\n3. GST as applicable.' },
  notes: { type: String, default: '' },

  // Tracking
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  converted_to_invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
  converted_at: { type: Date, default: null },
}, { timestamps: true });

quoteSchema.index({ client_id: 1 });
quoteSchema.index({ status: 1 });
quoteSchema.index({ quote_number: 1 });
quoteSchema.index({ costing_id: 1 });
quoteSchema.index({ parent_quote_id: 1 });

module.exports = mongoose.model('Quote', quoteSchema);
