const express = require('express');
const router = express.Router();
const { getProducts, getProductById } = require('../controllers/productController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/rbacMiddleware');

const ALL_ROLES = ['SUPPLY_CHAIN_MANAGER', 'WAREHOUSE_ADMIN', 'VIEWER'];

router.get('/', authenticate, authorizeRoles(...ALL_ROLES), getProducts);
router.get('/:id', authenticate, authorizeRoles(...ALL_ROLES), getProductById);

module.exports = router;
