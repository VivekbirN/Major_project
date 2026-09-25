const mongoose = require('mongoose');

const salesRecordSchema = new mongoose.Schema({
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
  quantity_sold: {
    type: Number,
    required: true,
    default: 0,
  },
  sale_date: {
    type: Date,
    required: true,
  },
  unit_price: {
    type: Number,
    default: null,
  },
  total_revenue: {
    type: Number,
    default: null,
  },
});

salesRecordSchema.index({ sale_date: -1 });
salesRecordSchema.index({ node_id: 1 });
salesRecordSchema.index({ product_id: 1 });

salesRecordSchema.virtual('id').get(function () {
  return this._id.toHexString();
});
salesRecordSchema.set('toJSON', { virtuals: true });
salesRecordSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('SalesRecord', salesRecordSchema);
