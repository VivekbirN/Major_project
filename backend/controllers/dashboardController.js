const mongoose = require('mongoose');
const { Node, Product, Inventory, AnomalyAlert, SpoilageEvent, InventoryTransaction } = require('../models');
const { sendSuccess, sendError } = require('../utils/responseHelper');

const NEAR_EXPIRY_DAYS = 7;
const OVERSTOCK_MULTIPLIER = 5;

const buildNodeScope = (role, node_id) => ({
  nodeWhere: role === 'SUPPLY_CHAIN_MANAGER' ? {} : { _id: node_id },
  inventoryWhere: role === 'SUPPLY_CHAIN_MANAGER' ? {} : { node_id },
});

/**
 * GET /api/v1/dashboard/overview
 */
const getOverview = async (req, res) => {
  try {
    const { role, node_id } = req.user;
    const { nodeWhere, inventoryWhere } = buildNodeScope(role, node_id);

    const now = new Date();
    const nearExpiryDate = new Date();
    nearExpiryDate.setDate(now.getDate() + NEAR_EXPIRY_DAYS);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // ── KPIs ──────────────────────────────────────────────────────────────────

    const [
      totalNodes,
      totalProducts,
      inventoryAgg,
      lowStockCount,
      nearExpiryCount,
      overstockCount,
      activeAlerts,
      spoilageAgg,
      inventoryValueAgg,
    ] = await Promise.all([
      Node.countDocuments(nodeWhere),
      Product.countDocuments(),
      Inventory.aggregate([
        { $match: inventoryWhere },
        { $group: { _id: null, total: { $sum: '$quantity' } } },
      ]),
      Inventory.countDocuments({
        ...inventoryWhere,
        $expr: { $lte: ['$quantity', '$reorder_threshold'] },
      }),
      Inventory.countDocuments({
        ...inventoryWhere,
        expiry_date: { $gte: now, $lte: nearExpiryDate },
        quantity: { $gt: 0 },
      }),
      Inventory.countDocuments({
        ...inventoryWhere,
        $expr: { $gt: ['$quantity', { $multiply: ['$reorder_threshold', OVERSTOCK_MULTIPLIER] }] },
      }),
      AnomalyAlert.countDocuments({
        status: 'ACTIVE',
        ...(role !== 'SUPPLY_CHAIN_MANAGER' && { node_id }),
      }),
      SpoilageEvent.aggregate([
        {
          $match: {
            ...(role !== 'SUPPLY_CHAIN_MANAGER' && { node_id }),
            event_date: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: null,
            total_loss: { $sum: '$estimated_loss' },
            event_count: { $sum: 1 },
          },
        },
      ]),
      Inventory.aggregate([
        { $match: inventoryWhere },
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
            _id: null,
            total_value: {
              $sum: { $multiply: ['$quantity', { $ifNull: ['$product.unit_cost', 0] }] },
            },
          },
        },
      ]),
    ]);

    const kpis = {
      total_nodes: totalNodes,
      total_products: totalProducts,
      total_inventory_units: inventoryAgg[0]?.total || 0,
      total_inventory_value: inventoryValueAgg[0]?.total_value || 0,
      low_stock_items: lowStockCount,
      near_expiry_items: nearExpiryCount,
      overstock_items: overstockCount,
      active_alerts: activeAlerts,
      recent_spoilage: {
        count: spoilageAgg[0]?.event_count || 0,
        estimated_loss: spoilageAgg[0]?.total_loss || 0,
      },
    };

    // ── Nodes Table ───────────────────────────────────────────────────────────

    const nodes = await Node.find(nodeWhere).sort({ name: 1 }).lean();
    const nodeIds = nodes.map(n => n._id);

    const nodeInventoryStats = await Inventory.aggregate([
      { $match: { node_id: { $in: nodeIds } } },
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
                    { $lte: ['$expiry_date', nearExpiryDate] },
                    { $gt: ['$quantity', 0] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const nodeStatsMap = {};
    nodeInventoryStats.forEach(s => { nodeStatsMap[s._id.toString()] = s; });

    const nodesWithStats = nodes.map(node => {
      const stats = nodeStatsMap[node._id.toString()] || {};
      const totalQty = stats.total_qty || 0;
      const utilization = node.capacity > 0 ? Math.round((totalQty / node.capacity) * 100) : 0;
      return {
        ...node,
        id: node._id.toString(),
        current_inventory: totalQty,
        capacity_utilization: utilization,
        product_count: stats.product_count || 0,
        low_stock_count: stats.low_stock_count || 0,
        near_expiry_count: stats.near_expiry_count || 0,
      };
    });

    // ── Low-Stock Items ───────────────────────────────────────────────────────

    const lowStockItems = await Inventory.find({
      ...inventoryWhere,
      $expr: { $lte: ['$quantity', '$reorder_threshold'] },
    })
      .populate('node_id', 'id name type')
      .populate('product_id', 'id sku name category unit_cost')
      .sort({ quantity: 1 })
      .limit(10);

    // ── Near-Expiry Items ──────────────────────────────────────────────────────

    const nearExpiryItems = await Inventory.find({
      ...inventoryWhere,
      expiry_date: { $gte: now, $lte: nearExpiryDate },
      quantity: { $gt: 0 },
    })
      .populate('node_id', 'id name type')
      .populate('product_id', 'id sku name category unit_cost')
      .sort({ expiry_date: 1 })
      .limit(10);

    // ── Inventory by Category ─────────────────────────────────────────────────

    const inventoryByCategory = await Inventory.aggregate([
      { $match: inventoryWhere },
      {
        $lookup: {
          from: 'products',
          localField: 'product_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$product.category', total: { $sum: '$quantity' } } },
      { $sort: { total: -1 } },
    ]);

    const categoryData = inventoryByCategory
      .filter(r => r._id)
      .map(r => ({ category: r._id, total: r.total }));

    // ── Inventory by Node ──────────────────────────────────────────────────────

    const inventoryByNode = nodesWithStats.map(n => ({
      node_id: n._id || n.id,
      node_name: n.name,
      node_type: n.type,
      total: n.current_inventory,
    }));

    return sendSuccess(res, {
      kpis,
      nodes: nodesWithStats,
      low_stock: lowStockItems,
      near_expiry: nearExpiryItems,
      inventory_by_category: categoryData,
      inventory_by_node: inventoryByNode,
    }, 'Dashboard overview retrieved');
  } catch (error) {
    console.error('Dashboard overview error:', error);
    return sendError(res, 'Failed to retrieve dashboard overview', 500);
  }
};

module.exports = { getOverview };
