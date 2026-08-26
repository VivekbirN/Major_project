const express = require('express');
const router = express.Router();
const { getInventory, getProducts, getNodes } = require('../controllers/inventoryController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/rbacMiddleware');

// All inventory routes require authentication
// All three roles can read inventory

// GET /api/v1/inventory
router.get(
  '/',
  authenticate,
  authorizeRoles('SUPPLY_CHAIN_MANAGER', 'WAREHOUSE_ADMIN', 'VIEWER'),
  getInventory
);

// GET /api/v1/products
router.get(
  '/products',
  authenticate,
  authorizeRoles('SUPPLY_CHAIN_MANAGER', 'WAREHOUSE_ADMIN', 'VIEWER'),
  getProducts
);

// GET /api/v1/nodes
router.get(
  '/nodes',
  authenticate,
  authorizeRoles('SUPPLY_CHAIN_MANAGER', 'WAREHOUSE_ADMIN', 'VIEWER'),
  getNodes
);

module.exports = router;
