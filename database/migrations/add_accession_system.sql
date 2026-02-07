-- ============================================
-- ACCESSION NUMBER SYSTEM MIGRATION
-- Date: 2026-01-26
-- Purpose: Implement individual book copy tracking
-- ============================================

-- Step 1: Create book_copies table
CREATE TABLE IF NOT EXISTS book_copies (
  id INT PRIMARY KEY AUTO_INCREMENT,
  accession_number VARCHAR(20) UNIQUE NOT NULL,
  book_id INT NOT NULL,
  copy_number INT NOT NULL,
  condition_status ENUM('excellent', 'good', 'fair', 'poor', 'damaged', 'lost') DEFAULT 'good',
  location VARCHAR(100) DEFAULT 'Main Library',
  acquisition_date DATE DEFAULT (CURRENT_DATE),
  last_checked DATE,
  notes TEXT,
  status ENUM('available', 'borrowed', 'maintenance', 'lost', 'retired') DEFAULT 'available',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  INDEX idx_accession (accession_number),
  INDEX idx_book_id (book_id),
  INDEX idx_status (status),
  
  CONSTRAINT unique_book_copy UNIQUE (book_id, copy_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 2: Add accession_number to book_borrowings (if not exists)
SET @column_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'book_borrowings' 
  AND COLUMN_NAME = 'accession_number'
);

SET @sql_add_accession = IF(@column_exists = 0,
  'ALTER TABLE book_borrowings ADD COLUMN accession_number VARCHAR(20) AFTER book_id',
  'SELECT "Column accession_number already exists" AS message'
);
PREPARE stmt FROM @sql_add_accession;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql_add_borrow_condition = IF(@column_exists = 0,
  'ALTER TABLE book_borrowings ADD COLUMN copy_condition_at_borrow ENUM("excellent", "good", "fair", "poor", "damaged") AFTER accession_number',
  'SELECT "Skipping copy_condition_at_borrow" AS message'
);
PREPARE stmt FROM @sql_add_borrow_condition;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql_add_return_condition = IF(@column_exists = 0,
  'ALTER TABLE book_borrowings ADD COLUMN copy_condition_at_return ENUM("excellent", "good", "fair", "poor", "damaged") AFTER copy_condition_at_borrow',
  'SELECT "Skipping copy_condition_at_return" AS message'
);
PREPARE stmt FROM @sql_add_return_condition;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 3: Add foreign key constraint (after we populate data)
-- ALTER TABLE book_borrowings 
--   ADD FOREIGN KEY (accession_number) REFERENCES book_copies(accession_number) ON DELETE SET NULL;

-- Step 4: Create table for accession sequence tracking
CREATE TABLE IF NOT EXISTS accession_sequence (
  year INT PRIMARY KEY,
  last_sequence INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Initialize for current year
INSERT INTO accession_sequence (year, last_sequence) 
VALUES (YEAR(CURRENT_DATE), 0)
ON DUPLICATE KEY UPDATE last_sequence = last_sequence;

-- Step 6: Create audit log for accession changes
CREATE TABLE IF NOT EXISTS book_copy_audit (
  id INT PRIMARY KEY AUTO_INCREMENT,
  accession_number VARCHAR(20) NOT NULL,
  action ENUM('created', 'borrowed', 'returned', 'condition_changed', 'location_changed', 'lost', 'found', 'retired') NOT NULL,
  old_value TEXT,
  new_value TEXT,
  performed_by INT,
  performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  
  INDEX idx_accession (accession_number),
  INDEX idx_action (action),
  INDEX idx_date (performed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check table creation
SELECT 
  'book_copies' as table_name, 
  COUNT(*) as row_count 
FROM book_copies
UNION ALL
SELECT 
  'accession_sequence' as table_name, 
  COUNT(*) as row_count 
FROM accession_sequence;

-- Display sample structure
DESCRIBE book_copies;
DESCRIBE book_borrowings;
