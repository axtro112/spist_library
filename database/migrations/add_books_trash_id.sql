-- Add trash_id for book-specific trash identity.
-- This allows restore/delete operations to target trashed books via stable UUID token.

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'books'
    AND COLUMN_NAME = 'trash_id'
);

SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `books` ADD COLUMN `trash_id` VARCHAR(36) NULL AFTER `deleted_at`',
  'SELECT ''column trash_id already exists in books'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'books'
    AND INDEX_NAME = 'idx_books_trash_id'
);

SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX `idx_books_trash_id` ON `books` (`trash_id`)',
  'SELECT ''index idx_books_trash_id already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
