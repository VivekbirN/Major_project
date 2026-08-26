const express = require('express');
const router = express.Router();
const { login, me } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

// POST /api/v1/auth/login
router.post('/login', login);

// GET /api/v1/auth/me  (protected)
router.get('/me', authenticate, me);

module.exports = router;
