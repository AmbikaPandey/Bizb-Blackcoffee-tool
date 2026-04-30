const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, unique: true, sparse: true, trim: true },
  client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
  budget: { type: Number, default: 0 },
  spent: { type: Number, default: 0 },
  start_date: { type: String, default: '' },
  end_date: { type: String, default: '' },
  status: { type: String, default: 'Active' },
  description: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
