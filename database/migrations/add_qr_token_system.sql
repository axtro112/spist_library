-- ============================================
-- QR TOKEN SYSTEM MIGRATION
-- Purpose: Add secure QR token for contactless pickup
-- ============================================

-- Add qr_token column to book_borrowings (if not exists)
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'book_borrowings' AND COLUMN_NAME = 'qr_token');

SET @sql := IF(@col_exists = 0, 
  'ALTER TABLE `book_borrowings` 
   ADD COLUMN `qr_token` VARCHAR(512) NULL UNIQUE COMMENT ''Secure JWT token for QR-based pickup (replaces email QR codes)'' AFTER `email_sent_at`,
   ADD COLUMN `qr_generated_at` DATETIME DEFAULT NULL COMMENT ''Timestamp when QR token was generated'' AFTER `qr_token`,
   ADD COLUMN `qr_scanned_at` DATETIME DEFAULT NULL COMMENT ''Timestamp when QR was scanned during pickup'' AFTER `qr_generated_at`,
   ADD INDEX `idx_qr_token` (`qr_token`),
   ADD INDEX `idx_qr_generated` (`qr_generated_at`)',
  'SELECT ''QR token columns already exist in book_borrowings'' AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update status enum to include new pickup-related statuses (if not exists)
-- Note: ALTER ENUM is done via schema replacement to avoid duplicate values
-- We check if the status column contains all needed values before proceeding
SET @has_pending_pickup := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'book_borrowings' 
  AND COLUMN_NAME = 'status' AND COLUMN_TYPE LIKE '%pending_pickup%');

SET @sql := IF(@has_pending_pickup = 0,
  'ALTER TABLE `book_borrowings` 
   MODIFY COLUMN `status` ENUM(''pending_pickup'', ''borrowed'', ''returned'', ''overdue'', ''cancelled'', ''expired'') DEFAULT ''pending_pickup''',
  'SELECT ''Status enum already has pending_pickup and expired statuses'' AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create index for finding pending pickup claims nearing expiration
SET @idx_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'book_borrowings' AND INDEX_NAME = 'idx_pending_claim_expiry');

SET @sql := IF(@idx_exists = 0,
  'CREATE INDEX `idx_pending_claim_expiry` ON `book_borrowings` (`status`, `claim_expires_at`)',
  'SELECT ''Index idx_pending_claim_expiry already exists'' AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
