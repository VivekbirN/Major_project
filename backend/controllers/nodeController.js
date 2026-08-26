const { Op, fn, col, literal } = require('sequelize');
const { Node, Product, Inventory, InventoryTransaction, SpoilageEvent } = require('../models');
const { sendSuccess, sendError } = require('../utils/responseHelper');

const NEAR_EXPIRY_DAYS = 7;
const OVERSTOCK_MULTIPLIER = 5;

const CAPACITY_THRESHOLDS = { NORMAL: 60, MODERATE: 80, HIGH: 95 };

const getCapacityStatus = (pct) => {
  if (pct >= CAPACITY_THRESHOLDS.HIGH) return 'CRITICAL';
  if (pct >= CAPACITY_THRESHOLDS.MODERATE) return 'HIGH';
  if (pct >= CAPACITY_THRESHOLDS.NORMAL) return 'MODERATE';
  return 'NORMAL';
};

/**
 * GET /api/v1/nodes
 * With capacity utilization and inventory stats
 */
const getNodes = async (req, res) => {
  try {
    const { role, node_id } = req.user;
    const where = role !== 'SUPPLY_CHAIN_MANAGER' ? { id: node_id } : {};

    const nodes = await Node.findAll({ where, order: [['name', 'ASC']], raw: true });
    const nodeIds = nodes.map(n => n.id);

    const today = new Date().toISOString().split('T')[0];
    const nearExpiry = new Date(); nearExpiry.setDate(new Date().getDate() + NEAR_EXPIRY_DAYS);
    const nearExpiryStr = nearExpiry.toISOString().split('T')[0];

    const stats = await Inventory.findAll({
      where: { node_id: { [Op.in]: nodeIds } },
      attributes: [
        'node_id',
        [fn('SUM', col('quantity')), 'total_qty'],
        [fn('COUNT', col('id')), 'product_count'],
        [fn('SUM', literal('CASE WHEN quantity <= reorder_threshold THEN 1 ELSE 0 END')), 'low_stock_count'],
        [fn('SUM', literal(`CASE WHEN expiry_date BETWEEN '${today}' AND '${nearExpiryStr}' AND quantity > 0 THEN 1 ELSE 0 END`)), 'near_expiry_count'],
        [fn('SUM', literal('CASE WHEN quantity = 0 THEN 1 ELSE 0 END')), 'out_of_stock_count'],
        [fn('SUM', literal('quantity * (SELECT unit_cost FROM products WHERE products.id = inventory.product_id)')), 'total_value'],
      ],
      group: ['node_id'],
      raw: true,
    });

    const statsMap = {};
    stats.forEach(s => { statsMap[s.node_id] = s; });

    const enriched = nodes.map(node => {
      const s = statsMap[node.id] || {};
      const totalQty = parseInt(s.total_qty) || 0;
      const utilization = node.capacity > 0 ? Math.round((totalQty / node.capacity) * 100) : 0;
      return {
        ...node,
        current_inventory: totalQty,
        capacity_utilization: Math.min(utilization, 100),
        capacity_status: getCapacityStatus(utilization),
        product_count: parseInt(s.product_count) || 0,
        low_stock_count: parseInt(s.low_stock_count) || 0,
        near_expiry_count: parseInt(s.near_expiry_count) || 0,
        out_of_stock_count: parseInt(s.out_of_stock_count) || 0,
        total_value: parseFloat(s.total_value) || 0,
      };
    });

    return sendSuccess(res, { nodes: enriched }, 'Nodes retrieved');
  } catch (error) {
    console.error('Get nodes error:', error);
    return sendError(res, 'Failed to retrieve nodes', 500);
  }
};

/**
 * GET /api/v1/nodes/:id
 */
const getNodeById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, node_id } = req.user;

    const nodeId = parseInt(id);
    if (role === 'WAREHOUSE_ADMIN' && node_id !== nodeId) {
      return sendError(res, 'Access denied — not your node', 403);
    }

    const node = await Node.findByPk(nodeId, { raw: true });
    if (!node) return sendError(res, 'Node not found', 404);

    const today = new Date().toISOString().split('T')[0];
    const nearExpiry = new Date(); nearExpiry.setDate(new Date().getDate() + NEAR_EXPIRY_DAYS);
    const nearExpiryStr = nearExpiry.toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(new Date().getDate() - 30);

    // Inventory for this node
    const inventory = await Inventory.findAll({
      where: { node_id: nodeId },
      include: [{ model: Product, as: 'product', attributes: ['id', 'sku', 'name', 'category', 'unit_cost', 'shelf_life_days'] }],
      order: [['quantity', 'ASC']],
    });

    const inventoryPlain = inventory.map(item => {
      const p = item.toJSON();
      const days = item.expiry_date ? Math.ceil((new Date(item.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)) : null;
      let status = 'HEALTHY';
      if (item.quantity <= 0) status = 'CRITICAL';
      else if (days !== null && days <= NEAR_EXPIRY_DAYS) status = 'NEAR_EXPIRY';
      else if (item.quantity <= item.reorder_threshold) status = 'LOW_STOCK';
      else if (item.quantity > item.reorder_threshold * OVERSTOCK_MULTIPLIER) status = 'OVERSTOCKED';
      return { ...p, stock_status: status, days_until_expiry: days, inventory_value: item.quantity * parseFloat(item.product?.unit_cost || 0) };
    });

    const totalQty = inventoryPlain.reduce((s, i) => s + i.quantity, 0);
    const utilization = node.capacity > 0 ? Math.round((totalQty / node.capacity) * 100) : 0;

    // Recent transactions
    const recentActivity = await InventoryTransaction.findAll({
      where: { node_id: nodeId, created_at: { [Op.gte]: thirtyDaysAgo } },
      include: [
        { model: Product, as: 'product', attributes: ['id', 'sku', 'name'] },
        { model: require('../models/User'), as: 'user', attributes: ['id', 'name'] },
      ],
      order: [['created_at', 'DESC']],
      limit: 15,
    });

    // Spoilage in last 30 days
    const recentSpoilage = await SpoilageEvent.findAll({
      where: { node_id: nodeId, event_date: { [Op.gte]: thirtyDaysAgo.toISOString().split('T')[0] } },
      include: [{ model: Product, as: 'product', attributes: ['id', 'sku', 'name'] }],
      order: [['event_date', 'DESC']],
      limit: 5,
    });

    return sendSuccess(res, {
      node: {
        ...node,
        current_inventory: totalQty,
        capacity_utilization: Math.min(utilization, 100),
        capacity_status: getCapacityStatus(utilization),
        low_stock_count: inventoryPlain.filter(i => i.stock_status === 'LOW_STOCK' || i.stock_status === 'CRITICAL').length,
        near_expiry_count: inventoryPlain.filter(i => i.stock_status === 'NEAR_EXPIRY').length,
        overstock_count: inventoryPlain.filter(i => i.stock_status === 'OVERSTOCKED').length,
        total_value: inventoryPlain.reduce((s, i) => s + i.inventory_value, 0),
      },
      inventory: inventoryPlain,
      recent_activity: recentActivity,
      recent_spoilage: recentSpoilage,
    }, 'Node details retrieved');
  } catch (error) {
    console.error('Get node by id error:', error);
    return sendError(res, 'Failed to retrieve node details', 500);
  }
};

module.exports = { getNodes, getNodeById };
