const { sendError } = require('../utils/responseHelper');

/**
 * Centralized error handler middleware.
 * Must be registered last in Express middleware chain.
 */
const errorHandler = (err, req, res, next) => {
  console.error('Unhandled error:', err);

  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    const messages = err.errors.map((e) => e.message);
    return sendError(res, messages.join(', '), 400);
  }

  // Sequelize unique constraint
  if (err.name === 'SequelizeUniqueConstraintError') {
    return sendError(res, 'A record with that value already exists', 409);
  }

  // Sequelize foreign key constraint
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return sendError(res, 'Referenced record does not exist', 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid token', 401);
  }
  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Token expired', 401);
  }

  // Default
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';
  return sendError(res, message, statusCode);
};

module.exports = { errorHandler };
