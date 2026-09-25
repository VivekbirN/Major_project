const mongoose = require('mongoose');

const spoilageEventSchema = new mongoose.Schema({
  node_id: {
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
  reason: {
    type: String,
    enum: ['EXPIRED', 'DAMAGED', 'CONTAMINATED', 'QUALITY_FAILURE', 'OTHER'],
    required: true,
    default: 'EXPIRED',
  },
  estimated_loss: {
    type: Number,
    default: null,
  },
  event_date: {
    type: Date,
    required: true,
  },
});

spoilageEventSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
spoilageEventSchema.set('toJSON', { virtuals: true });
spoilageEventSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('SpoilageEvent', spoilageEventSchema);
