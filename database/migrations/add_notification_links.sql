-- Add deep linking fields to notifications table
-- Run this migration to enable click-to-navigate functionality

ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS link_type VARCHAR(50) DEFAULT NULL COMMENT 'Type of link: book, borrowing, user, etc.',
ADD COLUMN IF NOT EXISTS link_id VARCHAR(100) DEFAULT NULL COMMENT 'ID of the linked resource',
ADD COLUMN IF NOT EXISTS link_url VARCHAR(255) DEFAULT NULL COMMENT 'Optional: direct URL path';

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notifications_link ON notifications(link_type, link_id);

-- Update existing notifications with link data based on type
UPDATE notifications 
SET link_type = 'borrowing',
    link_id = related_id
WHERE type IN ('DUE_SOON', 'OVERDUE', 'BORROW_APPROVED', 'RETURNED') 
  AND related_table = 'book_borrowings'
  AND link_type IS NULL;

UPDATE notifications 
SET link_type = 'book',
    link_id = related_id
WHERE type IN ('NEW_BOOK', 'BOOK_AVAILABLE', 'BOOK_LOW_STOCK')
  AND related_table = 'books'
  AND link_type IS NULL;

-- Verify the changes
SELECT 'Migration completed successfully' AS status,
       COUNT(*) as total_notifications,
       SUM(CASE WHEN link_type IS NOT NULL THEN 1 ELSE 0 END) as with_links
FROM notifications;
