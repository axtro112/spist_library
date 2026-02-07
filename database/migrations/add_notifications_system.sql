-- Migration: Add Notification System
-- Created: 2026-01-10
-- Description: Adds notifications and notification_preferences tables for in-app notifications

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_type ENUM('student', 'admin') NOT NULL COMMENT 'Type of user receiving notification',
  user_id VARCHAR(50) NOT NULL COMMENT 'student_id or admin.id',
  title VARCHAR(150) NOT NULL COMMENT 'Notification title',
  message TEXT NOT NULL COMMENT 'Notification message body',
  type ENUM('DUE_SOON', 'OVERDUE', 'BORROW_APPROVED', 'BORROWED', 'RETURNED', 'SYSTEM') NOT NULL COMMENT 'Notification category',
  related_table VARCHAR(50) NULL COMMENT 'Related table name (e.g., book_borrowings)',
  related_id INT NULL COMMENT 'Related record ID',
  is_read BOOLEAN DEFAULT 0 COMMENT 'Read status',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Creation timestamp',
  INDEX idx_user_notifications (user_type, user_id, is_read, created_at),
  INDEX idx_related (related_table, related_id),
  INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_type ENUM('student', 'admin') NOT NULL COMMENT 'Type of user',
  user_id VARCHAR(50) NOT NULL COMMENT 'student_id or admin.id',
  enable_in_app BOOLEAN DEFAULT 1 COMMENT 'Enable in-app notifications',
  enable_realtime BOOLEAN DEFAULT 1 COMMENT 'Enable real-time SSE notifications',
  enable_due_reminders BOOLEAN DEFAULT 1 COMMENT 'Enable due date reminders',
  enable_overdue_alerts BOOLEAN DEFAULT 1 COMMENT 'Enable overdue alerts',
  reminder_days_before INT DEFAULT 2 COMMENT 'Days before due date to send reminder (1-7)',
  quiet_hours_start TIME NULL COMMENT 'Start of quiet hours (no notifications)',
  quiet_hours_end TIME NULL COMMENT 'End of quiet hours',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_prefs (user_type, user_id),
  CONSTRAINT chk_reminder_days CHECK (reminder_days_before BETWEEN 1 AND 7)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default preferences for existing users
INSERT INTO notification_preferences (user_type, user_id)
SELECT 'student', student_id FROM students
ON DUPLICATE KEY UPDATE user_id = user_id;

INSERT INTO notification_preferences (user_type, user_id)
SELECT 'admin', CAST(id AS CHAR) FROM admins
ON DUPLICATE KEY UPDATE user_id = user_id;

-- Add comments
ALTER TABLE notifications COMMENT = 'Stores in-app notifications for students and admins';
ALTER TABLE notification_preferences COMMENT = 'User preferences for notification delivery';
