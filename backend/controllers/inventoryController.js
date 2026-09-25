const mongoose = require('mongoose');
const { Node, Product, Inventory, InventoryTransaction, SpoilageEvent } = require('../models');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// ── Constants ─────────────────────────────────────────────────────────────────
const NEAR_EXPIRY_DAYS = 7;
const OVERSTOCK_MULTIPLIER = 5;

// ── Helpers ───────────────────────────────────────────────────────────────────

const daysUntil = (date) => {
  if (!date) return null;
  return Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
};

const calcStockStatus = (item) => {
  const { quantity, reorder_threshold, expiry_date } = item;
  const days = daysUntil(expiry_date);
  if (quantity <= 0) return 'CRITICAL';
  if (days !== null && days <= NEAR_EXPIRY_DAYS) return 'NEAR_EXPIRY';
  if (quantity <= reorder_threshold) return 'LOW_STOCK';
  if (quantity > reorder_threshold * OVERSTOCK_MULTIPLIER) return 'OVERSTOCKED';
  return 'HEALTHY';
};

const buildNodeScope = (role, node_id) =>
  role === 'SUPPLY_CHAIN_MANAGER' ? {} : { node_id };

const isValidId = (id) => mongoose.isValidObjectId(id);

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * GET /api/v1/inventory/overview
 */
const getInventoryOverview = async (req, res) => {
  try {
    const { role, node_id } = req.user;
    const scope = buildNodeScope(role, node_id);

    const now = new Date();
    const nearExpiryDate = new Date();
    nearExpiryDate.setDate(now.getDate() + NEAR_EXPIRY_DAYS);

    const [totalResult, lowStock, nearExpiryCount, overstock, valueResult] = await Promise.all([
      Inventory.aggregate([
        { $match: scope },
        { $group: { _id: null, total: { $sum: '$quantity' } } },
      ]),
      Inventory.countDocuments({ ...scope, $expr: { $lte: ['$quantity', '$reorder_threshold'] } }),
      Inventory.countDocuments({
        ...scope,
        expiry_date: { $gte: now, $lte: nearExpiryDate },
        quantity: { $gt: 0 },
      }),
      Inventory.countDocuments({
        ...scope,
        $expr: { $gt: ['$quantity', { $multiply: ['$reorder_threshold', OVERSTOCK_MULTIPLIER] }] },
      }),
      Inventory.aggregate([
        { $match: scope },
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
            total_value: { $sum: { $multiply: ['$quantity', { $ifNull: ['$product.unit_cost', 0] }] } },
          },
        },
      ]),
    ]);

    return sendSuccess(res, {
      total_units: totalResult[0]?.total || 0,
      low_stock_count: lowStock,
      near_expiry_count: nearExpiryCount,
      overstock_count: overstock,
      total_value: valueResult[0]?.total_value || 0,
    }, 'Inventory overview retrieved');
  } catch (error) {
    console.error('Inventory overview error:', error);
    return sendError(res, 'Failed to retrieve inventory overview', 500);
  }
};

/**
 * GET /api/v1/inventory
 * Server-side filtering, sorting, pagination
 */
const getInventory = async (req, res) => {
  try {
    const { role, node_id } = req.user;
    const {
      page = 1, limit = 20,
      node_id: qNode, product_id: qProduct, category: qCategory,
      status: qStatus, search: qSearch,
      sort = 'last_updated', order = 'DESC',
    } = req.query;

    const now = new Date();
    const nearExpiryDate = new Date();
    nearExpiryDate.setDate(now.getDate() + NEAR_EXPIRY_DAYS);

    // Build inventory-level match
    let invMatch = buildNodeScope(role, node_id);
    if (role === 'SUPPLY_CHAIN_MANAGER' && qNode && isValidId(qNode)) {
      invMatch.node_id = new mongoose.Types.ObjectId(qNode);
    }
    if (qProduct && isValidId(qProduct)) {
      invMatch.product_id = new mongoose.Types.ObjectId(qProduct);
    }
    if (qStatus === 'LOW_STOCK') {
      invMatch.$and = [
        { $expr: { $lte: ['$quantity', '$reorder_threshold'] } },
        { quantity: { $gt: 0 } },
      ];
    } else if (qStatus === 'OVERSTOCKED') {
      invMatch.$expr = { $gt: ['$quantity', { $multiply: ['$reorder_threshold', OVERSTOCK_MULTIPLIER] }] };
    } else if (qStatus === 'NEAR_EXPIRY') {
      invMatch.expiry_date = { $gte: now, $lte: nearExpiryDate };
      invMatch.quantity = { $gt: 0 };
    } else if (qStatus === 'CRITICAL') {
      invMatch.quantity = 0;
    }

    const sortDir = order === 'ASC' ? 1 : -1;
    const SORT_MAP = {
      quantity: { quantity: sortDir },
      expiry_date: { expiry_date: sortDir },
      last_updated: { last_updated: sortDir },
      product_name: { 'product.name': sortDir },
      node_name: { 'node.name': sortDir },
    };
    const sortClause = SORT_MAP[sort] || { last_updated: -1 };

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build aggregation pipeline
    const pipeline = [
      { $match: invMatch },
      {
        $lookup: {
          from: 'nodes',
          localField: 'node_id',
          foreignField: '_id',
          as: 'node',
        },
      },
      { $unwind: { path: '$node', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'products',
          localField: 'product_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    ];

    // Product-level filters
    const productFilters = {};
    if (qCategory) productFilters['product.category'] = qCategory;
    if (qSearch) {
      productFilters.$or = [
        { 'product.name': { $regex: qSearch, $options: 'i' } },
        { 'product.sku': { $regex: qSearch, $options: 'i' } },
      ];
    }
    if (Object.keys(productFilters).length) {
      pipeline.push({ $match: productFilters });
    }

    const countPipeline = [...pipeline, { $count: 'total' }];
    const dataPipeline = [
      ...pipeline,
      { $sort: sortClause },
      { $skip: offset },
      { $limit: parseInt(limit) },
    ];

    const [countResult, rows] = await Promise.all([
      Inventory.aggregate(countPipeline),
      Inventory.aggregate(dataPipeline),
    ]);

    const count = countResult[0]?.total || 0;

    const annotated = rows.map(item => {
      item.id = item._id.toString();
      item.stock_status = calcStockStatus(item);
      item.days_until_expiry = daysUntil(item.expiry_date);
      item.inventory_value = item.quantity * (item.product?.unit_cost || 0);
      if (item.product) { item.product.id = item.product._id?.toString(); }
      if (item.node) { item.node.id = item.node._id?.toString(); }
      return item;
    });

    return sendSuccess(res, {
      inventory: annotated,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    }, 'Inventory retrieved');
  } catch (error) {
    console.error('Get inventory error:', error);
    return sendError(res, 'Failed to retrieve inventory', 500);
  }
};

/**
 * GET /api/v1/inventory/:id
 */
const getInventoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, node_id } = req.user;

    if (!isValidId(id)) return sendError(res, 'Invalid inventory ID', 400);

    const item = await Inventory.findById(id)
      .populate('node_id', 'id name type location capacity')
      .populate('product_id', 'id sku name category shelf_life_days unit_cost');

    if (!item) return sendError(res, 'Inventory record not found', 404);

    if (role === 'WAREHOUSE_ADMIN' && item.node_id._id.toString() !== node_id.toString()) {
      return sendError(res, 'Access denied — not your node', 403);
    }

    const User = require('../models/User');
    const transactions = await InventoryTransaction.find({ inventory_id: id })
      .populate({ path: 'user_id', select: 'id name role' })
      .sort({ created_at: -1 })
      .limit(20);

    const plain = item.toJSON();
    plain.node = plain.node_id;   plain.node_id = plain.node?._id;
    plain.product = plain.product_id; plain.product_id = plain.product?._id;
    plain.stock_status = calcStockStatus(plain);
    plain.days_until_expiry = daysUntil(plain.expiry_date);
    plain.inventory_value = plain.quantity * (plain.product?.unit_cost || 0);

    return sendSuccess(res, { inventory: plain, transactions }, 'Inventory record retrieved');
  } catch (error) {
    console.error('Get inventory by id error:', error);
    return sendError(res, 'Failed to retrieve inventory record', 500);
  }
};

/**
 * POST /api/v1/inventory/incoming
 */
const incomingShipment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { role, node_id: userNodeId, _id: userId } = req.user;
    const { node_id, product_id, quantity, reason, reference, expiry_date } = req.body;

    if (!node_id || !product_id || !quantity) {
      await session.abortTransaction();
      return sendError(res, 'node_id, product_id, and quantity are required', 400);
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
      return sendError(res, 'Access denied — you can only modify your assigned node', 403);
    }

    const [node, product] = await Promise.all([
      Node.findById(targetNode).session(session),
      Product.findById(product_id).session(session),
    ]);
    if (!node) { await session.abortTransaction(); return sendError(res, 'Node not found', 404); }
    if (!product) { await session.abortTransaction(); return sendError(res, 'Product not found', 404); }

    let inv = await Inventory.findOne({ node_id: targetNode, product_id }).session(session);
    let created = false;

    if (!inv) {
      [inv] = await Inventory.create([{
        node_id: targetNode,
        product_id,
        quantity: 0,
        reorder_threshold: 50,
        expiry_date: expiry_date || null,
        last_updated: new Date(),
      }], { session });
      created = true;
    }

    const qtyBefore = inv.quantity;
    const qtyAfter = qtyBefore + parseInt(quantity);

    inv.quantity = qtyAfter;
    inv.last_updated = new Date();
    if (expiry_date) inv.expiry_date = expiry_date;
    await inv.save({ session });

    await InventoryTransaction.create([{
      inventory_id: inv._id,
      node_id: targetNode,
      product_id,
      user_id: userId,
      transaction_type: 'INCOMING',
      quantity_change: parseInt(quantity),
      quantity_before: qtyBefore,
      quantity_after: qtyAfter,
      reason: reason || 'Incoming shipment',
      reference: reference || null,
    }], { session });

    await session.commitTransaction();

    const populated = await Inventory.findById(inv._id)
      .populate('node_id', 'id name type location capacity')
      .populate('product_id', 'id sku name category shelf_life_days unit_cost');

    const plain = populated.toJSON();
    plain.node = plain.node_id; plain.product = plain.product_id;
    plain.stock_status = calcStockStatus(plain);
    plain.inventory_value = plain.quantity * (plain.product?.unit_cost || 0);

    return sendSuccess(res, { inventory: plain, created }, 'Incoming shipment recorded', 201);
  } catch (error) {
    await session.abortTransaction();
    console.error('Incoming shipment error:', error);
    return sendError(res, 'Failed to record incoming shipment', 500);
  } finally {
    session.endSession();
  }
};

/**
 * POST /api/v1/inventory/outgoing
 */
const outgoingShipment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { role, node_id: userNodeId, _id: userId } = req.user;
    const { node_id, product_id, quantity, reason, reference } = req.body;

    if (!node_id || !product_id || !quantity) {
      await session.abortTransaction();
      return sendError(res, 'node_id, product_id, and quantity are required', 400);
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
      return sendError(res, 'Access denied — you can only modify your assigned node', 403);
    }

    const inv = await Inventory.findOne({ node_id: targetNode, product_id }).session(session);
    if (!inv) {
      await session.abortTransaction();
      return sendError(res, 'No inventory found for this product at this node', 404);
    }

    const qtyBefore = inv.quantity;
    const qtyAfter = qtyBefore - parseInt(quantity);

    if (qtyAfter < 0) {
      await session.abortTransaction();
      return sendError(res, `Insufficient stock. Available: ${qtyBefore}, Requested: ${quantity}`, 400);
    }

    inv.quantity = qtyAfter;
    inv.last_updated = new Date();
    await inv.save({ session });

    await InventoryTransaction.create([{
      inventory_id: inv._id,
      node_id: targetNode,
      product_id,
      user_id: userId,
      transaction_type: 'OUTGOING',
      quantity_change: -parseInt(quantity),
      quantity_before: qtyBefore,
      quantity_after: qtyAfter,
      reason: reason || 'Outgoing shipment',
      reference: reference || null,
    }], { session });

    await session.commitTransaction();

    const populated = await Inventory.findById(inv._id)
      .populate('node_id', 'id name type location capacity')
      .populate('product_id', 'id sku name category shelf_life_days unit_cost');

    const plain = populated.toJSON();
    plain.node = plain.node_id; plain.product = plain.product_id;
    plain.stock_status = calcStockStatus(plain);
    plain.inventory_value = plain.quantity * (plain.product?.unit_cost || 0);

    return sendSuccess(res, { inventory: plain }, 'Outgoing shipment recorded');
  } catch (error) {
    await session.abortTransaction();
    console.error('Outgoing shipment error:', error);
    return sendError(res, 'Failed to record outgoing shipment', 500);
  } finally {
    session.endSession();
  }
};

/**
 * PATCH /api/v1/inventory/:id
 */
const adjustInventory = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const { role, node_id: userNodeId, _id: userId } = req.user;
    const { quantity, reorder_threshold, expiry_date, reason } = req.body;

    if (!isValidId(id)) {
      await session.abortTransaction();
      return sendError(res, 'Invalid inventory ID', 400);
    }

    const inv = await Inventory.findById(id)
      .populate('node_id', 'id name type location capacity')
      .populate('product_id', 'id sku name category shelf_life_days unit_cost')
      .session(session);

    if (!inv) {
      await session.abortTransaction();
      return sendError(res, 'Inventory record not found', 404);
    }

    if (role === 'WAREHOUSE_ADMIN' && inv.node_id._id.toString() !== userNodeId.toString()) {
      await session.abortTransaction();
      return sendError(res, 'Access denied — not your node', 403);
    }

    if (quantity !== undefined && parseInt(quantity) < 0) {
      await session.abortTransaction();
      return sendError(res, 'Quantity cannot be negative', 400);
    }

    const qtyBefore = inv.quantity;
    const newQty = quantity !== undefined ? parseInt(quantity) : qtyBefore;
    const qtyChange = newQty - qtyBefore;

    if (quantity !== undefined) inv.quantity = newQty;
    if (reorder_threshold !== undefined) inv.reorder_threshold = parseInt(reorder_threshold);
    if (expiry_date !== undefined) inv.expiry_date = expiry_date;
    inv.last_updated = new Date();
    await inv.save({ session });

    if (qtyChange !== 0) {
      await InventoryTransaction.create([{
        inventory_id: inv._id,
        node_id: inv.node_id._id,
        product_id: inv.product_id._id,
        user_id: userId,
        transaction_type: 'ADJUSTMENT',
        quantity_change: qtyChange,
        quantity_before: qtyBefore,
        quantity_after: newQty,
        reason: reason || 'Manual adjustment',
      }], { session });
    }

    await session.commitTransaction();

    await inv.reload?.();
    const populated = await Inventory.findById(inv._id)
      .populate('node_id', 'id name type location capacity')
      .populate('product_id', 'id sku name category shelf_life_days unit_cost');

    const plain = populated.toJSON();
    plain.node = plain.node_id; plain.product = plain.product_id;
    plain.stock_status = calcStockStatus(plain);
    plain.inventory_value = plain.quantity * (plain.product?.unit_cost || 0);

    return sendSuccess(res, { inventory: plain }, 'Inventory adjusted');
  } catch (error) {
    await session.abortTransaction();
    console.error('Adjust inventory error:', error);
    return sendError(res, 'Failed to adjust inventory', 500);
  } finally {
    session.endSession();
  }
};

/**
 * GET /api/v1/inventory/transactions
 */
const getTransactions = async (req, res) => {
  try {
    const { role, node_id } = req.user;
    const { page = 1, limit = 20, node_id: qNode, inventory_id: qInv } = req.query;

    const where = {};
    if (role === 'WAREHOUSE_ADMIN') where.node_id = node_id;
    else if (qNode && isValidId(qNode)) where.node_id = new mongoose.Types.ObjectId(qNode);
    if (qInv && isValidId(qInv)) where.inventory_id = new mongoose.Types.ObjectId(qInv);

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [count, rows] = await Promise.all([
      InventoryTransaction.countDocuments(where),
      InventoryTransaction.find(where)
        .populate('node_id', 'id name')
        .populate('product_id', 'id sku name category')
        .populate('user_id', 'id name role')
        .sort({ created_at: -1 })
        .skip(offset)
        .limit(parseInt(limit)),
    ]);

    return sendSuccess(res, {
      transactions: rows,
      pagination: { total: count, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(count / parseInt(limit)) },
    }, 'Transactions retrieved');
  } catch (error) {
    console.error('Get transactions error:', error);
    return sendError(res, 'Failed to retrieve transactions', 500);
  }
};

/**
 * GET /api/v1/products (basic — kept for backward compat)
 */
const getProducts = async (req, res) => {
  try {
    const Product = require('../models/Product');
    const { page = 1, limit = 20, category, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (category) where.category = category;
    if (search) where.$or = [
      { name: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
    ];

    const [count, rows] = await Promise.all([
      Product.countDocuments(where),
      Product.find(where).sort({ name: 1 }).skip(offset).limit(parseInt(limit)),
    ]);

    return sendSuccess(res, {
      products: rows,
      pagination: { total: count, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(count / parseInt(limit)) },
    }, 'Products retrieved');
  } catch (error) {
    return sendError(res, 'Failed to retrieve products', 500);
  }
};

/**
 * GET /api/v1/inventory/nodes (basic — kept for backward compat)
 */
const getNodes = async (req, res) => {
  try {
    const { role, node_id } = req.user;
    const where = role !== 'SUPPLY_CHAIN_MANAGER' ? { _id: node_id } : {};
    const nodes = await Node.find(where).sort({ name: 1 });
    return sendSuccess(res, { nodes }, 'Nodes retrieved');
  } catch (error) {
    return sendError(res, 'Failed to retrieve nodes', 500);
  }
};

module.exports = {
  getInventory,
  getInventoryOverview,
  getInventoryById,
  incomingShipment,
  outgoingShipment,
  adjustInventory,
  getTransactions,
  getProducts,
  getNodes,
};
