/**
 * Authentication and Authorization Middleware
 * Provides role-based access control for routes
 */

/**
 * Check if user is authenticated (logged in)
 */
function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  
  if (req.session && req.session.user) {
    return next();
  }

  return res.status(401).json({
    success: false,
    message: "Authentication required. Please log in.",
  });
}

/**
 * Check if user is an admin (admin or super_admin)
 */
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please log in.",
    });
  }

  const userRole = req.session.user.role;
  
  if (userRole === "admin" || userRole === "super_admin") {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Access denied. Admin privileges required.",
  });
}

/**
 * Check if user is a super admin
 */
function requireSuperAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please log in.",
    });
  }

  const userRole = req.session.user.role;
  
  if (userRole === "super_admin") {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Access denied. Super admin privileges required.",
  });
}

/**
 * Check if user is a student
 */
function requireStudent(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please log in.",
    });
  }

  const userRole = req.session.user.role;
  
  if (userRole === "student") {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Access denied. Student account required.",
  });
}

/**
 * Check if user can access their own resource or is an admin
 * Use for routes like /api/students/:id where students can only access their own data
 */
function requireOwnerOrAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please log in.",
    });
  }

  const userRole = req.session.user.role;
  const userId = req.session.user.id;
  const resourceId = req.params.id;

  // Admins can access any resource
  if (userRole === "admin" || userRole === "super_admin") {
    return next();
  }

  // Users can only access their own resources
  if (userId === parseInt(resourceId)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Access denied. You can only access your own data.",
  });
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireSuperAdmin,
  requireStudent,
  requireOwnerOrAdmin,
};
