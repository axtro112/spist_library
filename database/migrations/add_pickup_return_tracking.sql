-- Migration: Add Pickup and Return Tracking to book_borrowings
-- Purpose: Enable admins to confirm pickup and return of borrowed books
-- Created: 2026-02-25
-- Author: System Migration

-- ==================================================================
-- STEP 1: Add picked_up_at column (if not exists)
-- ==================================================================
SET @dbname = DATABASE();
SET @tablename = 'book_borrowings';
SET @columnname = 'picked_up_at';
SET @preparedStatement = (
  SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname
       AND TABLE_NAME = @tablename
       AND COLUMN_NAME = @columnname) > 0,
    'SELECT ''Column picked_up_at already exists'' AS message',
    'ALTER TABLE `book_borrowings` 
     ADD COLUMN `picked_up_at` DATETIME NULL 
     COMMENT ''Timestamp when book was physically handed to student''
     AFTER `claim_expires_at`'
  )
);
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ==================================================================
-- STEP 2: Add picked_up_by_admin_id column (if not exists)
-- ==================================================================
SET @columnname = 'picked_up_by_admin_id';
SET @preparedStatement = (
  SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname
       AND TABLE_NAME = @tablename
       AND COLUMN_NAME = @columnname) > 0,
    'SELECT ''Column picked_up_by_admin_id already exists'' AS message',
    'ALTER TABLE `book_borrowings` 
     ADD COLUMN `picked_up_by_admin_id` INT(11) NULL 
     COMMENT ''Admin ID who confirmed the pickup''
     AFTER `picked_up_at`,
     ADD INDEX `idx_picked_up_by_admin` (`picked_up_by_admin_id`)'
  )
);
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ==================================================================
-- STEP 3: Add returned_by_admin_id column (if not exists)
-- ==================================================================
SET @columnname = 'returned_by_admin_id';
SET @preparedStatement = (
  SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname
       AND TABLE_NAME = @tablename
       AND COLUMN_NAME = @columnname) > 0,
    'SELECT ''Column returned_by_admin_id already exists'' AS message',
    'ALTER TABLE `book_borrowings` 
     ADD COLUMN `returned_by_admin_id` INT(11) NULL 
     COMMENT ''Admin ID who confirmed the return''
     AFTER `return_date`,
     ADD INDEX `idx_returned_by_admin` (`returned_by_admin_id`)'
  )
);
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ==================================================================
-- STEP 4: Add foreign key constraints (if not exist)
-- ==================================================================

-- FK for picked_up_by_admin_id
SET @fkname = 'fk_borrowings_picked_up_by_admin';
SET @preparedStatement = (
  SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = @dbname
       AND TABLE_NAME = @tablename
       AND CONSTRAINT_NAME = @fkname
       AND CONSTRAINT_TYPE = 'FOREIGN KEY') > 0,
    'SELECT ''FK fk_borrowings_picked_up_by_admin already exists'' AS message',
    'ALTER TABLE `book_borrowings` 
     ADD CONSTRAINT `fk_borrowings_picked_up_by_admin` 
     FOREIGN KEY (`picked_up_by_admin_id`) REFERENCES `admins`(`id`) 
     ON DELETE SET NULL ON UPDATE CASCADE'
  )
);
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- FK for returned_by_admin_id
SET @fkname = 'fk_borrowings_returned_by_admin';
SET @preparedStatement = (
  SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = @dbname
       AND TABLE_NAME = @tablename
       AND CONSTRAINT_NAME = @fkname
       AND CONSTRAINT_TYPE = 'FOREIGN KEY') > 0,
    'SELECT ''FK fk_borrowings_returned_by_admin already exists'' AS message',
    'ALTER TABLE `book_borrowings` 
     ADD CONSTRAINT `fk_borrowings_returned_by_admin` 
     FOREIGN KEY (`returned_by_admin_id`) REFERENCES `admins`(`id`) 
     ON DELETE SET NULL ON UPDATE CASCADE'
  )
);
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ==================================================================
-- VERIFICATION
-- ==================================================================
SELECT 
  'Migration completed. Check structure below:' AS message;

DESCRIBE book_borrowings;

-- Display newly added columns
SELECT 
  COLUMN_NAME, 
  COLUMN_TYPE, 
  IS_NULLABLE, 
  COLUMN_DEFAULT, 
  COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'book_borrowings'
  AND COLUMN_NAME IN ('picked_up_at', 'picked_up_by_admin_id', 'returned_by_admin_id');
