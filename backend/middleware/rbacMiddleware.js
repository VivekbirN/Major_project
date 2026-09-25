const { sendError } = require('../utils/responseHelper');

/**
 * Middleware factory for role-based access control.
 * Usage: authorizeRoles('SUPPLY_CHAIN_MANAGER', 'WAREHOUSE_ADMIN')
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Unauthorized — not authenticated', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(
        res,
        `Access denied — requires one of: ${allowedRoles.join(', ')}`,
        403
      );
    }

    next();
  };
};

/**
 * Restrict WAREHOUSE_ADMIN to their own node only.
 * Supply Chain Managers bypass this restriction.
 * The requesting node_id should be in req.params.nodeId or req.query.node_id.
 */
const restrictToOwnNode = (req, res, next) => {
  const { role, node_id } = req.user;

  if (role === 'SUPPLY_CHAIN_MANAGER') {
    return next(); // Full access
  }

  // Compare as strings (MongoDB ObjectIds)
  const requestedNodeId = (req.params.nodeId || req.query.node_id || '').toString();
  const userNodeId = (node_id || '').toString();

  if (role === 'WAREHOUSE_ADMIN' && requestedNodeId && userNodeId !== requestedNodeId) {
    return sendError(res, 'Access denied — you can only access your assigned node', 403);
  }

  next();
};

module.exports = { authorizeRoles, restrictToOwnNode };
