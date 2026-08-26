const express = require('express');
const router = express.Router();
const {
  getMLHealth,
  getDemandForecast,
  getSpoilagePrediction,
  detectAnomaly,
} = require('../controllers/mlController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/rbacMiddleware');

const ALL_ROLES = ['SUPPLY_CHAIN_MANAGER', 'WAREHOUSE_ADMIN', 'VIEWER'];
const WRITE_ROLES = ['SUPPLY_CHAIN_MANAGER', 'WAREHOUSE_ADMIN'];

// GET /api/v1/ml/health
router.get('/health', authenticate, authorizeRoles(...ALL_ROLES), getMLHealth);

// POST /api/v1/ml/demand
router.post('/demand', authenticate, authorizeRoles(...ALL_ROLES), getDemandForecast);

// POST /api/v1/ml/spoilage
router.post('/spoilage', authenticate, authorizeRoles(...ALL_ROLES), getSpoilagePrediction);

// POST /api/v1/ml/anomaly
router.post('/anomaly', authenticate, authorizeRoles(...ALL_ROLES), detectAnomaly);

module.exports = router;
