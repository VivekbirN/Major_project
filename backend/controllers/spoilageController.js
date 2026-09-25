const mongoose = require('mongoose');
const { Node, Product, Inventory, SpoilageEvent, InventoryTransaction } = require('../models');
const { sendSuccess, sendError } = require('../utils/responseHelper');

const isValidId = (id) => mongoose.isValidObjectId(id);

/**
 * POST /api/v1/spoilage
 */
const recordSpoilage = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { role, node_id: userNodeId, _id: userId } = req.user;
    const { node_id, product_id, quantity, reason, event_date } = req.body;

    if (!node_id || !product_id || !quantity || !reason) {
      await session.abortTransaction();
      return sendError(res, 'node_id, product_id, quantity, and reason are required', 400);
    }
    if (parseInt(quantity) <= 0) {
      await session.abortTransaction();
      return sendError(res, 'Quantity must be greater than zero', 400);
    }
    if (!isValidId(node_id) || !isValidId(product_id)) {
      await session.abortTransaction();
      return sendError(res, 'Invalid node_id or product_id', 400);
    }

    const targetNode = new mongoose.Types.ObjectId(node_id);

    if (role === 'WAREHOUSE_ADMIN' && userNodeId.toString() !== targetNode.toString()) {
      await session.abortTransaction();
      return sendError(res, 'Access denied — you can only record spoilage for your node', 403);
    }
    if (role === 'VIEWER') {
      await session.abortTransaction();
      return sendError(res, 'Access denied — viewers cannot record spoilage', 403);
    }

    const inv = await Inventory.findOne({ node_id: targetNode, product_id })
      .populate('product_id', 'id name sku unit_cost')
      .session(session);

    if (!inv) {
      await session.abortTransaction();
      return sendError(res, 'No inventory found for this product at this node', 404);
    }

    const qtyBefore = inv.quantity;
    const spoilQty = parseInt(quantity);

    if (spoilQty > qtyBefore) {
      await session.abortTransaction();
      return sendError(res, `Spoilage quantity (${spoilQty}) exceeds current stock (${qtyBefore})`, 400);
    }

    const qtyAfter = qtyBefore - spoilQty;
    const unitCost = inv.product_id?.unit_cost || 0;
    const estimatedLoss = spoilQty * unitCost;

    inv.quantity = qtyAfter;
    inv.last_updated = new Date();
    await inv.save({ session });

    const [spoilageEvent] = await SpoilageEvent.create([{
      node_id: targetNode,
      product_id,
      quantity: spoilQty,
      reason,
      estimated_loss: estimatedLoss,
      event_date: event_date ? new Date(event_date) : new Date(),
    }], { session });

    await InventoryTransaction.create([{
      inventory_id: inv._id,
      node_id: targetNode,
      product_id,
      user_id: userId,
      transaction_type: 'SPOILAGE',
      quantity_change: -spoilQty,
      quantity_before: qtyBefore,
      quantity_after: qtyAfter,
      reason: `Spoilage: ${reason}`,
    }], { session });

    await session.commitTransaction();

    return sendSuccess(res, {
      spoilage_event: spoilageEvent,
      quantity_before: qtyBefore,
      quantity_after: qtyAfter,
      estimated_loss: estimatedLoss,
    }, 'Spoilage recorded successfully', 201);
  } catch (error) {
    await session.abortTransaction();
    console.error('Record spoilage error:', error);
    return sendError(res, 'Failed to record spoilage', 500);
  } finally {
    session.endSession();
  }
};

/**
 * GET /api/v1/spoilage
 */
const getSpoilageEvents = async (req, res) => {
  try {
    const { role, node_id } = req.user;
    const { page = 1, limit = 20 } = req.query;

    const where = role !== 'SUPPLY_CHAIN_MANAGER' ? { node_id } : {};
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [count, rows] = await Promise.all([
      SpoilageEvent.countDocuments(where),
      SpoilageEvent.find(where)
        .populate('node_id', 'id name type')
        .populate('product_id', 'id sku name category')
        .sort({ event_date: -1 })
        .skip(offset)
        .limit(parseInt(limit)),
    ]);

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
