const express = require('express');
const router = express.Router();
const { login, register, googleAuth, me } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

// POST /api/v1/auth/login
router.post('/login', login);

// POST /api/v1/auth/register
router.post('/register', register);

// POST /api/v1/auth/google
router.post('/google', googleAuth);

// GET /api/v1/auth/me  (protected)
router.get('/me', authenticate, me);

module.exports = router;
