const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Inventory = sequelize.define('Inventory', {
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
    defaultValue: 0,
  },
  reorder_threshold: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 50,
  },
  expiry_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  last_updated: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'inventory',
  timestamps: false,
});

module.exports = Inventory;
