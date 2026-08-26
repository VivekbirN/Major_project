const { sequelize, Node, Product, Inventory, SpoilageEvent, InventoryTransaction } = require('../models');
const { sendSuccess, sendError } = require('../utils/responseHelper');

/**
 * POST /api/v1/spoilage
 * Record spoilage — reduces inventory, creates spoilage_event, transaction-safe
 */
const recordSpoilage = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { role, node_id: userNodeId, id: userId } = req.user;
    const { node_id, product_id, quantity, reason, event_date } = req.body;

    // Validate required fields
    if (!node_id || !product_id || !quantity || !reason) {
      await t.rollback();
      return sendError(res, 'node_id, product_id, quantity, and reason are required', 400);
    }
    if (parseInt(quantity) <= 0) {
      await t.rollback();
      return sendError(res, 'Quantity must be greater than zero', 400);
    }

    const targetNode = parseInt(node_id);

    // RBAC
    if (role === 'WAREHOUSE_ADMIN' && userNodeId !== targetNode) {
      await t.rollback();
      return sendError(res, 'Access denied — you can only record spoilage for your node', 403);
    }
    if (role === 'VIEWER') {
      await t.rollback();
      return sendError(res, 'Access denied — viewers cannot record spoilage', 403);
    }

    // Find inventory record
    const inv = await Inventory.findOne({
      where: { node_id: targetNode, product_id: parseInt(product_id) },
      include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'sku', 'unit_cost'] }],
      transaction: t,
    });

    if (!inv) {
      await t.rollback();
      return sendError(res, 'No inventory found for this product at this node', 404);
    }

    const qtyBefore = inv.quantity;
    const spoilQty = parseInt(quantity);

    if (spoilQty > qtyBefore) {
      await t.rollback();
      return sendError(res, `Spoilage quantity (${spoilQty}) exceeds current stock (${qtyBefore})`, 400);
    }

    const qtyAfter = qtyBefore - spoilQty;
    const unitCost = parseFloat(inv.product?.unit_cost || 0);
    const estimatedLoss = spoilQty * unitCost;

    // Reduce inventory
    await inv.update({ quantity: qtyAfter, last_updated: new Date() }, { transaction: t });

    // Create spoilage event
    const spoilageEvent = await SpoilageEvent.create({
      node_id: targetNode,
      product_id: parseInt(product_id),
      quantity: spoilQty,
      reason,
      estimated_loss: estimatedLoss,
      event_date: event_date || new Date().toISOString().split('T')[0],
    }, { transaction: t });

    // Record inventory transaction
    await InventoryTransaction.create({
      inventory_id: inv.id,
      node_id: targetNode,
      product_id: parseInt(product_id),
      user_id: userId,
      transaction_type: 'SPOILAGE',
      quantity_change: -spoilQty,
      quantity_before: qtyBefore,
      quantity_after: qtyAfter,
      reason: `Spoilage: ${reason}`,
    }, { transaction: t });

    await t.commit();

    return sendSuccess(res, {
      spoilage_event: spoilageEvent,
      quantity_before: qtyBefore,
      quantity_after: qtyAfter,
      estimated_loss: estimatedLoss,
    }, 'Spoilage recorded successfully', 201);
  } catch (error) {
    await t.rollback();
    console.error('Record spoilage error:', error);
    return sendError(res, 'Failed to record spoilage', 500);
  }
};

/**
 * GET /api/v1/spoilage
 * List spoilage events — scoped by role
 */
const getSpoilageEvents = async (req, res) => {
  try {
    const { role, node_id } = req.user;
    const { page = 1, limit = 20 } = req.query;

    const where = role !== 'SUPPLY_CHAIN_MANAGER' ? { node_id } : {};
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await SpoilageEvent.findAndCountAll({
      where,
      include: [
        { model: Node, as: 'node', attributes: ['id', 'name', 'type'] },
        { model: Product, as: 'product', attributes: ['id', 'sku', 'name', 'category'] },
      ],
      order: [['event_date', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    return sendSuccess(res, {
      spoilage_events: rows,
      pagination: { total: count, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(count / parseInt(limit)) },
    }, 'Spoilage events retrieved');
  } catch (error) {
    console.error('Get spoilage events error:', error);
    return sendError(res, 'Failed to retrieve spoilage events', 500);
  }
};

module.exports = { recordSpoilage, getSpoilageEvents };
