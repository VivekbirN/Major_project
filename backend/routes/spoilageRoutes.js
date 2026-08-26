const express = require('express');
const router = express.Router();
const { recordSpoilage, getSpoilageEvents } = require('../controllers/spoilageController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/rbacMiddleware');

router.get('/', authenticate, authorizeRoles('SUPPLY_CHAIN_MANAGER', 'WAREHOUSE_ADMIN', 'VIEWER'), getSpoilageEvents);
router.post('/', authenticate, authorizeRoles('SUPPLY_CHAIN_MANAGER', 'WAREHOUSE_ADMIN'), recordSpoilage);

module.exports = router;
