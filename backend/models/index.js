// Mongoose models — no sequelize associations needed.
// Relationships are expressed via ObjectId refs and .populate() calls.

const User                 = require('./User');
const Node                 = require('./Node');
const Product              = require('./Product');
const Inventory            = require('./Inventory');
const InventoryTransaction = require('./InventoryTransaction');
const SalesRecord          = require('./SalesRecord');
const RedistributionLog    = require('./RedistributionLog');
const SpoilageEvent        = require('./SpoilageEvent');
const AnomalyAlert         = require('./AnomalyAlert');

module.exports = {
  User,
  Node,
  Product,
  Inventory,
  InventoryTransaction,
  SalesRecord,
  RedistributionLog,
  SpoilageEvent,
  AnomalyAlert,
};
