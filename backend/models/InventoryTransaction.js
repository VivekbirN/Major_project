const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Tracks every inventory-changing operation for audit history.
 * Used by incoming/outgoing shipments, adjustments, and spoilage recording.
 */
const InventoryTransaction = sequelize.define('InventoryTransaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  inventory_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'inventory', key: 'id' },
  },
  node_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'nodes', key: 'id' },
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'products', key: 'id' },
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
  transaction_type: {
    type: DataTypes.ENUM('INCOMING', 'OUTGOING', 'ADJUSTMENT', 'SPOILAGE', 'INITIAL'),
    allowNull: false,
  },
  quantity_change: {
    // Positive = added, Negative = removed
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  quantity_before: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  quantity_after: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  reason: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  reference: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'inventory_transactions',
  timestamps: false,
});

module.exports = InventoryTransaction;
