const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AnomalyAlert = sequelize.define('AnomalyAlert', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  node_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'nodes', key: 'id' },
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'products', key: 'id' },
  },
  alert_type: {
    type: DataTypes.ENUM(
      'DEMAND_SPIKE',
      'DEMAND_DROP',
      'OVERSTOCK',
      'UNDERSTOCK',
      'EXPIRY_RISK',
      'SUPPLY_INCONSISTENCY',
      'SPOILAGE_RISK'
    ),
    allowNull: false,
  },
  severity: {
    type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
    allowNull: false,
    defaultValue: 'MEDIUM',
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'),
    allowNull: false,
    defaultValue: 'ACTIVE',
  },
}, {
  tableName: 'anomaly_alerts',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = AnomalyAlert;
