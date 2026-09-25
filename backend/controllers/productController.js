const mongoose = require('mongoose');
const { Node, Product, Inventory } = require('../models');
const { sendSuccess, sendError } = require('../utils/responseHelper');

const NEAR_EXPIRY_DAYS = 7;
const OVERSTOCK_MULTIPLIER = 5;

const isValidId = (id) => mongoose.isValidObjectId(id);

/**
 * GET /api/v1/products
 */
const getProducts = async (req, res) => {
  try {
    const { role, node_id } = req.user;
    const { page = 1, limit = 20, category, search, sort = 'name', order = 'ASC' } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (category) where.category = category;
    if (search) {
      where.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
      ];
    }

    const sortDir = order === 'ASC' ? 1 : -1;
    const SORT_MAP = {
      name: { name: sortDir },
      sku: { sku: sortDir },
      unit_cost: { unit_cost: sortDir },
      shelf_life_days: { shelf_life_days: sortDir },
      category: { category: sortDir },
    };
    const sortClause = SORT_MAP[sort] || { name: 1 };

    const [count, rows] = await Promise.all([
      Product.countDocuments(where),
      Product.find(where).sort(sortClause).skip(offset).limit(parseInt(limit)),
    ]);

    // Aggregate inventory stats per product
    const productIds = rows.map(p => p._id);
    const inventoryScope = role !== 'SUPPLY_CHAIN_MANAGER' ? { node_id } : {};

    const invStats = await Inventory.aggregate([
      { $match: { product_id: { $in: productIds }, ...inventoryScope } },
      {
        $group: {
          _id: '$product_id',
          total_stock: { $sum: '$quantity' },
          node_count: { $sum: 1 },
        },
      },
    ]);

    const invMap = {};
    invStats.forEach(s => { invMap[s._id.toString()] = s; });

    const enriched = rows.map(product => {
      const plain = product.toJSON();
      const stats = invMap[plain._id.toString()] || {};
      plain.total_stock = stats.total_stock || 0;
      plain.node_count = stats.node_count || 0;
      plain.total_value = plain.total_stock * (plain.unit_cost || 0);
      return plain;
    });

    // Distinct categories
    const categories = await Product.distinct('category');

    return sendSuccess(res, {
      products: enriched,
      categories: categories.filter(Boolean).sort(),
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
 */
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, node_id } = req.user;

    if (!isValidId(id)) return sendError(res, 'Invalid product ID', 400);

    const product = await Product.findById(id).lean();
    if (!product) return sendError(res, 'Product not found', 404);

    const inventoryScope = role !== 'SUPPLY_CHAIN_MANAGER' ? { node_id } : {};
    const now = new Date();
    const nearExpiry = new Date();
    nearExpiry.setDate(now.getDate() + NEAR_EXPIRY_DAYS);

    const inventory = await Inventory.find({ product_id: id, ...inventoryScope })
      .populate('node_id', 'id name type location capacity')
      .sort({ quantity: -1 });

    const inventoryPlain = inventory.map(item => {
      const plain = item.toJSON();
      plain.node = plain.node_id;
      const days = item.expiry_date
        ? Math.ceil((new Date(item.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
        : null;
      let status = 'HEALTHY';
      if (item.quantity <= 0) status = 'CRITICAL';
      else if (days !== null && days <= NEAR_EXPIRY_DAYS) status = 'NEAR_EXPIRY';
      else if (item.quantity <= item.reorder_threshold) status = 'LOW_STOCK';
      else if (item.quantity > item.reorder_threshold * OVERSTOCK_MULTIPLIER) status = 'OVERSTOCKED';
      return {
        ...plain,
        stock_status: status,
        days_until_expiry: days,
        inventory_value: item.quantity * (product.unit_cost || 0),
      };
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
      product: { ...product, id: product._id.toString() },
      inventory: inventoryPlain,
      summary,
    }, 'Product details retrieved');
  } catch (error) {
    console.error('Get product by id error:', error);
    return sendError(res, 'Failed to retrieve product details', 500);
  }
};

module.exports = { getProducts, getProductById };
