const { Op, fn, col, literal, sequelize: sq } = require('sequelize');
const { sequelize, Node, Product, Inventory, AnomalyAlert, SpoilageEvent, InventoryTransaction } = require('../models');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// Days within which inventory is considered "near expiry"
const NEAR_EXPIRY_DAYS = 7;
// Overstock = quantity > threshold * OVERSTOCK_MULTIPLIER
const OVERSTOCK_MULTIPLIER = 5;

const buildNodeScope = (role, node_id) => ({
  nodeWhere: role === 'SUPPLY_CHAIN_MANAGER' ? {} : { id: node_id },
  inventoryWhere: role === 'SUPPLY_CHAIN_MANAGER' ? {} : { node_id },
});

/**
 * GET /api/v1/dashboard/overview
 * Full supply-chain dashboard data in a single response.
 */
const getOverview = async (req, res) => {
  try {
    const { role, node_id } = req.user;
    const { nodeWhere, inventoryWhere } = buildNodeScope(role, node_id);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const nearExpiryDate = new Date();
    nearExpiryDate.setDate(today.getDate() + NEAR_EXPIRY_DAYS);
    const nearExpiryStr = nearExpiryDate.toISOString().split('T')[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

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
      Node.count({ where: nodeWhere }),
      Product.count(),
      Inventory.findOne({
        where: inventoryWhere,
        attributes: [[fn('SUM', col('quantity')), 'total']],
        raw: true,
      }),
      Inventory.count({
        where: { ...inventoryWhere, quantity: { [Op.lte]: col('reorder_threshold') } },
      }),
      Inventory.count({
        where: {
          ...inventoryWhere,
          expiry_date: { [Op.between]: [todayStr, nearExpiryStr] },
          quantity: { [Op.gt]: 0 },
        },
      }),
      // Overstock: quantity > reorder_threshold * OVERSTOCK_MULTIPLIER
      Inventory.count({
        where: {
          ...inventoryWhere,
          quantity: { [Op.gt]: literal(`reorder_threshold * ${OVERSTOCK_MULTIPLIER}`) },
        },
      }),
      AnomalyAlert.count({
        where: { status: 'ACTIVE', ...(role !== 'SUPPLY_CHAIN_MANAGER' && { node_id }) },
      }),
      SpoilageEvent.findOne({
        where: {
          ...(role !== 'SUPPLY_CHAIN_MANAGER' && { node_id }),
          event_date: { [Op.gte]: thirtyDaysAgo.toISOString().split('T')[0] },
        },
        attributes: [
          [fn('SUM', col('estimated_loss')), 'total_loss'],
          [fn('COUNT', col('SpoilageEvent.id')), 'event_count'],
        ],
        raw: true,
      }),
      // Inventory value = SUM(quantity * unit_cost)
      Inventory.findOne({
        where: inventoryWhere,
        attributes: [[literal('SUM(quantity * (SELECT unit_cost FROM products WHERE products.id = inventory.product_id))'), 'total_value']],
        raw: true,
      }),
    ]);

    const kpis = {
      total_nodes: totalNodes,
      total_products: totalProducts,
      total_inventory_units: parseInt(inventoryAgg?.total) || 0,
      total_inventory_value: parseFloat(inventoryValueAgg?.total_value) || 0,
      low_stock_items: lowStockCount,
      near_expiry_items: nearExpiryCount,
      overstock_items: overstockCount,
      active_alerts: activeAlerts,
      recent_spoilage: {
        count: parseInt(spoilageAgg?.event_count) || 0,
        estimated_loss: parseFloat(spoilageAgg?.total_loss) || 0,
      },
    };

    // ── Nodes Table ───────────────────────────────────────────────────────────
    const nodes = await Node.findAll({
      where: nodeWhere,
      order: [['name', 'ASC']],
      raw: true,
    });

    // For each node, get inventory stats
    const nodeIds = nodes.map(n => n.id);
    const nodeInventoryStats = await Inventory.findAll({
      where: { node_id: { [Op.in]: nodeIds } },
      attributes: [
        'node_id',
        [fn('SUM', col('quantity')), 'total_qty'],
        [fn('COUNT', col('id')), 'product_count'],
        [fn('SUM', literal('CASE WHEN quantity <= reorder_threshold THEN 1 ELSE 0 END')), 'low_stock_count'],
        [fn('SUM', literal(`CASE WHEN expiry_date BETWEEN '${todayStr}' AND '${nearExpiryStr}' AND quantity > 0 THEN 1 ELSE 0 END`)), 'near_expiry_count'],
      ],
      group: ['node_id'],
      raw: true,
    });

    const nodeStatsMap = {};
    nodeInventoryStats.forEach(s => { nodeStatsMap[s.node_id] = s; });

    const nodesWithStats = nodes.map(node => {
      const stats = nodeStatsMap[node.id] || {};
      const totalQty = parseInt(stats.total_qty) || 0;
      const utilization = node.capacity > 0 ? Math.round((totalQty / node.capacity) * 100) : 0;
      return {
        ...node,
        current_inventory: totalQty,
        capacity_utilization: utilization,
        product_count: parseInt(stats.product_count) || 0,
        low_stock_count: parseInt(stats.low_stock_count) || 0,
        near_expiry_count: parseInt(stats.near_expiry_count) || 0,
      };
    });

    // ── Low-Stock Items ───────────────────────────────────────────────────────
    const lowStockItems = await Inventory.findAll({
      where: { ...inventoryWhere, quantity: { [Op.lte]: col('reorder_threshold') } },
      include: [
        { model: Node, as: 'node', attributes: ['id', 'name', 'type'] },
        { model: Product, as: 'product', attributes: ['id', 'sku', 'name', 'category', 'unit_cost'] },
      ],
      order: [['quantity', 'ASC']],
      limit: 10,
    });

    // ── Near-Expiry Items ──────────────────────────────────────────────────────
    const nearExpiryItems = await Inventory.findAll({
      where: {
        ...inventoryWhere,
        expiry_date: { [Op.between]: [todayStr, nearExpiryStr] },
        quantity: { [Op.gt]: 0 },
      },
      include: [
        { model: Node, as: 'node', attributes: ['id', 'name', 'type'] },
        { model: Product, as: 'product', attributes: ['id', 'sku', 'name', 'category', 'unit_cost'] },
      ],
      order: [['expiry_date', 'ASC']],
      limit: 10,
    });

    // ── Inventory by Category ─────────────────────────────────────────────────
    const inventoryByCategory = await Inventory.findAll({
      where: inventoryWhere,
      attributes: ['product_id', [fn('SUM', col('Inventory.quantity')), 'total_qty']],
      include: [{ model: Product, as: 'product', attributes: ['category'] }],
      group: ['product.category', 'Inventory.product_id'],
      raw: true,
    });

    const categoryMap = {};
    inventoryByCategory.forEach(r => {
      const cat = r['product.category'];
      categoryMap[cat] = (categoryMap[cat] || 0) + parseInt(r.total_qty);
    });
    const categoryData = Object.entries(categoryMap)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);

    // ── Inventory by Node ──────────────────────────────────────────────────────
    const inventoryByNode = nodesWithStats.map(n => ({
      node_id: n.id,
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
