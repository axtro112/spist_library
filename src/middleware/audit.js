/**
 * Audit Logging Middleware
 * Logs all CRUD operations to the audit_logs table for compliance and security tracking
 * 
 * Usage:
 *   const { auditLog } = require('../middleware/audit');
 *   // In route handler:
 *   await auditLog(db, {
 *     tableName: 'students',
 *     action: 'INSERT',       // or UPDATE, DELETE
 *     userId: req.session.user.id,
 *     userType: 'admin',      // or 'student'
 *     ipAddress: req.ip,
 *     oldValues: null,        // for INSERT
 *     newValues: { student_id: 'STU-123', email: 'test@spist.edu.ph' }
 *   });
 */

const logger = require('../utils/logger');

/**
 * Log an audit event to the audit_logs table
 * 
 * @param {Object} db - Database utility object (must have query method)
 * @param {Object} params - Audit parameters
 * @param {string} params.tableName - Table name being modified (required)
 * @param {string} params.action - CRUD action: INSERT, UPDATE, DELETE (required)
 * @param {number|string} params.recordId - ID of the record being modified (required)
 * @param {string} params.userId - ID of user performing action (from req.session.user.id)
 * @param {string} params.userType - Type of user: 'admin' or 'student'
 * @param {string} params.ipAddress - IP address of request (from req.ip)
 * @param {Object|null} params.oldValues - Previous values (null for INSERT, object for UPDATE/DELETE)
 * @param {Object|null} params.newValues - New values (null for DELETE, object for INSERT/UPDATE)
 * @returns {Promise<Object>} { success: true/false, error?: string }
 */
async function auditLog(db, params) {
  try {
    const {
      tableName,
      action,
      recordId,
      userId = null,
      userType = null,
      ipAddress = null,
      oldValues = null,
      newValues = null
    } = params;

    // Validation
    if (!tableName || !action || recordId === undefined) {
      logger.warn('Invalid audit log parameters', { tableName, action, recordId });
      return { success: false, error: 'Missing required audit parameters' };
    }

    if (!['INSERT', 'UPDATE', 'DELETE'].includes(action)) {
      logger.warn('Invalid audit action', { action });
      return { success: false, error: 'Invalid action type' };
    }

    // Insert into audit_logs
    const query = `
      INSERT INTO audit_logs 
      (table_name, record_id, action, user_type, user_id, old_values, new_values, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    const params_array = [
      tableName,
      recordId,
      action,
      userType,
      userId,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ipAddress
    ];

    await db.query(query, params_array);

    logger.debug('Audit log created', {
      tableName,
      action,
      recordId,
      userId,
      userType
    });

    return { success: true };

  } catch (error) {
    logger.error('Failed to create audit log', {
      error: error.message,
      params
    });
    // Don't throw - continue operation even if audit fails
    return { success: false, error: error.message };
  }
}

/**
 * Middleware to capture request context for audit logging
 * Attaches auditLog function to req object for easy access in route handlers
 * 
 * Usage in route:
 *   app.use(auditLogMiddleware());
 *   
 *   Then in handler:
 *   await req.auditLog({ tableName: 'students', action: 'INSERT', ... });
 */
function auditLogMiddleware() {
  return (req, res, next) => {
    // Attach auditLog function to request object
    req.auditLog = async (auditParams) => {
      const db = require('../utils/db');
      return auditLog(db, {
        ...auditParams,
        userId: auditParams.userId || req.session?.user?.id,
        userType: auditParams.userType || req.session?.user?.userType,
        ipAddress: auditParams.ipAddress || req.ip
      });
    };
    next();
  };
}

module.exports = {
  auditLog,
  auditLogMiddleware
};
