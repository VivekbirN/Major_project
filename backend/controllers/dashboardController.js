const { Op, fn, col, literal } = require('sequelize');
const { Node, Product, Inventory, AnomalyAlert, SpoilageEvent } = require('../models');
const { sendSuccess, sendError } = require('../utils/responseHelper');

/**
 * GET /api/v1/dashboard/overview
 * Returns high-level metrics for the dashboard cards
 */
const getOverview = async (req, res) => {
  try {
    const { role, node_id } = req.user;

    // Determine scope: managers see all, others see their node
    const nodeFilter = role === 'SUPPLY_CHAIN_MANAGER' ? {} : { id: node_id };
    const inventoryNodeFilter =
      role === 'SUPPLY_CHAIN_MANAGER' ? {} : { node_id };

    // Total nodes
    const totalNodes = await Node.count({ where: nodeFilter });

    // Total products
    const totalProducts = await Product.count();

    // Total inventory units
    const inventoryAgg = await Inventory.findAll({
      where: inventoryNodeFilter,
      attributes: [[fn('SUM', col('quantity')), 'total']],
      raw: true,
    });
    const totalInventoryUnits = parseInt(inventoryAgg[0]?.total) || 0;

    // Low stock items (quantity <= reorder_threshold)
    const lowStockItems = await Inventory.count({
      where: {
        ...inventoryNodeFilter,
        quantity: { [Op.lte]: col('reorder_threshold') },
      },
    });

    // Near-expiry items (expiry within next 7 days)
    const today = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(today.getDate() + 7);

    const nearExpiryItems = await Inventory.count({
      where: {
        ...inventoryNodeFilter,
        expiry_date: {
          [Op.between]: [
            today.toISOString().split('T')[0],
            sevenDaysLater.toISOString().split('T')[0],
          ],
        },
        quantity: { [Op.gt]: 0 },
      },
    });

    // Active alerts
    const activeAlerts = await AnomalyAlert.count({
      where: {
        status: 'ACTIVE',
        ...(role !== 'SUPPLY_CHAIN_MANAGER' && { node_id }),
      },
    });

    // Recent spoilage events (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const spoilageAgg = await SpoilageEvent.findAll({
      where: {
        ...(role !== 'SUPPLY_CHAIN_MANAGER' && { node_id }),
        event_date: { [Op.gte]: thirtyDaysAgo.toISOString().split('T')[0] },
      },
      attributes: [
        [fn('SUM', col('estimated_loss')), 'total_loss'],
        [fn('COUNT', col('id')), 'event_count'],
      ],
      raw: true,
    });

    const recentSpoilageLoss = parseFloat(spoilageAgg[0]?.total_loss) || 0;
    const recentSpoilageCount = parseInt(spoilageAgg[0]?.event_count) || 0;

    return sendSuccess(res, {
      total_nodes: totalNodes,
      total_products: totalProducts,
      total_inventory_units: totalInventoryUnits,
      low_stock_items: lowStockItems,
      near_expiry_items: nearExpiryItems,
      active_alerts: activeAlerts,
      recent_spoilage: {
        count: recentSpoilageCount,
        estimated_loss: recentSpoilageLoss,
      },
    }, 'Dashboard overview retrieved');
  } catch (error) {
    console.error('Dashboard overview error:', error);
    return sendError(res, 'Failed to retrieve dashboard overview', 500);
  }
};

module.exports = { getOverview };
