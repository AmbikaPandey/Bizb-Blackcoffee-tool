const mongoose = require('mongoose');

const costingItemSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  description: { type: String, default: '' },
  hsn: { type: String, default: '' },
  qty: { type: Number, default: 1, min: 0 },
  unit: { type: String, default: 'NOS' },
  vendor_cost: { type: Number, default: 0, min: 0 },       // actual vendor cost (internal only)
  markup_pct: { type: Number, default: 0, min: 0 },         // markup percentage
  selling_rate: { type: Number, default: 0, min: 0 },       // vendor_cost * (1 + markup_pct/100)
  gst_pct: { type: Number, default: 18, min: 0 },
  amount: { type: Number, default: 0 },                     // selling_rate * qty
  vendor_amount: { type: Number, default: 0 },              // vendor_cost * qty (internal)
  profit: { type: Number, default: 0 },                     // amount - vendor_amount
}, { _id: true });

const costingSchema = new mongoose.Schema({
  costing_number: { type: String, unique: true, required: true },
  client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  status: { type: String, enum: ['Draft', 'Approved', 'Quoted', 'Converted'], default: 'Draft' },

  items: [costingItemSchema],

  // Totals
  subtotal_vendor: { type: Number, default: 0 },     // sum of vendor amounts (internal)
  subtotal_selling: { type: Number, default: 0 },     // sum of selling amounts
  total_markup: { type: Number, default: 0 },          // subtotal_selling - subtotal_vendor

  // Agency service charge
  agency_service_charge_pct: { type: Number, default: 15, min: 0 },
  agency_service_charge: { type: Number, default: 0 },

  // Tax
  tax_amount: { type: Number, default: 0 },
  grand_total: { type: Number, default: 0 },

  // Profit metrics
  total_profit: { type: Number, default: 0 },         // total_markup + agency_service_charge
  profit_margin_pct: { type: Number, default: 0 },    // (total_profit / grand_total) * 100

  // Tracking
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approved_at: { type: Date, default: null },
  quote_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Quote', default: null },
  notes: { type: String, default: '' },
}, { timestamps: true });

costingSchema.index({ client_id: 1 });
costingSchema.index({ status: 1 });
costingSchema.index({ costing_number: 1 });

module.exports = mongoose.model('Costing', costingSchema);
