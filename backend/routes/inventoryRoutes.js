const express = require('express');
const router = express.Router();
const {
  getInventory,
  getInventoryOverview,
  getInventoryById,
  incomingShipment,
  outgoingShipment,
  adjustInventory,
  getTransactions,
  getProducts,
  getNodes,
} = require('../controllers/inventoryController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/rbacMiddleware');

const ALL_ROLES = ['SUPPLY_CHAIN_MANAGER', 'WAREHOUSE_ADMIN', 'VIEWER'];
const WRITE_ROLES = ['SUPPLY_CHAIN_MANAGER', 'WAREHOUSE_ADMIN'];

// ── Read endpoints ─────────────────────────────────────────────────────────────

// GET /api/v1/inventory/overview — must be before /:id
router.get('/overview', authenticate, authorizeRoles(...ALL_ROLES), getInventoryOverview);

// GET /api/v1/inventory/transactions
router.get('/transactions', authenticate, authorizeRoles(...ALL_ROLES), getTransactions);

// GET /api/v1/inventory/products (backward compat)
router.get('/products', authenticate, authorizeRoles(...ALL_ROLES), getProducts);

// GET /api/v1/inventory/nodes (backward compat)
router.get('/nodes', authenticate, authorizeRoles(...ALL_ROLES), getNodes);

// GET /api/v1/inventory
router.get('/', authenticate, authorizeRoles(...ALL_ROLES), getInventory);

// GET /api/v1/inventory/:id
router.get('/:id', authenticate, authorizeRoles(...ALL_ROLES), getInventoryById);

// ── Write endpoints ─────────────────────────────────────────────────────────────

// POST /api/v1/inventory/incoming
router.post('/incoming', authenticate, authorizeRoles(...WRITE_ROLES), incomingShipment);

// POST /api/v1/inventory/outgoing
router.post('/outgoing', authenticate, authorizeRoles(...WRITE_ROLES), outgoingShipment);

// PATCH /api/v1/inventory/:id
router.patch('/:id', authenticate, authorizeRoles(...WRITE_ROLES), adjustInventory);

module.exports = router;
