const mongoose = require('mongoose');

const redistributionLogSchema = new mongoose.Schema({
  source_node_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Node',
    required: true,
  },
  destination_node_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Node',
    required: true,
  },
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING',
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  completed_at: {
    type: Date,
    default: null,
  },
});

redistributionLogSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
redistributionLogSchema.set('toJSON', { virtuals: true });
redistributionLogSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('RedistributionLog', redistributionLogSchema);
