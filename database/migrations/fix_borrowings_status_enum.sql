-- ============================================
-- FIX: book_borrowings status ENUM
-- Adds 'pending_pickup' and 'expired' to the status ENUM
-- Preserves existing 'pending' and 'approved' values to avoid data truncation
-- ============================================

ALTER TABLE `book_borrowings`
  MODIFY COLUMN `status` ENUM(
    'pending',
    'approved',
    'pending_pickup',
    'borrowed',
    'returned',
    'overdue',
    'cancelled',
    'expired'
  ) NOT NULL DEFAULT 'pending_pickup';

-- Add QR columns if not already present
ALTER TABLE `book_borrowings`
  ADD COLUMN `qr_token` VARCHAR(512) NULL UNIQUE COMMENT 'Secure JWT token for QR-based pickup' AFTER `email_sent_at`;

ALTER TABLE `book_borrowings`
  ADD COLUMN `qr_generated_at` DATETIME DEFAULT NULL COMMENT 'Timestamp when QR token was generated' AFTER `qr_token`;

ALTER TABLE `book_borrowings`
  ADD COLUMN `qr_scanned_at` DATETIME DEFAULT NULL COMMENT 'Timestamp when QR was scanned during pickup' AFTER `qr_generated_at`;

-- Add claim_expires_at if not present
ALTER TABLE `book_borrowings`
  ADD COLUMN `claim_expires_at` DATETIME DEFAULT NULL COMMENT 'Deadline for student to pick up the book' AFTER `due_date`;

-- Index for efficient expiry checks
CREATE INDEX `idx_pending_claim_expiry` ON `book_borrowings` (`status`, `claim_expires_at`);
