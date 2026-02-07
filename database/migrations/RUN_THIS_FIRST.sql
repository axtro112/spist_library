-- ================================================
-- NOTIFICATION SYSTEM DATABASE MIGRATION
-- Run this in your MySQL client (phpMyAdmin, MySQL Workbench, etc.)
-- ================================================

USE spist_library;

-- ================================================
-- 1. Create notifications table
-- ================================================
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_type ENUM('admin', 'student') NOT NULL COMMENT 'Type of user receiving notification',
  user_id VARCHAR(50) NOT NULL COMMENT 'ID of admin or student',
  title VARCHAR(255) NOT NULL COMMENT 'Notification title',
  message TEXT NOT NULL COMMENT 'Notification message content',
  type ENUM('DUE_SOON', 'OVERDUE', 'BORROW_APPROVED', 'BORROWED', 'RETURNED', 'SYSTEM') NOT NULL COMMENT 'Type of notification',
  related_table VARCHAR(50) DEFAULT NULL COMMENT 'Related table name (e.g., borrowings)',
  related_id INT DEFAULT NULL COMMENT 'Related record ID',
  is_read BOOLEAN DEFAULT FALSE COMMENT 'Whether notification has been read',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When notification was created',
  INDEX idx_user_notifications (user_type, user_id, is_read, created_at),
  INDEX idx_related (related_table, related_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores all user notifications';

-- ================================================
-- 2. Create notification_preferences table
-- ================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_type ENUM('admin', 'student') NOT NULL COMMENT 'Type of user',
  user_id VARCHAR(50) NOT NULL COMMENT 'ID of admin or student',
  enable_in_app BOOLEAN DEFAULT TRUE COMMENT 'Enable in-app notifications',
  enable_realtime BOOLEAN DEFAULT TRUE COMMENT 'Enable real-time push notifications via SSE',
  enable_due_reminders BOOLEAN DEFAULT TRUE COMMENT 'Enable due date reminder notifications',
  enable_overdue_alerts BOOLEAN DEFAULT TRUE COMMENT 'Enable overdue book alert notifications',
  reminder_days_before INT DEFAULT 3 CHECK (reminder_days_before BETWEEN 1 AND 7) COMMENT 'Days before due date to send reminder',
  quiet_hours_start TIME DEFAULT NULL COMMENT 'Start of quiet hours (no notifications)',
  quiet_hours_end TIME DEFAULT NULL COMMENT 'End of quiet hours',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update time',
  PRIMARY KEY (user_type, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='User notification preferences';

-- ================================================
-- 3. Insert default preferences for existing students
-- ================================================
INSERT INTO notification_preferences (user_type, user_id)
SELECT 'student', student_id
FROM students
WHERE NOT EXISTS (
  SELECT 1 FROM notification_preferences 
  WHERE user_type = 'student' AND user_id = students.student_id
);

-- ================================================
-- 4. Insert default preferences for existing admins
-- ================================================
INSERT INTO notification_preferences (user_type, user_id)
SELECT 'admin', CAST(admin_id AS CHAR)
FROM admins
WHERE NOT EXISTS (
  SELECT 1 FROM notification_preferences 
  WHERE user_type = 'admin' AND user_id = CAST(admins.admin_id AS CHAR)
);

-- ================================================
-- 5. Verify tables were created successfully
-- ================================================
SELECT 
  'notifications' as table_name,
  COUNT(*) as record_count 
FROM notifications
UNION ALL
SELECT 
  'notification_preferences' as table_name,
  COUNT(*) as record_count 
FROM notification_preferences;

-- ================================================
-- MIGRATION COMPLETE
-- ================================================
-- Expected output:
--   notifications: 0 records (initially empty)
--   notification_preferences: X records (one per existing user)
-- ================================================
