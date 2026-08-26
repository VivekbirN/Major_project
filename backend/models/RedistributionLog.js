const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RedistributionLog = sequelize.define('RedistributionLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  source_node_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'nodes', key: 'id' },
  },
  destination_node_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'nodes', key: 'id' },
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'products', key: 'id' },
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED'),
    allowNull: false,
    defaultValue: 'PENDING',
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'redistribution_logs',
  timestamps: false,
});

module.exports = RedistributionLog;
