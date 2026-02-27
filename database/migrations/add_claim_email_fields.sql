-- ============================================
-- MIGRATION: Add Claim Expiration & Email Tracking
-- Created: February 23, 2026
-- Purpose: Track 24-hour claim period and email sending status
-- ============================================

-- Add claim_expires_at to book_borrowings (if not exists)
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'book_borrowings' AND COLUMN_NAME = 'claim_expires_at');

SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `book_borrowings` 
   ADD COLUMN `claim_expires_at` DATETIME NULL COMMENT ''Deadline to claim borrowed books (borrowed_date + 24 hours)'' AFTER `due_date`,
   ADD INDEX `idx_claim_expires_at` (`claim_expires_at`)',
  'SELECT ''Column claim_expires_at already exists in book_borrowings'' AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add email_sent_at to book_borrowings (if not exists)
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'book_borrowings' AND COLUMN_NAME = 'email_sent_at');

SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `book_borrowings` 
   ADD COLUMN `email_sent_at` DATETIME NULL COMMENT ''Timestamp when claim email was sent to student'',
   ADD INDEX `idx_email_sent_at` (`email_sent_at`)',
  'SELECT ''Column email_sent_at already exists in book_borrowings'' AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verification query
SELECT 
  TABLE_NAME,
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT,
  COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'book_borrowings'
  AND COLUMN_NAME IN ('claim_expires_at', 'email_sent_at')
ORDER BY COLUMN_NAME;
