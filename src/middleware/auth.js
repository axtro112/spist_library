/**
 * Authentication and Authorization Middleware
 * Provides role-based access control for routes
 */

/**
 * Check if user is authenticated (logged in)
 */
function requireAuth(req, res, next) {
  console.log('[Auth] Checking authentication:', {
    isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : null,
    hasSession: !!req.session,
    hasUser: !!req.session?.user,
    user: req.session?.user
  });

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
  console.log('[Auth] requireAdmin check:', {
    hasSession: !!req.session,
    hasUser: !!req.session?.user,
    userRole: req.session?.user?.userRole,
    role: req.session?.user?.role,
    fullUser: req.session?.user
  });
  
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please log in.",
    });
  }

  const userRole = req.session.user.userRole; // Check userRole first
  
  // Allow admin userRole (covers system_admin, super_admin)
  if (userRole === "admin") {
    console.log('[Auth] Admin access granted for userRole:', userRole);
    return next();
  }

  console.log('[Auth] Admin access DENIED for userRole:', userRole);
  return res.status(403).json({
    success: false,
    message: "Access denied. Admin privileges required.",
  });
}

/**
 * Check if user is a super admin
 */
function requireSuperAdmin(req, res, next) {
  console.log('[Auth] requireSuperAdmin check:', {
    hasSession: !!req.session,
    hasUser: !!req.session?.user,
    userRole: req.session?.user?.userRole,
    role: req.session?.user?.role,
    fullUser: req.session?.user
  });
  
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please log in.",
    });
  }

  // For super admin, check the role field (not userRole)
  // because admins have both userRole="admin" and role="super_admin" or "system_admin"
  const role = req.session.user.role;
  
  if (role === "super_admin") {
    console.log('[Auth] Super admin access granted');
    return next();
  }

  console.log('[Auth] Super admin access DENIED for role:', role);
  return res.status(403).json({
    success: false,
    message: "Access denied. Super admin privileges required.",
  });
}

/**
 * Check if user is a student
 */
function requireStudent(req, res, next) {
  console.log('[Auth] requireStudent check:', {
    hasSession: !!req.session,
    hasUser: !!req.session?.user,
    userRole: req.session?.user?.userRole,
    fullUser: req.session?.user
  });
  
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please log in.",
    });
  }

  const userRole = req.session.user.userRole; // Changed from .role to .userRole
  
  if (userRole === "student") {
    console.log('[Auth] Student access granted');
    return next();
  }

  console.log('[Auth] Student access DENIED for role:', userRole);
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
