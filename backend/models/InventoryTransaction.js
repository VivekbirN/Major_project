const mongoose = require('mongoose');

const inventoryTransactionSchema = new mongoose.Schema({
  inventory_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: true,
  },
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
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  transaction_type: {
    type: String,
    enum: ['INCOMING', 'OUTGOING', 'ADJUSTMENT', 'SPOILAGE', 'INITIAL'],
    required: true,
  },
  // Positive = added, Negative = removed
  quantity_change: {
    type: Number,
    required: true,
  },
  quantity_before: {
    type: Number,
    required: true,
  },
  quantity_after: {
    type: Number,
    required: true,
  },
  reason: {
    type: String,
    maxlength: 500,
    default: null,
  },
  reference: {
    type: String,
    maxlength: 100,
    default: null,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

inventoryTransactionSchema.index({ node_id: 1 });
inventoryTransactionSchema.index({ product_id: 1 });
inventoryTransactionSchema.index({ inventory_id: 1 });
inventoryTransactionSchema.index({ created_at: -1 });

inventoryTransactionSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
inventoryTransactionSchema.set('toJSON', { virtuals: true });
inventoryTransactionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('InventoryTransaction', inventoryTransactionSchema);
