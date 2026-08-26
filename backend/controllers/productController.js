const { Op, fn, col, literal } = require('sequelize');
const { Node, Product, Inventory } = require('../models');
const { sendSuccess, sendError } = require('../utils/responseHelper');

const NEAR_EXPIRY_DAYS = 7;
const OVERSTOCK_MULTIPLIER = 5;

/**
 * GET /api/v1/products
 * Full product list with total stock across nodes
 */
const getProducts = async (req, res) => {
  try {
    const { role, node_id } = req.user;
    const { page = 1, limit = 20, category, search, sort = 'name', order = 'ASC' } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (category) where.category = category;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { sku: { [Op.like]: `%${search}%` } },
      ];
    }

    const SORT_MAP = {
      name: [['name', order]],
      sku: [['sku', order]],
      unit_cost: [['unit_cost', order]],
      shelf_life_days: [['shelf_life_days', order]],
      category: [['category', order]],
    };
    const orderClause = SORT_MAP[sort] || [['name', 'ASC']];

    const { count, rows } = await Product.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: orderClause,
    });

    // For each product, get aggregate inventory stats (scoped by role)
    const productIds = rows.map(p => p.id);
    const inventoryScope = role !== 'SUPPLY_CHAIN_MANAGER' ? { node_id } : {};

    const invStats = await Inventory.findAll({
      where: { product_id: { [Op.in]: productIds }, ...inventoryScope },
      attributes: [
        'product_id',
        [fn('SUM', col('quantity')), 'total_stock'],
        [fn('COUNT', col('id')), 'node_count'],
      ],
      group: ['product_id'],
      raw: true,
    });

    const invMap = {};
    invStats.forEach(s => { invMap[s.product_id] = s; });

    const enriched = rows.map(product => {
      const plain = product.toJSON();
      const stats = invMap[plain.id] || {};
      plain.total_stock = parseInt(stats.total_stock) || 0;
      plain.node_count = parseInt(stats.node_count) || 0;
      plain.total_value = plain.total_stock * parseFloat(plain.unit_cost);
      return plain;
    });

    // Get distinct categories for filter
    const categories = await Product.findAll({ attributes: [[fn('DISTINCT', col('category')), 'category']], raw: true });

    return sendSuccess(res, {
      products: enriched,
      categories: categories.map(c => c.category).filter(Boolean).sort(),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    }, 'Products retrieved');
  } catch (error) {
    console.error('Get products error:', error);
    return sendError(res, 'Failed to retrieve products', 500);
  }
};

/**
 * GET /api/v1/products/:id
 * Product details with node-by-node inventory breakdown
 */
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, node_id } = req.user;

    const product = await Product.findByPk(id, { raw: true });
    if (!product) return sendError(res, 'Product not found', 404);

    const inventoryScope = role !== 'SUPPLY_CHAIN_MANAGER' ? { node_id } : {};

    const today = new Date().toISOString().split('T')[0];
    const nearExpiry = new Date(); nearExpiry.setDate(new Date().getDate() + NEAR_EXPIRY_DAYS);
    const nearExpiryStr = nearExpiry.toISOString().split('T')[0];

    const inventory = await Inventory.findAll({
      where: { product_id: parseInt(id), ...inventoryScope },
      include: [{ model: Node, as: 'node', attributes: ['id', 'name', 'type', 'location', 'capacity'] }],
      order: [['quantity', 'DESC']],
    });

    const inventoryPlain = inventory.map(item => {
      const plain = item.toJSON();
      const days = item.expiry_date ? Math.ceil((new Date(item.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)) : null;
      let status = 'HEALTHY';
      if (item.quantity <= 0) status = 'CRITICAL';
      else if (days !== null && days <= NEAR_EXPIRY_DAYS) status = 'NEAR_EXPIRY';
      else if (item.quantity <= item.reorder_threshold) status = 'LOW_STOCK';
      else if (item.quantity > item.reorder_threshold * OVERSTOCK_MULTIPLIER) status = 'OVERSTOCKED';
      return { ...plain, stock_status: status, days_until_expiry: days, inventory_value: item.quantity * parseFloat(product.unit_cost) };
    });

    const summary = {
      total_stock: inventoryPlain.reduce((s, i) => s + i.quantity, 0),
      total_value: inventoryPlain.reduce((s, i) => s + i.inventory_value, 0),
      node_count: inventoryPlain.length,
      low_stock_nodes: inventoryPlain.filter(i => ['LOW_STOCK', 'CRITICAL'].includes(i.stock_status)).length,
      overstock_nodes: inventoryPlain.filter(i => i.stock_status === 'OVERSTOCKED').length,
      near_expiry_nodes: inventoryPlain.filter(i => i.stock_status === 'NEAR_EXPIRY').length,
    };

    return sendSuccess(res, {
      product,
      inventory: inventoryPlain,
      summary,
    }, 'Product details retrieved');
  } catch (error) {
    console.error('Get product by id error:', error);
    return sendError(res, 'Failed to retrieve product details', 500);
  }
};

module.exports = { getProducts, getProductById };
