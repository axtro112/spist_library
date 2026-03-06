const adminService = require('../services/admin.service');
const logger = require('../utils/logger');

/**
 * POST /api/admin/admins
 * Create a new admin account (Super Admin only).
 * Protected by: requireSuperAdmin + addAdminLimiter + createAdminRules + validate
 */
async function addAdmin(req, res) {
  try {
    const { fullname, email, password, role } = req.body;
    const admin = await adminService.createAdmin({ fullname, email, password, role });
    return res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      data: admin,
    });
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({
        success: false,
        message: err.message,
      });
    }
    logger.error('Failed to create admin', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      message: 'Failed to create admin. Please try again.',
    });
  }
}

module.exports = { addAdmin };
