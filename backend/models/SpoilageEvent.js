const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SpoilageEvent = sequelize.define('SpoilageEvent', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
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
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  reason: {
    type: DataTypes.ENUM('EXPIRED', 'DAMAGED', 'CONTAMINATED', 'QUALITY_FAILURE', 'OTHER'),
    allowNull: false,
    defaultValue: 'EXPIRED',
  },
  estimated_loss: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
  },
  event_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
}, {
  tableName: 'spoilage_events',
  timestamps: false,
});

module.exports = SpoilageEvent;
