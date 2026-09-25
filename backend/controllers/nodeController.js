const mongoose = require('mongoose');
const { Node, Product, Inventory, InventoryTransaction, SpoilageEvent } = require('../models');
const { sendSuccess, sendError } = require('../utils/responseHelper');

const NEAR_EXPIRY_DAYS = 7;
const OVERSTOCK_MULTIPLIER = 5;

const CAPACITY_THRESHOLDS = { NORMAL: 60, MODERATE: 80, HIGH: 95 };

const getCapacityStatus = (pct) => {
  if (pct >= CAPACITY_THRESHOLDS.HIGH)     return 'CRITICAL';
  if (pct >= CAPACITY_THRESHOLDS.MODERATE) return 'HIGH';
  if (pct >= CAPACITY_THRESHOLDS.NORMAL)   return 'MODERATE';
  return 'NORMAL';
};

const isValidId = (id) => mongoose.isValidObjectId(id);

/**
 * GET /api/v1/nodes
 */
const getNodes = async (req, res) => {
  try {
    const { role, node_id } = req.user;
    const where = role !== 'SUPPLY_CHAIN_MANAGER' ? { _id: node_id } : {};

    const nodes = await Node.find(where).sort({ name: 1 }).lean();
    const nodeIds = nodes.map(n => n._id);

    const now = new Date();
    const nearExpiry = new Date();
    nearExpiry.setDate(now.getDate() + NEAR_EXPIRY_DAYS);

    const stats = await Inventory.aggregate([
      { $match: { node_id: { $in: nodeIds } } },
      {
        $lookup: {
          from: 'products',
          localField: 'product_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$node_id',
          total_qty: { $sum: '$quantity' },
          product_count: { $sum: 1 },
          low_stock_count: {
            $sum: { $cond: [{ $lte: ['$quantity', '$reorder_threshold'] }, 1, 0] },
          },
          near_expiry_count: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ['$expiry_date', now] },
                    { $lte: ['$expiry_date', nearExpiry] },
                    { $gt: ['$quantity', 0] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          out_of_stock_count: {
            $sum: { $cond: [{ $eq: ['$quantity', 0] }, 1, 0] },
          },
          total_value: {
            $sum: { $multiply: ['$quantity', { $ifNull: ['$product.unit_cost', 0] }] },
          },
        },
      },
    ]);

    const statsMap = {};
    stats.forEach(s => { statsMap[s._id.toString()] = s; });

    const enriched = nodes.map(node => {
      const s = statsMap[node._id.toString()] || {};
      const totalQty = s.total_qty || 0;
      const utilization = node.capacity > 0 ? Math.round((totalQty / node.capacity) * 100) : 0;
      return {
        ...node,
        id: node._id.toString(),
        current_inventory: totalQty,
        capacity_utilization: Math.min(utilization, 100),
        capacity_status: getCapacityStatus(utilization),
        product_count: s.product_count || 0,
        low_stock_count: s.low_stock_count || 0,
        near_expiry_count: s.near_expiry_count || 0,
        out_of_stock_count: s.out_of_stock_count || 0,
        total_value: s.total_value || 0,
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

    if (!isValidId(id)) return sendError(res, 'Invalid node ID', 400);

    if (role === 'WAREHOUSE_ADMIN' && node_id.toString() !== id) {
      return sendError(res, 'Access denied — not your node', 403);
    }

    const node = await Node.findById(id).lean();
    if (!node) return sendError(res, 'Node not found', 404);

    const now = new Date();
    const nearExpiry = new Date();
    nearExpiry.setDate(now.getDate() + NEAR_EXPIRY_DAYS);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const inventory = await Inventory.find({ node_id: id })
      .populate('product_id', 'id sku name category unit_cost shelf_life_days')
      .sort({ quantity: 1 });

    const inventoryPlain = inventory.map(item => {
      const p = item.toJSON();
      p.product = p.product_id;
      const days = item.expiry_date
        ? Math.ceil((new Date(item.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
        : null;
      let status = 'HEALTHY';
      if (item.quantity <= 0) status = 'CRITICAL';
      else if (days !== null && days <= NEAR_EXPIRY_DAYS) status = 'NEAR_EXPIRY';
      else if (item.quantity <= item.reorder_threshold) status = 'LOW_STOCK';
      else if (item.quantity > item.reorder_threshold * OVERSTOCK_MULTIPLIER) status = 'OVERSTOCKED';
      return { ...p, stock_status: status, days_until_expiry: days, inventory_value: item.quantity * (p.product?.unit_cost || 0) };
    });

    const totalQty = inventoryPlain.reduce((s, i) => s + i.quantity, 0);
    const utilization = node.capacity > 0 ? Math.round((totalQty / node.capacity) * 100) : 0;

    const User = require('../models/User');
    const recentActivity = await InventoryTransaction.find({
      node_id: id,
      created_at: { $gte: thirtyDaysAgo },
    })
      .populate('product_id', 'id sku name')
      .populate('user_id', 'id name')
      .sort({ created_at: -1 })
      .limit(15);

    const recentSpoilage = await SpoilageEvent.find({
      node_id: id,
      event_date: { $gte: thirtyDaysAgo },
    })
      .populate('product_id', 'id sku name')
      .sort({ event_date: -1 })
      .limit(5);

    return sendSuccess(res, {
      node: {
        ...node,
        id: node._id.toString(),
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
