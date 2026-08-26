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

  const requestedNodeId = parseInt(
    req.params.nodeId || req.query.node_id || node_id
  );

  if (role === 'WAREHOUSE_ADMIN' && node_id !== requestedNodeId) {
    return sendError(res, 'Access denied — you can only access your assigned node', 403);
  }

  next();
};

module.exports = { authorizeRoles, restrictToOwnNode };
