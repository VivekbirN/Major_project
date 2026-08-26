const { Op, fn, col, literal } = require('sequelize');
const { sequelize, Node, Product, Inventory, InventoryTransaction, SpoilageEvent } = require('../models');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// ── Constants ─────────────────────────────────────────────────────────────────
const NEAR_EXPIRY_DAYS = 7;
const OVERSTOCK_MULTIPLIER = 5;

// ── Helpers ───────────────────────────────────────────────────────────────────

const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
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

const productInclude = { model: Product, as: 'product', attributes: ['id', 'sku', 'name', 'category', 'shelf_life_days', 'unit_cost'] };
const nodeInclude    = { model: Node,    as: 'node',    attributes: ['id', 'name', 'type', 'location', 'capacity'] };

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * GET /api/v1/inventory/overview
 */
const getInventoryOverview = async (req, res) => {
  try {
    const { role, node_id } = req.user;
    const scope = buildNodeScope(role, node_id);
    const today = new Date().toISOString().split('T')[0];
    const nearExpiry = new Date();
    nearExpiry.setDate(new Date().getDate() + NEAR_EXPIRY_DAYS);
    const nearExpiryStr = nearExpiry.toISOString().split('T')[0];

    const [totalUnits, lowStock, nearExpiryCount, overstock, valueResult] = await Promise.all([
      Inventory.findOne({ where: scope, attributes: [[fn('SUM', col('quantity')), 'total']], raw: true }),
      Inventory.count({ where: { ...scope, quantity: { [Op.lte]: col('reorder_threshold') } } }),
      Inventory.count({ where: { ...scope, expiry_date: { [Op.between]: [today, nearExpiryStr] }, quantity: { [Op.gt]: 0 } } }),
      Inventory.count({ where: { ...scope, quantity: { [Op.gt]: literal(`reorder_threshold * ${OVERSTOCK_MULTIPLIER}`) } } }),
      Inventory.findOne({
        where: scope,
        attributes: [[literal('SUM(quantity * (SELECT unit_cost FROM products WHERE products.id = inventory.product_id))'), 'total_value']],
        raw: true,
      }),
    ]);

    return sendSuccess(res, {
      total_units: parseInt(totalUnits?.total) || 0,
      low_stock_count: lowStock,
      near_expiry_count: nearExpiryCount,
      overstock_count: overstock,
      total_value: parseFloat(valueResult?.total_value) || 0,
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

    // Base node scope
    let whereInventory = buildNodeScope(role, node_id);
    if (role === 'SUPPLY_CHAIN_MANAGER' && qNode) whereInventory.node_id = parseInt(qNode);
    if (qProduct) whereInventory.product_id = parseInt(qProduct);

    // Status filtering via SQL expressions
    const today = new Date().toISOString().split('T')[0];
    const nearExpiryDate = new Date();
    nearExpiryDate.setDate(new Date().getDate() + NEAR_EXPIRY_DAYS);
    const nearExpiryStr = nearExpiryDate.toISOString().split('T')[0];

    if (qStatus === 'LOW_STOCK') {
      whereInventory[Op.and] = [literal('quantity <= reorder_threshold'), { quantity: { [Op.gt]: 0 } }];
    } else if (qStatus === 'OVERSTOCKED') {
      whereInventory[Op.and] = [literal(`quantity > reorder_threshold * ${OVERSTOCK_MULTIPLIER}`)];
    } else if (qStatus === 'NEAR_EXPIRY') {
      whereInventory.expiry_date = { [Op.between]: [today, nearExpiryStr] };
      whereInventory.quantity = { [Op.gt]: 0 };
    } else if (qStatus === 'CRITICAL') {
      whereInventory.quantity = 0;
    }

    // Product-level filters (category, search)
    const productWhere = {};
    if (qCategory) productWhere.category = qCategory;
    if (qSearch) {
      productWhere[Op.or] = [
        { name: { [Op.like]: `%${qSearch}%` } },
        { sku: { [Op.like]: `%${qSearch}%` } },
      ];
    }

    // Determine sort column
    const SORT_MAP = {
      quantity: [['quantity', order]],
      expiry_date: [['expiry_date', order]],
      last_updated: [['last_updated', order]],
      product_name: [[{ model: Product, as: 'product' }, 'name', order]],
      node_name: [[{ model: Node, as: 'node' }, 'name', order]],
    };
    const orderClause = SORT_MAP[sort] || [['last_updated', 'DESC']];

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await Inventory.findAndCountAll({
      where: whereInventory,
      include: [
        { ...nodeInclude },
        { ...productInclude, where: Object.keys(productWhere).length ? productWhere : undefined },
      ],
      limit: parseInt(limit),
      offset,
      order: orderClause,
      distinct: true,
    });

    // Annotate rows with calculated stock status and inventory value
    const annotated = rows.map(item => {
      const plain = item.toJSON();
      plain.stock_status = calcStockStatus(plain);
      plain.days_until_expiry = daysUntil(plain.expiry_date);
      plain.inventory_value = plain.quantity * parseFloat(plain.product?.unit_cost || 0);
      return plain;
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

    const item = await Inventory.findByPk(id, {
      include: [nodeInclude, productInclude],
    });

    if (!item) return sendError(res, 'Inventory record not found', 404);

    // RBAC: warehouse admin can only see their node
    if (role === 'WAREHOUSE_ADMIN' && item.node_id !== node_id) {
      return sendError(res, 'Access denied — not your node', 403);
    }

    // Recent transactions for this inventory item
    const transactions = await InventoryTransaction.findAll({
      where: { inventory_id: id },
      include: [{ model: require('../models/User'), as: 'user', attributes: ['id', 'name', 'role'] }],
      order: [['created_at', 'DESC']],
      limit: 20,
    });

    const plain = item.toJSON();
    plain.stock_status = calcStockStatus(plain);
    plain.days_until_expiry = daysUntil(plain.expiry_date);
    plain.inventory_value = plain.quantity * parseFloat(plain.product?.unit_cost || 0);

    return sendSuccess(res, { inventory: plain, transactions }, 'Inventory record retrieved');
  } catch (error) {
    console.error('Get inventory by id error:', error);
    return sendError(res, 'Failed to retrieve inventory record', 500);
  }
};

/**
 * POST /api/v1/inventory/incoming
 * Add stock (find-or-create inventory record)
 */
const incomingShipment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { role, node_id: userNodeId, id: userId } = req.user;
    const { node_id, product_id, quantity, reason, reference, expiry_date } = req.body;

    // Validate required fields
    if (!node_id || !product_id || !quantity) {
      await t.rollback();
      return sendError(res, 'node_id, product_id, and quantity are required', 400);
    }
    if (parseInt(quantity) <= 0) {
      await t.rollback();
      return sendError(res, 'Quantity must be greater than zero', 400);
    }

    // RBAC check
    const targetNode = parseInt(node_id);
    if (role === 'WAREHOUSE_ADMIN' && userNodeId !== targetNode) {
      await t.rollback();
      return sendError(res, 'Access denied — you can only modify your assigned node', 403);
    }

    // Ensure node and product exist
    const [node, product] = await Promise.all([
      Node.findByPk(targetNode, { transaction: t }),
      Product.findByPk(parseInt(product_id), { transaction: t }),
    ]);
    if (!node) { await t.rollback(); return sendError(res, 'Node not found', 404); }
    if (!product) { await t.rollback(); return sendError(res, 'Product not found', 404); }

    // Find or create inventory record
    let [inv, created] = await Inventory.findOrCreate({
      where: { node_id: targetNode, product_id: parseInt(product_id) },
      defaults: {
        quantity: 0,
        reorder_threshold: 50,
        expiry_date: expiry_date || null,
        last_updated: new Date(),
      },
      transaction: t,
    });

    const qtyBefore = inv.quantity;
    const qtyAfter = qtyBefore + parseInt(quantity);

    // Update inventory
    await inv.update({
      quantity: qtyAfter,
      last_updated: new Date(),
      ...(expiry_date && { expiry_date }),
    }, { transaction: t });

    // Record transaction
    await InventoryTransaction.create({
      inventory_id: inv.id,
      node_id: targetNode,
      product_id: parseInt(product_id),
      user_id: userId,
      transaction_type: 'INCOMING',
      quantity_change: parseInt(quantity),
      quantity_before: qtyBefore,
      quantity_after: qtyAfter,
      reason: reason || 'Incoming shipment',
      reference: reference || null,
    }, { transaction: t });

    await t.commit();

    // Reload with associations
    await inv.reload({ include: [nodeInclude, productInclude] });
    const plain = inv.toJSON();
    plain.stock_status = calcStockStatus(plain);
    plain.inventory_value = plain.quantity * parseFloat(plain.product?.unit_cost || 0);

    return sendSuccess(res, { inventory: plain, created }, 'Incoming shipment recorded', 201);
  } catch (error) {
    await t.rollback();
    console.error('Incoming shipment error:', error);
    return sendError(res, 'Failed to record incoming shipment', 500);
  }
};

/**
 * POST /api/v1/inventory/outgoing
 * Remove stock — prevents negative inventory
 */
const outgoingShipment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { role, node_id: userNodeId, id: userId } = req.user;
    const { node_id, product_id, quantity, reason, reference } = req.body;

    if (!node_id || !product_id || !quantity) {
      await t.rollback();
      return sendError(res, 'node_id, product_id, and quantity are required', 400);
    }
    if (parseInt(quantity) <= 0) {
      await t.rollback();
      return sendError(res, 'Quantity must be greater than zero', 400);
    }

    const targetNode = parseInt(node_id);
    if (role === 'WAREHOUSE_ADMIN' && userNodeId !== targetNode) {
      await t.rollback();
      return sendError(res, 'Access denied — you can only modify your assigned node', 403);
    }

    const inv = await Inventory.findOne({
      where: { node_id: targetNode, product_id: parseInt(product_id) },
      transaction: t,
    });

    if (!inv) {
      await t.rollback();
      return sendError(res, 'No inventory found for this product at this node', 404);
    }

    const qtyBefore = inv.quantity;
    const qtyAfter = qtyBefore - parseInt(quantity);

    if (qtyAfter < 0) {
      await t.rollback();
      return sendError(res, `Insufficient stock. Available: ${qtyBefore}, Requested: ${quantity}`, 400);
    }

    await inv.update({ quantity: qtyAfter, last_updated: new Date() }, { transaction: t });

    await InventoryTransaction.create({
      inventory_id: inv.id,
      node_id: targetNode,
      product_id: parseInt(product_id),
      user_id: userId,
      transaction_type: 'OUTGOING',
      quantity_change: -parseInt(quantity),
      quantity_before: qtyBefore,
      quantity_after: qtyAfter,
      reason: reason || 'Outgoing shipment',
      reference: reference || null,
    }, { transaction: t });

    await t.commit();

    await inv.reload({ include: [nodeInclude, productInclude] });
    const plain = inv.toJSON();
    plain.stock_status = calcStockStatus(plain);
    plain.inventory_value = plain.quantity * parseFloat(plain.product?.unit_cost || 0);

    return sendSuccess(res, { inventory: plain }, 'Outgoing shipment recorded');
  } catch (error) {
    await t.rollback();
    console.error('Outgoing shipment error:', error);
    return sendError(res, 'Failed to record outgoing shipment', 500);
  }
};

/**
 * PATCH /api/v1/inventory/:id
 * Direct quantity adjustment
 */
const adjustInventory = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { role, node_id: userNodeId, id: userId } = req.user;
    const { quantity, reorder_threshold, expiry_date, reason } = req.body;

    const inv = await Inventory.findByPk(id, {
      include: [nodeInclude, productInclude],
      transaction: t,
    });

    if (!inv) {
      await t.rollback();
      return sendError(res, 'Inventory record not found', 404);
    }

    if (role === 'WAREHOUSE_ADMIN' && inv.node_id !== userNodeId) {
      await t.rollback();
      return sendError(res, 'Access denied — not your node', 403);
    }

    if (quantity !== undefined && parseInt(quantity) < 0) {
      await t.rollback();
      return sendError(res, 'Quantity cannot be negative', 400);
    }

    const qtyBefore = inv.quantity;
    const newQty = quantity !== undefined ? parseInt(quantity) : qtyBefore;
    const qtyChange = newQty - qtyBefore;

    await inv.update({
      ...(quantity !== undefined && { quantity: newQty }),
      ...(reorder_threshold !== undefined && { reorder_threshold: parseInt(reorder_threshold) }),
      ...(expiry_date !== undefined && { expiry_date }),
      last_updated: new Date(),
    }, { transaction: t });

    if (qtyChange !== 0) {
      await InventoryTransaction.create({
        inventory_id: inv.id,
        node_id: inv.node_id,
        product_id: inv.product_id,
        user_id: userId,
        transaction_type: 'ADJUSTMENT',
        quantity_change: qtyChange,
        quantity_before: qtyBefore,
        quantity_after: newQty,
        reason: reason || 'Manual adjustment',
      }, { transaction: t });
    }

    await t.commit();
    await inv.reload({ include: [nodeInclude, productInclude] });
    const plain = inv.toJSON();
    plain.stock_status = calcStockStatus(plain);
    plain.inventory_value = plain.quantity * parseFloat(plain.product?.unit_cost || 0);

    return sendSuccess(res, { inventory: plain }, 'Inventory adjusted');
  } catch (error) {
    await t.rollback();
    console.error('Adjust inventory error:', error);
    return sendError(res, 'Failed to adjust inventory', 500);
  }
};

/**
 * GET /api/v1/inventory/transactions
 * Activity history — scoped by role
 */
const getTransactions = async (req, res) => {
  try {
    const { role, node_id } = req.user;
    const { page = 1, limit = 20, node_id: qNode, inventory_id: qInv } = req.query;

    const where = {};
    if (role === 'WAREHOUSE_ADMIN') where.node_id = node_id;
    else if (qNode) where.node_id = parseInt(qNode);
    if (qInv) where.inventory_id = parseInt(qInv);

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await InventoryTransaction.findAndCountAll({
      where,
      include: [
        { model: Node, as: 'node', attributes: ['id', 'name'] },
        { model: Product, as: 'product', attributes: ['id', 'sku', 'name', 'category'] },
        { model: require('../models/User'), as: 'user', attributes: ['id', 'name', 'role'] },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

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
 * GET /api/v1/products  (basic — kept for backward compat)
 */
const getProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (category) where.category = category;
    if (search) where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }, { sku: { [Op.like]: `%${search}%` } }];

    const { count, rows } = await Product.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['name', 'ASC']],
    });

    return sendSuccess(res, {
      products: rows,
      pagination: { total: count, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(count / parseInt(limit)) },
    }, 'Products retrieved');
  } catch (error) {
    return sendError(res, 'Failed to retrieve products', 500);
  }
};

/**
 * GET /api/v1/inventory/nodes  (basic — kept for backward compat)
 */
const getNodes = async (req, res) => {
  try {
    const { role, node_id } = req.user;
    const where = role !== 'SUPPLY_CHAIN_MANAGER' ? { id: node_id } : {};
    const nodes = await Node.findAll({ where, order: [['name', 'ASC']] });
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
