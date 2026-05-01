const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  entity: { type: String, required: true },
  entity_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  performed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  details: { type: String, default: '' },
  ip_address: { type: String, default: '' },
  changes: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

auditLogSchema.index({ entity: 1, entity_id: 1 });
auditLogSchema.index({ performed_by: 1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
