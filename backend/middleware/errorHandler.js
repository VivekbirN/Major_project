const { sendError } = require('../utils/responseHelper');

/**
 * Centralized error handler middleware.
 * Must be registered last in Express middleware chain.
 */
const errorHandler = (err, req, res, next) => {
  console.error('Unhandled error:', err);

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return sendError(res, messages.join(', '), 400);
  }

  // Mongoose duplicate key (unique constraint)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return sendError(res, `A record with that ${field} already exists`, 409);
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return sendError(res, `Invalid ${err.path}: ${err.value}`, 400);
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
