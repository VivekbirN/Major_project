const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SalesRecord = sequelize.define('SalesRecord', {
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
  quantity_sold: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  sale_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  unit_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  total_revenue: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
  },
}, {
  tableName: 'sales_records',
  timestamps: false,
});

module.exports = SalesRecord;
