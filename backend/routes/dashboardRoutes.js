const express = require('express');
const router = express.Router();
const { getOverview } = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/authMiddleware');

// GET /api/v1/dashboard/overview
router.get('/overview', authenticate, getOverview);

module.exports = router;
