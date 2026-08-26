const jwt = require('jsonwebtoken');
const { User, Node } = require('../models');
const { sendError } = require('../utils/responseHelper');

/**
 * Verify JWT token and attach the authenticated user to req.user
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'No authentication token provided', 401);
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return sendError(res, 'Authentication token has expired', 401);
      }
      return sendError(res, 'Invalid authentication token', 401);
    }

    // Fetch user from DB (ensures user still exists and gets fresh data)
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password_hash'] },
      include: [{ model: Node, as: 'node', attributes: ['id', 'name', 'type', 'location'] }],
    });

    if (!user) {
      return sendError(res, 'User not found', 401);
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return sendError(res, 'Authentication failed', 500);
  }
};

module.exports = { authenticate };
