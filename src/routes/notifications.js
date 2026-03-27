const express = require("express");
const router = express.Router();
const db = require("../utils/db");
const response = require("../utils/response");
const logger = require("../utils/logger");
const { requireAuth } = require("../middleware/auth");

// SSE connections map: key = "userType:userId", value = response object
const sseConnections = new Map();

/**
 * Helper function to get consistent user context from session
 * Handles both old and new session structures
 * @param {Object} req - Express request object
 * @returns {Object} - {userType, userId} or {userType: null, userId: null}
 */
function getUserContext(req) {
  try {
    const userRole = req.session.user?.userRole || req.session.userRole;
    const userType = userRole === 'admin' ? 'admin' : userRole === 'student' ? 'student' : null;
    
    let userId = null;
    
    if (req.session.user) {
      // New session structure (preferred)
      userId = userType === 'admin' 
        ? String(req.session.user.id)  // admin ID from admins table
        : req.session.user.studentId;   // student_id (e.g., c22-4090-01)
    } else {
      // Old session structure (fallback)
      userId = userType === 'admin' 
        ? String(req.session.adminId) 
        : req.session.studentId;
    }
    
    logger.debug('[getUserContext]', { userType, userId, sessionUser: req.session.user, sessionAdminId: req.session.adminId, sessionStudentId: req.session.studentId });
    
    return { userType, userId };
  } catch (error) {
    logger.error('[getUserContext] Error:', error);
    return { userType: null, userId: null };
  }
}

/**
 * Helper function to create a notification
 * @param {Object} params - Notification parameters
 * @returns {Promise<number>} - Created notification ID
 */
async function createNotification({
  user_type,
  user_id,
  title,
  message,
  type,
  related_table = null,
  related_id = null,
  link_type = null,
  link_id = null,
  link_url = null,
  target_type = null,
  target_id = null,
  book_id = null,
  book_title = null,
  borrowing_id = null,
  due_date = null,
  status = null
}) {
  try {
    let enableInApp = true;
    let enableRealtime = true;

    // Auto-determine link fields from related fields if not provided
    if (!link_type && related_table && related_id) {
      if (related_table === 'book_borrowings') {
        link_type = 'borrowing';
        link_id = String(related_id);
      } else if (related_table === 'books') {
        link_type = 'book';
        link_id = String(related_id);
      }
    }
    
    // Check if user should receive notifications (preferences)
    const prefQuery = `
      SELECT enable_in_app, enable_realtime, quiet_hours_start, quiet_hours_end
      FROM notification_preferences
      WHERE user_type = ? AND user_id = ?
    `;
    const prefs = await db.query(prefQuery, [user_type, user_id]);
    
    // Create default preferences if none exist
    if (prefs.length === 0) {
      await db.query(
        `INSERT INTO notification_preferences (user_type, user_id) VALUES (?, ?)`,
        [user_type, user_id]
      );
    } else {
      enableInApp = !!prefs[0].enable_in_app;
      enableRealtime = !!prefs[0].enable_realtime;
    }

    if (!enableInApp) {
      logger.debug('Notifications disabled for user', { user_type, user_id });
      return null;
    }

    // Check quiet hours
    if (prefs.length > 0 && prefs[0].quiet_hours_start && prefs[0].quiet_hours_end) {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
      const quietStart = prefs[0].quiet_hours_start.slice(0, 5);
      const quietEnd = prefs[0].quiet_hours_end.slice(0, 5);
      
      if (currentTime >= quietStart && currentTime <= quietEnd) {
        logger.debug('Within quiet hours, notification queued', { user_type, user_id });
        // In production, queue for later delivery
      }
    }

    // Insert notification
    const insertQuery = `
      INSERT INTO notifications 
      (user_type, user_id, title, message, type, related_table, related_id, link_type, link_id, link_url,
       target_type, target_id, book_id, book_title, borrowing_id, due_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await db.query(insertQuery, [
      user_type,
      user_id,
      title,
      message,
      type,
      related_table,
      related_id,
      link_type,
      link_id,
      link_url,
      target_type,
      target_id,
      book_id,
      book_title,
      borrowing_id,
      due_date,
      status
    ]);

    const notificationId = result.insertId;
    logger.info('Notification created', { notificationId, user_type, user_id, type });

    // Send real-time notification via SSE if enabled
    if (enableRealtime) {
      const connectionKey = `${user_type}:${user_id}`;
      const sseClient = sseConnections.get(connectionKey);
      
      if (sseClient) {
        const notification = {
          id: notificationId,
          title,
          message,
          type,
          created_at: new Date().toISOString(),
          is_read: false
        };
        
        sseClient.write(`data: ${JSON.stringify(notification)}\n\n`);
        logger.debug('SSE notification sent', { connectionKey });
      }
    }

    return notificationId;
  } catch (error) {
    logger.error('Error creating notification', { error: error.message });
    throw error;
  }
}

/**
 * Check for duplicate notification within same day
 */
async function isDuplicateNotification(user_type, user_id, type, related_table, related_id) {
  const query = `
    SELECT COUNT(*) as count
    FROM notifications
    WHERE user_type COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
      AND user_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
      AND type COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
      AND related_table COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
      AND related_id COLLATE utf8mb4_unicode_ci = CAST(? AS CHAR) COLLATE utf8mb4_unicode_ci
      AND DATE(created_at) = CURDATE()
  `;
  
  const result = await db.query(query, [user_type, user_id, type, related_table, related_id]);
  return result[0].count > 0;
}

// GET /api/notifications - List notifications for current user
router.get("/", requireAuth, async (req, res) => {
  try {
    const { unread, limit = 20 } = req.query;
    const { userType, userId } = getUserContext(req);

    logger.info('[NOTIF LIST] Request:', { unread, limit, userType, userId });

    if (!userId || !userType) {
      logger.warn('[NOTIF LIST] No valid user context - returning empty array');
      return response.success(res, []);
    }

    let query = `
      SELECT n.id, n.title, n.message, n.type, n.related_table, n.related_id,
             n.is_read, n.created_at, n.link_type, n.link_id, n.link_url,
             n.target_type, n.target_id, n.book_id,
             COALESCE(b.title, n.book_title) AS book_title,
             n.borrowing_id, n.due_date, n.status
      FROM notifications n
      LEFT JOIN books b ON n.book_id = b.id
      WHERE n.user_type = ? AND n.user_id = ?
    `;
    const params = [userType, userId];

    if (unread === '1') {
      query += ` AND is_read = 0`;
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(parseInt(limit));

    const notifications = await db.query(query, params);
    
    // Normalize deep_link fields for frontend compatibility
    const normalizedNotifications = notifications.map(n => {
      // Default: use link_type and link_id if present
      let deep_link_type = n.link_type || n.target_type;
      let deep_link_id = n.link_id || n.target_id;

      // For OVERDUE/DUE_SOON: prefer borrowing_id if available, otherwise use target_id (student)
      if (n.type === 'OVERDUE' || n.type === 'DUE_SOON') {
        deep_link_type = n.borrowing_id ? 'borrowing' : 'student';
        deep_link_id = n.borrowing_id || n.target_id;
      }

      return {
        ...n,
        deep_link_type,
        deep_link_id
      };
    });
    
    logger.info('[NOTIF LIST] Found:', normalizedNotifications.length, 'notifications');
    if (normalizedNotifications.length > 0) {
      logger.info('[NOTIF LIST] Sample:', { 
        id: normalizedNotifications[0].id, 
        title: normalizedNotifications[0].title,
        type: normalizedNotifications[0].type,
        deep_link_type: normalizedNotifications[0].deep_link_type,
        deep_link_id: normalizedNotifications[0].deep_link_id,
        borrowing_id: normalizedNotifications[0].borrowing_id,
        target_id: normalizedNotifications[0].target_id
      });
    }
    
    // Get unread count for this user
    const unreadQuery = `SELECT COUNT(*) as count FROM notifications WHERE user_type = ? AND user_id = ? AND is_read = 0`;
    const unreadResult = await db.query(unreadQuery, [userType, userId]);
    const unreadCount = unreadResult[0]?.count || 0;
    
    // Return consistent format: {success, notifications, unreadCount}
    res.status(200).json({
      success: true,
      notifications: Array.isArray(normalizedNotifications) ? normalizedNotifications : [],
      unreadCount: unreadCount
    });
  } catch (error) {
    logger.error('[NOTIF LIST] Error:', error.message);
    // Return consistent format even on error
    res.status(200).json({
      success: true,
      notifications: [],
      unreadCount: 0,
      message: 'Notifications temporarily unavailable'
    });
  }
});

// GET /api/notifications/unread-count - Get unread count
router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const { userType, userId } = getUserContext(req);

    logger.info('[UNREAD COUNT] Request:', { userType, userId });

    if (!userId || !userType) {
      logger.warn('[UNREAD COUNT] No valid user context - returning 0');
      return response.success(res, { count: 0 });
    }

    const query = `
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_type = ? AND user_id = ? AND is_read = 0
    `;
    
    logger.info('[UNREAD COUNT] Executing query with params:', [userType, userId]);
    
    const result = await db.query(query, [userType, userId]);
    const count = result[0]?.count || 0;
    
    logger.info('[UNREAD COUNT] Query result:', result);
    logger.info('[UNREAD COUNT] Final count:', count);
    
    response.success(res, { count });
  } catch (error) {
    logger.error('[UNREAD COUNT] Error:', error.message);
    // Return gracefully with 0 count instead of error
    response.success(res, { count: 0 });
  }
});

// PUT /api/notifications/:id/read - Mark notification as read
router.put("/:id/read", requireAuth, async (req, res) => {
  try {
    const notificationId = req.params.id;
    
    // Handle both session structures
    const userRole = req.session.user?.userRole || req.session.userRole;
    const userType = userRole === 'admin' ? 'admin' : 'student';
    
    let userId;
    if (req.session.user) {
      // New session structure
      userId = userType === 'admin' 
        ? String(req.session.user.id) 
        : req.session.user.studentId;
    } else {
      // Old session structure
      userId = userType === 'admin' 
        ? String(req.session.adminId) 
        : req.session.studentId;
    }

    const query = `
      UPDATE notifications
      SET is_read = 1
      WHERE id = ? AND user_type = ? AND user_id = ?
    `;
    
    const result = await db.query(query, [notificationId, userType, userId]);
    
    if (result.affectedRows === 0) {
      return response.notFound(res, 'Notification not found');
    }

    response.success(res, null, 'Notification marked as read');
  } catch (error) {
    logger.error('Error marking notification as read', { error: error.message });
    response.error(res, 'Failed to mark notification as read', error);
  }
});

// PUT /api/notifications/read-all - Mark all notifications as read
router.put("/read-all", requireAuth, async (req, res) => {
  try {
    // Handle both session structures
    const userRole = req.session.user?.userRole || req.session.userRole;
    const userType = userRole === 'admin' ? 'admin' : 'student';
    
    let userId;
    if (req.session.user) {
      // New session structure
      userId = userType === 'admin' 
        ? String(req.session.user.id) 
        : req.session.user.studentId;
    } else {
      // Old session structure
      userId = userType === 'admin' 
        ? String(req.session.adminId) 
        : req.session.studentId;
    }

    const query = `
      UPDATE notifications
      SET is_read = 1
      WHERE user_type = ? AND user_id = ? AND is_read = 0
    `;
    
    const result = await db.query(query, [userType, userId]);
    
    response.success(res, { updated: result.affectedRows }, 'All notifications marked as read');
  } catch (error) {
    logger.error('Error marking all notifications as read', { error: error.message });
    response.error(res, 'Failed to mark all notifications as read', error);
  }
});

// GET /api/notifications/preferences - Get user preferences
router.get("/preferences", requireAuth, async (req, res) => {
  try {
    // Handle both session structures
    const userRole = req.session.user?.userRole || req.session.userRole;
    const userType = userRole === 'admin' ? 'admin' : 'student';
    
    let userId;
    if (req.session.user) {
      // New session structure
      userId = userType === 'admin' 
        ? String(req.session.user.id) 
        : req.session.user.studentId;
    } else {
      // Old session structure
      userId = userType === 'admin' 
        ? String(req.session.adminId) 
        : req.session.studentId;
    }

    if (!userId) {
      logger.warn('No userId found in session for preferences');
      // Return default preferences
      return response.success(res, {
        enable_in_app: true,
        enable_realtime: true,
        enable_due_reminders: true,
        enable_overdue_alerts: true,
        reminder_days_before: 2,
        quiet_hours_start: null,
        quiet_hours_end: null
      });
    }

    const query = `
      SELECT enable_in_app, enable_realtime, enable_due_reminders,
             enable_overdue_alerts, reminder_days_before,
             quiet_hours_start, quiet_hours_end
      FROM notification_preferences
      WHERE user_type = ? AND user_id = ?
    `;
    
    let prefs = await db.query(query, [userType, userId]);
    
    // Create default if doesn't exist
    if (prefs.length === 0) {
      await db.query(
        `INSERT INTO notification_preferences (user_type, user_id) VALUES (?, ?)`,
        [userType, userId]
      );
      prefs = await db.query(query, [userType, userId]);
    }

    response.success(res, prefs[0]);
  } catch (error) {
    logger.error('Error fetching preferences', { error: error.message, stack: error.stack });
    response.error(res, 'Failed to fetch preferences', error);
  }
});

// PUT /api/notifications/preferences - Update user preferences
router.put("/preferences", requireAuth, async (req, res) => {
  try {
    // Handle both session structures
    const userRole = req.session.user?.userRole || req.session.userRole;
    const userType = userRole === 'admin' ? 'admin' : 'student';
    
    let userId;
    if (req.session.user) {
      // New session structure
      userId = userType === 'admin' 
        ? String(req.session.user.id) 
        : req.session.user.studentId;
    } else {
      // Old session structure
      userId = userType === 'admin' 
        ? String(req.session.adminId) 
        : req.session.studentId;
    }

    if (!userId) {
      return response.error(res, 'User ID not found in session', null, 400);
    }

    const {
      enable_in_app,
      enable_realtime,
      enable_due_reminders,
      enable_overdue_alerts,
      reminder_days_before,
      quiet_hours_start,
      quiet_hours_end
    } = req.body;

    // Validate reminder_days_before
    if (reminder_days_before && (reminder_days_before < 1 || reminder_days_before > 7)) {
      return response.validationError(res, 'reminder_days_before must be between 1 and 7');
    }

    const query = `
      INSERT INTO notification_preferences 
      (user_type, user_id, enable_in_app, enable_realtime, enable_due_reminders,
       enable_overdue_alerts, reminder_days_before, quiet_hours_start, quiet_hours_end)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        enable_in_app = VALUES(enable_in_app),
        enable_realtime = VALUES(enable_realtime),
        enable_due_reminders = VALUES(enable_due_reminders),
        enable_overdue_alerts = VALUES(enable_overdue_alerts),
        reminder_days_before = VALUES(reminder_days_before),
        quiet_hours_start = VALUES(quiet_hours_start),
        quiet_hours_end = VALUES(quiet_hours_end)
    `;
    
    await db.query(query, [
      userType,
      userId,
      enable_in_app ?? true,
      enable_realtime ?? true,
      enable_due_reminders ?? true,
      enable_overdue_alerts ?? true,
      reminder_days_before ?? 2,
      quiet_hours_start || null,
      quiet_hours_end || null
    ]);

    response.success(res, null, 'Preferences updated successfully');
  } catch (error) {
    logger.error('Error updating preferences', { error: error.message });
    response.error(res, 'Failed to update preferences', error);
  }
});

// GET /api/notifications/stream - SSE stream for real-time notifications
router.get("/stream", requireAuth, async (req, res) => {
  // Handle both session structures
  const userRole = req.session.user?.userRole || req.session.userRole;
  const userType = userRole === 'admin' ? 'admin' : 'student';
  
  let userId;
  if (req.session.user) {
    userId = userType === 'admin' 
      ? String(req.session.user.id) 
      : req.session.user.studentId;
  } else {
    userId = userType === 'admin' 
      ? String(req.session.adminId) 
      : req.session.studentId;
  }
  
  const connectionKey = `${userType}:${userId}`;

  // Set SSE headers - omit Connection header (not valid in HTTP/2)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx/Railway buffering
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders(); // Flush headers immediately to establish the stream

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE connection established' })}\n\n`);

  // Store connection
  sseConnections.set(connectionKey, res);
  logger.info('SSE connection established', { connectionKey });

  // Send keepalive every 15 seconds (more frequent to prevent Railway timeout)
  const keepaliveInterval = setInterval(() => {
    try {
      res.write(`: keepalive\n\n`);
    } catch (e) {
      clearInterval(keepaliveInterval);
    }
  }, 15000);

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(keepaliveInterval);
    sseConnections.delete(connectionKey);
    logger.info('SSE connection closed', { connectionKey });
  });

  req.on('error', () => {
    clearInterval(keepaliveInterval);
    sseConnections.delete(connectionKey);
  });
});

// Export helper functions
module.exports = router;
module.exports.createNotification = createNotification;
module.exports.isDuplicateNotification = isDuplicateNotification;
