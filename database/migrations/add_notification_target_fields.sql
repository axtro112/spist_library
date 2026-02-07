-- Migration: Add Target User Fields to Notifications
-- Created: 2026-01-21
-- Description: Adds target_type and target_id fields to store which student/user the notification is about

ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS target_type VARCHAR(20) DEFAULT NULL COMMENT 'Type of target entity: student, user, admin',
ADD COLUMN IF NOT EXISTS target_id VARCHAR(100) DEFAULT NULL COMMENT 'ID of the target (student_id for students, admin id for admins)',
ADD COLUMN IF NOT EXISTS book_id INT DEFAULT NULL COMMENT 'Associated book ID for book-related notifications',
ADD COLUMN IF NOT EXISTS book_title VARCHAR(255) DEFAULT NULL COMMENT 'Book title for quick reference',
ADD COLUMN IF NOT EXISTS borrowing_id INT DEFAULT NULL COMMENT 'Associated borrowing ID',
ADD COLUMN IF NOT EXISTS due_date DATE DEFAULT NULL COMMENT 'Due date for borrowing notifications',
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT NULL COMMENT 'Status info (e.g., overdue, pending)';

-- Add index for target lookups
CREATE INDEX IF NOT EXISTS idx_notifications_target ON notifications(target_type, target_id);

-- Update existing notifications to set target_type and target_id based on user_type and user_id
-- For notifications sent TO students, the target IS the student
UPDATE notifications 
SET target_type = 'student', target_id = user_id 
WHERE user_type = 'student' AND target_type IS NULL;

-- For notifications sent TO admins, we need to look up the related borrowing to find the student
UPDATE notifications n
INNER JOIN book_borrowings bb ON n.related_table = 'book_borrowings' AND n.related_id = bb.id
SET n.target_type = 'student', 
    n.target_id = bb.student_id,
    n.borrowing_id = bb.id,
    n.book_id = bb.book_id,
    n.due_date = bb.due_date,
    n.status = bb.status
WHERE n.user_type = 'admin' AND n.target_type IS NULL AND n.related_table = 'book_borrowings';

-- Add book title to existing notifications
UPDATE notifications n
INNER JOIN books b ON n.book_id = b.id
SET n.book_title = b.title
WHERE n.book_id IS NOT NULL AND n.book_title IS NULL;

-- Add comment
ALTER TABLE notifications COMMENT = 'Stores in-app notifications with target user tracking for admin workflows';

