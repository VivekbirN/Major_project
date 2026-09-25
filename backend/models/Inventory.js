const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
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
    default: 0,
    min: 0,
  },
  reorder_threshold: {
    type: Number,
    default: 50,
    min: 0,
  },
  expiry_date: {
    type: Date,
    default: null,
  },
  last_updated: {
    type: Date,
    default: Date.now,
  },
});

// Compound unique index — same as original SQL UNIQUE constraint enforced in app logic
inventorySchema.index({ node_id: 1, product_id: 1 }, { unique: true });

inventorySchema.virtual('id').get(function () {
  return this._id.toHexString();
});
inventorySchema.set('toJSON', { virtuals: true });
inventorySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Inventory', inventorySchema);
