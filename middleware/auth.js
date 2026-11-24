const { validateSession } = require('../db/database');

function authenticateToken(req, res, next) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'].trim();
  }

  if (!token) {
    req.user = null;
    return next();
  }

  const user = validateSession(token);
  req.user = user || null;
  req.token = token;
  next();
}

function requireAuth(req, res, next) {
  authenticateToken(req, res, () => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in to continue.'
      });
    }
    next();
  });
}

function requireRole(...roles) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: `Forbidden. Action requires one of: ${roles.join(', ')}.`
        });
      }
      next();
    });
  };
}

module.exports = {
  authenticateToken,
  requireAuth,
  requireRole
};
