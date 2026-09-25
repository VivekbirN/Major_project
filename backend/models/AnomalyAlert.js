const mongoose = require('mongoose');

const anomalyAlertSchema = new mongoose.Schema({
  node_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Node',
    default: null,
  },
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null,
  },
  alert_type: {
    type: String,
    enum: [
      'DEMAND_SPIKE',
      'DEMAND_DROP',
      'OVERSTOCK',
      'UNDERSTOCK',
      'EXPIRY_RISK',
      'SUPPLY_INCONSISTENCY',
      'SPOILAGE_RISK',
    ],
    required: true,
  },
  severity: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'MEDIUM',
  },
  message: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'],
    default: 'ACTIVE',
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

anomalyAlertSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
anomalyAlertSchema.set('toJSON', { virtuals: true });
anomalyAlertSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('AnomalyAlert', anomalyAlertSchema);
