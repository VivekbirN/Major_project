const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Node } = require('../models');
const { sendSuccess, sendError } = require('../utils/responseHelper');

/**
 * Generate JWT for a user
 */
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

/**
 * Format user object for API responses (never include password_hash)
 */
const formatUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  node_id: user.node_id,
  node: user.node || null,
  created_at: user.created_at,
});

/**
 * POST /api/v1/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 'Email and password are required', 400);
    }

    // Find user with node info
    const user = await User.findOne({
      where: { email: email.toLowerCase().trim() },
      include: [{ model: Node, as: 'node', attributes: ['id', 'name', 'type', 'location'] }],
    });

    if (!user) {
      return sendError(res, 'Invalid email or password', 401);
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return sendError(res, 'Invalid email or password', 401);
    }

    const token = generateToken(user);

    return sendSuccess(res, {
      token,
      user: formatUser(user),
    }, 'Login successful');
  } catch (error) {
    console.error('Login error:', error);
    return sendError(res, 'Login failed', 500);
  }
};

/**
 * GET /api/v1/auth/me
 * Returns the currently authenticated user
 */
const me = async (req, res) => {
  try {
    return sendSuccess(res, { user: formatUser(req.user) }, 'User retrieved');
  } catch (error) {
    console.error('Me error:', error);
    return sendError(res, 'Failed to retrieve user', 500);
  }
};

module.exports = { login, me };
