const { Op } = require('sequelize');
const { Node, Product, Inventory } = require('../models');
const { sendSuccess, sendError } = require('../utils/responseHelper');

/**
 * GET /api/v1/inventory
 * Returns inventory records. WAREHOUSE_ADMIN sees only their node.
 */
const getInventory = async (req, res) => {
  try {
    const { role, node_id } = req.user;
    const { page = 1, limit = 50, node_id: queryNodeId } = req.query;

    let nodeFilter = {};

    if (role === 'SUPPLY_CHAIN_MANAGER') {
      // Can filter by specific node_id query param, or get all
      if (queryNodeId) nodeFilter.node_id = parseInt(queryNodeId);
    } else if (role === 'WAREHOUSE_ADMIN') {
      nodeFilter.node_id = node_id;
    } else {
      // VIEWER — see all (read-only)
      if (queryNodeId) nodeFilter.node_id = parseInt(queryNodeId);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await Inventory.findAndCountAll({
      where: nodeFilter,
      include: [
        { model: Node, as: 'node', attributes: ['id', 'name', 'type', 'location'] },
        { model: Product, as: 'product', attributes: ['id', 'sku', 'name', 'category', 'shelf_life_days', 'unit_cost'] },
      ],
      limit: parseInt(limit),
      offset,
      order: [['last_updated', 'DESC']],
    });

    return sendSuccess(res, {
      inventory: rows,
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
 * GET /api/v1/products
 */
const getProducts = async (req, res) => {
  try {
    const { page = 1, limit = 50, category } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (category) where.category = category;

    const { count, rows } = await Product.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['name', 'ASC']],
    });

    return sendSuccess(res, {
      products: rows,
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
 * GET /api/v1/nodes
 * SUPPLY_CHAIN_MANAGER sees all. Others see only their own node.
 */
const getNodes = async (req, res) => {
  try {
    const { role, node_id } = req.user;

    let where = {};
    if (role !== 'SUPPLY_CHAIN_MANAGER') {
      where.id = node_id;
    }

    const nodes = await Node.findAll({
      where,
      order: [['name', 'ASC']],
    });

    return sendSuccess(res, { nodes }, 'Nodes retrieved');
  } catch (error) {
    console.error('Get nodes error:', error);
    return sendError(res, 'Failed to retrieve nodes', 500);
  }
};

module.exports = { getInventory, getProducts, getNodes };
