const sequelize = require('../config/database');

// Import models
const User = require('./User');
const Node = require('./Node');
const Product = require('./Product');
const Inventory = require('./Inventory');
const InventoryTransaction = require('./InventoryTransaction');
const SalesRecord = require('./SalesRecord');
const RedistributionLog = require('./RedistributionLog');
const SpoilageEvent = require('./SpoilageEvent');
const AnomalyAlert = require('./AnomalyAlert');

// ── Associations ──────────────────────────────────────────────────────────────

// Node → Users
Node.hasMany(User, { foreignKey: 'node_id', as: 'users' });
User.belongsTo(Node, { foreignKey: 'node_id', as: 'node' });

// Node → Inventory
Node.hasMany(Inventory, { foreignKey: 'node_id', as: 'inventory' });
Inventory.belongsTo(Node, { foreignKey: 'node_id', as: 'node' });

// Node → InventoryTransactions
Node.hasMany(InventoryTransaction, { foreignKey: 'node_id', as: 'transactions' });
InventoryTransaction.belongsTo(Node, { foreignKey: 'node_id', as: 'node' });

// Node → SalesRecords
Node.hasMany(SalesRecord, { foreignKey: 'node_id', as: 'sales_records' });
SalesRecord.belongsTo(Node, { foreignKey: 'node_id', as: 'node' });

// Node → SpoilageEvents
Node.hasMany(SpoilageEvent, { foreignKey: 'node_id', as: 'spoilage_events' });
SpoilageEvent.belongsTo(Node, { foreignKey: 'node_id', as: 'node' });

// Node → AnomalyAlerts
Node.hasMany(AnomalyAlert, { foreignKey: 'node_id', as: 'anomaly_alerts' });
AnomalyAlert.belongsTo(Node, { foreignKey: 'node_id', as: 'node' });

// Node as source → RedistributionLogs
Node.hasMany(RedistributionLog, { foreignKey: 'source_node_id', as: 'outgoing_transfers' });
RedistributionLog.belongsTo(Node, { foreignKey: 'source_node_id', as: 'source_node' });

// Node as destination → RedistributionLogs
Node.hasMany(RedistributionLog, { foreignKey: 'destination_node_id', as: 'incoming_transfers' });
RedistributionLog.belongsTo(Node, { foreignKey: 'destination_node_id', as: 'destination_node' });

// Product → Inventory
Product.hasMany(Inventory, { foreignKey: 'product_id', as: 'inventory' });
Inventory.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// Product → InventoryTransactions
Product.hasMany(InventoryTransaction, { foreignKey: 'product_id', as: 'transactions' });
InventoryTransaction.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// Product → SalesRecords
Product.hasMany(SalesRecord, { foreignKey: 'product_id', as: 'sales_records' });
SalesRecord.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// Product → RedistributionLogs
Product.hasMany(RedistributionLog, { foreignKey: 'product_id', as: 'redistribution_logs' });
RedistributionLog.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// Product → SpoilageEvents
Product.hasMany(SpoilageEvent, { foreignKey: 'product_id', as: 'spoilage_events' });
SpoilageEvent.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// Product → AnomalyAlerts
Product.hasMany(AnomalyAlert, { foreignKey: 'product_id', as: 'anomaly_alerts' });
AnomalyAlert.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// Inventory → InventoryTransactions
Inventory.hasMany(InventoryTransaction, { foreignKey: 'inventory_id', as: 'transactions' });
InventoryTransaction.belongsTo(Inventory, { foreignKey: 'inventory_id', as: 'inventory' });

// User → InventoryTransactions
User.hasMany(InventoryTransaction, { foreignKey: 'user_id', as: 'transactions' });
InventoryTransaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = {
  sequelize,
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
