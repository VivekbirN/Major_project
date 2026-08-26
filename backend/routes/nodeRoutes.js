const express = require('express');
const router = express.Router();
const { getNodes, getNodeById } = require('../controllers/nodeController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/rbacMiddleware');

const ALL_ROLES = ['SUPPLY_CHAIN_MANAGER', 'WAREHOUSE_ADMIN', 'VIEWER'];

router.get('/', authenticate, authorizeRoles(...ALL_ROLES), getNodes);
router.get('/:id', authenticate, authorizeRoles(...ALL_ROLES), getNodeById);

module.exports = router;
