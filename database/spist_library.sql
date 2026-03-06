-- ============================================
-- SPIST LIBRARY MANAGEMENT SYSTEM
-- MASTER DATABASE SCHEMA & MIGRATIONS
-- Version: 3.0 Master (Idempotent)
-- Date: February 2, 2026
-- ============================================
--
-- IMPORTANT: SAFE TO RUN ON EXISTING DATABASE
-- This file combines all migrations and is fully idempotent.
-- It will NOT break existing data or routes.
--
-- WHAT THIS FILE DOES:
-- - Creates all tables if they don't exist
-- - Adds new columns only if they don't exist
-- - Adds indexes only if they don't exist
-- - Preserves all existing data
-- - Optionally seeds sample data at the end
--
-- ============================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

-- ============================================
-- 00 PRECONDITIONS
-- ============================================

-- Verify we're using MySQL (this schema is MySQL-specific)
SELECT VERSION() AS 'MySQL Version';

-- Show current database
SELECT DATABASE() AS 'Target Database';

-- ============================================
-- 01 BASE SCHEMA - CORE TABLES
-- ============================================

-- --------------------------------------------
-- Table: admins
-- Purpose: Store administrator accounts and credentials
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS `admins` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `fullname` varchar(255) NOT NULL COMMENT 'Administrator full name',
  `email` varchar(255) NOT NULL COMMENT 'Unique email address for login',
  `password` varchar(255) NULL COMMENT 'Bcrypt hashed password (null for Google-only accounts)',
  `role` enum('super_admin','system_admin') DEFAULT 'system_admin' COMMENT 'Admin privilege level',
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Account status',
  `resetToken` varchar(255) DEFAULT NULL COMMENT 'Password reset token',
  `resetTokenExpiry` datetime DEFAULT NULL COMMENT 'Token expiration time',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'Account creation timestamp',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last modification timestamp',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Administrator accounts';

-- --------------------------------------------
-- Table: students
-- Purpose: Store student accounts and profile information
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS `students` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `student_id` varchar(20) NOT NULL COMMENT 'Unique student identifier (e.g., STD-2023-001)',
  `fullname` varchar(100) NOT NULL COMMENT 'Student full name',
  `email` varchar(100) NOT NULL COMMENT 'Unique email address for login',
  `password` varchar(255) NULL COMMENT 'Bcrypt hashed password (null for Google-only accounts)',
  `department` varchar(50) NOT NULL COMMENT 'Academic department (e.g., BSCS, BSIT)',
  `year_level` varchar(20) NOT NULL COMMENT 'Current year level (e.g., 1st Year, 2nd Year)',
  `student_type` ENUM('undergraduate', 'graduate', 'transferee') NOT NULL DEFAULT 'undergraduate' COMMENT 'Student classification',
  `contact_number` varchar(20) DEFAULT NULL COMMENT 'Phone number for notifications',
  `resetToken` varchar(255) DEFAULT NULL COMMENT 'Password reset token',
  `resetTokenExpiry` datetime DEFAULT NULL COMMENT 'Token expiration time',
  `status` ENUM('active', 'inactive', 'suspended', 'graduated') NOT NULL DEFAULT 'active' COMMENT 'Account status',
  `created_at` datetime DEFAULT current_timestamp() COMMENT 'Account creation timestamp',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last modification timestamp',
  PRIMARY KEY (`id`),
  UNIQUE KEY `student_id` (`student_id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_department` (`department`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Student accounts and profiles';

-- --------------------------------------------
-- Table: books
-- Purpose: Store library book inventory
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS `books` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL COMMENT 'Book title',
  `author` varchar(100) DEFAULT NULL COMMENT 'Author name(s)',
  `isbn` varchar(20) DEFAULT NULL COMMENT 'International Standard Book Number (unique)',
  `category` varchar(50) DEFAULT NULL COMMENT 'Book category/genre',
  `added_date` datetime DEFAULT current_timestamp() COMMENT 'Date added to library',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last modification timestamp',
  `status` ENUM('available', 'borrowed', 'maintenance') DEFAULT 'available' COMMENT 'Book status',
  `added_by` INT DEFAULT NULL COMMENT 'Admin ID who added the book',
  `quantity` int(11) DEFAULT 1 COMMENT 'Total copies in library',
  `available_quantity` INT NOT NULL DEFAULT 1 COMMENT 'Currently available copies',
  PRIMARY KEY (`id`),
  UNIQUE KEY `isbn` (`isbn`),
  KEY `idx_category` (`category`),
  KEY `idx_title` (`title`),
  KEY `idx_status` (`status`),
  KEY `idx_added_by` (`added_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Book inventory';

-- --------------------------------------------
-- Table: book_borrowings
-- Purpose: Track book borrowing transactions
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS `book_borrowings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `book_id` int(11) NOT NULL COMMENT 'Reference to books table',
  `student_id` varchar(20) NOT NULL COMMENT 'Reference to students table',
  `approved_by` INT DEFAULT NULL COMMENT 'Admin who approved the borrowing',
  `borrow_date` datetime DEFAULT current_timestamp() COMMENT 'Date book was borrowed',
  `due_date` datetime NOT NULL COMMENT 'Date book should be returned',
  `return_date` datetime DEFAULT NULL COMMENT 'Actual return date (NULL if not returned)',
  `status` ENUM('pending', 'approved', 'borrowed', 'returned', 'overdue', 'cancelled') DEFAULT 'borrowed' COMMENT 'Borrowing status',
  `notes` TEXT DEFAULT NULL COMMENT 'Additional notes or remarks',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last modification timestamp',
  PRIMARY KEY (`id`),
  KEY `idx_student_id` (`student_id`),
  KEY `idx_book_id` (`book_id`),
  KEY `idx_status` (`status`),
  KEY `idx_student_status` (`student_id`, `status`),
  KEY `idx_borrow_date` (`borrow_date`),
  KEY `idx_due_date` (`due_date`),
  KEY `idx_approved_by` (`approved_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Book borrowing transactions';

-- --------------------------------------------
-- Table: audit_logs
-- Purpose: Track all database changes for security and compliance
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `table_name` VARCHAR(50) NOT NULL COMMENT 'Name of affected table',
  `record_id` INT NOT NULL COMMENT 'ID of affected record',
  `action` ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL COMMENT 'Type of operation',
  `user_type` ENUM('admin', 'student') NOT NULL COMMENT 'Type of user who made change',
  `user_id` VARCHAR(50) NOT NULL COMMENT 'ID of user who made change',
  `old_values` JSON DEFAULT NULL COMMENT 'Previous values before change',
  `new_values` JSON DEFAULT NULL COMMENT 'New values after change',
  `ip_address` VARCHAR(45) DEFAULT NULL COMMENT 'IP address of user',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'When action occurred',
  
  INDEX `idx_table_record` (`table_name`, `record_id`),
  INDEX `idx_user` (`user_type`, `user_id`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Audit trail for all database changes';

-- ============================================
-- 02 GOOGLE AUTHENTICATION ENHANCEMENT
-- ============================================

-- Add google_id to students (if not exists)
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND COLUMN_NAME = 'google_id');

SET @sql := IF(@col_exists = 0, 
  'ALTER TABLE `students` ADD COLUMN `google_id` VARCHAR(255) NULL UNIQUE COMMENT ''Google OAuth user ID'' AFTER `student_id`, ADD INDEX `idx_google_id` (`google_id`)',
  'SELECT ''Column google_id already exists in students'' AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add google_id to admins (if not exists)
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admins' AND COLUMN_NAME = 'google_id');

SET @sql := IF(@col_exists = 0, 
  'ALTER TABLE `admins` ADD COLUMN `google_id` VARCHAR(255) NULL UNIQUE COMMENT ''Google OAuth user ID'' AFTER `id`, ADD INDEX `idx_google_id_admins` (`google_id`)',
  'SELECT ''Column google_id already exists in admins'' AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- 03 NOTIFICATION SYSTEM
-- ============================================

-- --------------------------------------------
-- Table: notifications
-- Purpose: Store in-app notifications for users
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_type` ENUM('student', 'admin') NOT NULL COMMENT 'Type of user receiving notification',
  `user_id` VARCHAR(50) NOT NULL COMMENT 'student_id or admin.id',
  `title` VARCHAR(150) NOT NULL COMMENT 'Notification title',
  `message` TEXT NOT NULL COMMENT 'Notification message body',
  `type` ENUM('DUE_SOON', 'OVERDUE', 'BORROW_APPROVED', 'BORROWED', 'RETURNED', 'SYSTEM', 'NEW_BOOK', 'BOOK_AVAILABLE', 'BOOK_LOW_STOCK') NOT NULL COMMENT 'Notification category',
  `related_table` VARCHAR(50) NULL COMMENT 'Related table name (e.g., book_borrowings)',
  `related_id` INT NULL COMMENT 'Related record ID',
  `is_read` BOOLEAN DEFAULT 0 COMMENT 'Read status',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Creation timestamp',
  INDEX `idx_user_notifications` (`user_type`, `user_id`, `is_read`, `created_at`),
  INDEX `idx_related` (`related_table`, `related_id`),
  INDEX `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='In-app notifications for students and admins';

-- Add notification link fields (if not exist)
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'link_type');

SET @sql := IF(@col_exists = 0, 
  'ALTER TABLE `notifications` 
   ADD COLUMN `link_type` VARCHAR(50) DEFAULT NULL COMMENT ''Type of link: book, borrowing, user, etc.'',
   ADD COLUMN `link_id` VARCHAR(100) DEFAULT NULL COMMENT ''ID of the linked resource'',
   ADD COLUMN `link_url` VARCHAR(255) DEFAULT NULL COMMENT ''Optional: direct URL path'',
   ADD INDEX `idx_notifications_link` (`link_type`, `link_id`)',
  'SELECT ''Notification link columns already exist'' AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add notification target fields (if not exist)
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'target_type');

SET @sql := IF(@col_exists = 0, 
  'ALTER TABLE `notifications` 
   ADD COLUMN `target_type` VARCHAR(20) DEFAULT NULL COMMENT ''Type of target entity: student, user, admin'',
   ADD COLUMN `target_id` VARCHAR(100) DEFAULT NULL COMMENT ''ID of the target (student_id for students, admin id for admins)'',
   ADD COLUMN `book_id` INT DEFAULT NULL COMMENT ''Associated book ID for book-related notifications'',
   ADD COLUMN `book_title` VARCHAR(255) DEFAULT NULL COMMENT ''Book title for quick reference'',
   ADD COLUMN `borrowing_id` INT DEFAULT NULL COMMENT ''Associated borrowing ID'',
   ADD COLUMN `due_date` DATE DEFAULT NULL COMMENT ''Due date for borrowing notifications'',
   ADD COLUMN `status` VARCHAR(50) DEFAULT NULL COMMENT ''Status info (e.g., overdue, pending)'',
   ADD INDEX `idx_notifications_target` (`target_type`, `target_id`)',
  'SELECT ''Notification target columns already exist'' AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- --------------------------------------------
-- Table: notification_preferences
-- Purpose: User preferences for notifications
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS `notification_preferences` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_type` ENUM('student', 'admin') NOT NULL COMMENT 'Type of user',
  `user_id` VARCHAR(50) NOT NULL COMMENT 'student_id or admin.id',
  `enable_in_app` BOOLEAN DEFAULT 1 COMMENT 'Enable in-app notifications',
  `enable_realtime` BOOLEAN DEFAULT 1 COMMENT 'Enable real-time SSE notifications',
  `enable_due_reminders` BOOLEAN DEFAULT 1 COMMENT 'Enable due date reminders',
  `enable_overdue_alerts` BOOLEAN DEFAULT 1 COMMENT 'Enable overdue alerts',
  `reminder_days_before` INT DEFAULT 2 COMMENT 'Days before due date to send reminder (1-7)',
  `quiet_hours_start` TIME NULL COMMENT 'Start of quiet hours (no notifications)',
  `quiet_hours_end` TIME NULL COMMENT 'End of quiet hours',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_user_prefs` (`user_type`, `user_id`),
  CONSTRAINT `chk_reminder_days` CHECK (`reminder_days_before` BETWEEN 1 AND 7)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='User preferences for notification delivery';

-- ============================================
-- 04 ACCESSION NUMBER SYSTEM
-- ============================================

-- --------------------------------------------
-- Table: book_copies
-- Purpose: Track individual book copies with accession numbers
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS `book_copies` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `accession_number` VARCHAR(20) UNIQUE NOT NULL,
  `book_id` INT NOT NULL,
  `copy_number` INT NOT NULL,
  `condition_status` ENUM('excellent', 'good', 'fair', 'poor', 'damaged', 'lost') DEFAULT 'good',
  `location` VARCHAR(100) DEFAULT 'Main Library',
  `acquisition_date` DATE DEFAULT (CURRENT_DATE),
  `last_checked` DATE,
  `notes` TEXT,
  `status` ENUM('available', 'borrowed', 'maintenance', 'lost', 'retired') DEFAULT 'available',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX `idx_accession` (`accession_number`),
  INDEX `idx_book_id` (`book_id`),
  INDEX `idx_status` (`status`),
  
  CONSTRAINT `unique_book_copy` UNIQUE (`book_id`, `copy_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Individual book copy tracking with accession numbers';

-- Add accession fields to book_borrowings (if not exist)
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'book_borrowings' AND COLUMN_NAME = 'accession_number');

SET @sql := IF(@col_exists = 0, 
  'ALTER TABLE `book_borrowings` 
   ADD COLUMN `accession_number` VARCHAR(20) AFTER `book_id`,
   ADD COLUMN `copy_condition_at_borrow` ENUM(''excellent'', ''good'', ''fair'', ''poor'', ''damaged'') AFTER `accession_number`,
   ADD COLUMN `copy_condition_at_return` ENUM(''excellent'', ''good'', ''fair'', ''poor'', ''damaged'') AFTER `copy_condition_at_borrow`',
  'SELECT ''Accession columns already exist in book_borrowings'' AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- --------------------------------------------
-- Table: accession_sequence
-- Purpose: Track accession number sequences by year
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS `accession_sequence` (
  `year` INT PRIMARY KEY,
  `last_sequence` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='Accession number sequence tracking';

-- Initialize for current year (safe to run multiple times)
INSERT INTO `accession_sequence` (`year`, `last_sequence`) 
VALUES (YEAR(CURRENT_DATE), 0)
ON DUPLICATE KEY UPDATE `last_sequence` = `last_sequence`;

-- --------------------------------------------
-- Table: book_copy_audit
-- Purpose: Audit trail for book copy changes
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS `book_copy_audit` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `accession_number` VARCHAR(20) NOT NULL,
  `action` ENUM('created', 'borrowed', 'returned', 'condition_changed', 'location_changed', 'lost', 'found', 'retired') NOT NULL,
  `old_value` TEXT,
  `new_value` TEXT,
  `performed_by` INT,
  `performed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `notes` TEXT,
  
  INDEX `idx_accession` (`accession_number`),
  INDEX `idx_action` (`action`),
  INDEX `idx_date` (`performed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Audit trail for book copy changes';

-- ============================================
-- 05 SOFT DELETE COLUMNS
-- ============================================

-- Add soft-delete columns to students (if not exist)
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND COLUMN_NAME = 'deleted_at');
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `students` ADD COLUMN `deleted_at` DATETIME DEFAULT NULL AFTER `updated_at`, ADD COLUMN `deleted_by` INT DEFAULT NULL AFTER `deleted_at`',
  'SELECT ''soft-delete columns already exist in students'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add soft-delete columns to books (if not exist)
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'books' AND COLUMN_NAME = 'deleted_at');
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `books` ADD COLUMN `deleted_at` DATETIME DEFAULT NULL AFTER `updated_at`, ADD COLUMN `deleted_by` INT DEFAULT NULL AFTER `deleted_at`',
  'SELECT ''soft-delete columns already exist in books'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add soft-delete columns to admins (if not exist)
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admins' AND COLUMN_NAME = 'deleted_at');
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `admins` ADD COLUMN `deleted_at` DATETIME DEFAULT NULL AFTER `updated_at`, ADD COLUMN `deleted_by` INT DEFAULT NULL AFTER `deleted_at`',
  'SELECT ''soft-delete columns already exist in admins'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add pickup/return tracking columns to book_borrowings (if not exist)
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'book_borrowings' AND COLUMN_NAME = 'picked_up_at');
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `book_borrowings`
   ADD COLUMN `picked_up_at` DATETIME DEFAULT NULL AFTER `return_date`,
   ADD COLUMN `claim_expires_at` DATETIME DEFAULT NULL AFTER `picked_up_at`,
   ADD COLUMN `picked_up_by_admin_id` INT DEFAULT NULL AFTER `claim_expires_at`,
   ADD COLUMN `returned_by_admin_id` INT DEFAULT NULL AFTER `picked_up_by_admin_id`',
  'SELECT ''pickup/return tracking columns already exist in book_borrowings'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================
-- 06 FOREIGN KEY CONSTRAINTS & INDEXES
-- ============================================

-- Add foreign key for books.added_by (if not exists)
SET @fk_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'books' AND CONSTRAINT_NAME = 'fk_books_added_by');

SET @sql := IF(@fk_exists = 0, 
  'ALTER TABLE `books` ADD CONSTRAINT `fk_books_added_by` FOREIGN KEY (`added_by`) REFERENCES `admins` (`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT ''Foreign key fk_books_added_by already exists'' AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key for book_borrowings.book_id (if not exists)
SET @fk_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'book_borrowings' AND CONSTRAINT_NAME = 'book_borrowings_ibfk_1');

SET @sql := IF(@fk_exists = 0, 
  'ALTER TABLE `book_borrowings` ADD CONSTRAINT `book_borrowings_ibfk_1` FOREIGN KEY (`book_id`) REFERENCES `books` (`id`) ON UPDATE CASCADE',
  'SELECT ''Foreign key book_borrowings_ibfk_1 already exists'' AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key for book_borrowings.student_id (if not exists)
SET @fk_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'book_borrowings' AND CONSTRAINT_NAME = 'book_borrowings_ibfk_2');

SET @sql := IF(@fk_exists = 0, 
  'ALTER TABLE `book_borrowings` ADD CONSTRAINT `book_borrowings_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON UPDATE CASCADE',
  'SELECT ''Foreign key book_borrowings_ibfk_2 already exists'' AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key for book_borrowings.approved_by (if not exists)
SET @fk_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'book_borrowings' AND CONSTRAINT_NAME = 'fk_borrowings_approved_by');

SET @sql := IF(@fk_exists = 0, 
  'ALTER TABLE `book_borrowings` ADD CONSTRAINT `fk_borrowings_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `admins` (`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT ''Foreign key fk_borrowings_approved_by already exists'' AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key for book_copies.book_id (if not exists)
SET @fk_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'book_copies' AND CONSTRAINT_NAME = 'fk_book_copies_book_id');

SET @sql := IF(@fk_exists = 0, 
  'ALTER TABLE `book_copies` ADD CONSTRAINT `fk_book_copies_book_id` FOREIGN KEY (`book_id`) REFERENCES `books` (`id`) ON DELETE CASCADE',
  'SELECT ''Foreign key fk_book_copies_book_id already exists'' AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add CHECK constraints to books (if not exists)
-- Note: MySQL 8.0.16+ supports CHECK constraints
SET @check_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'books' AND CONSTRAINT_NAME = 'chk_quantity');

SET @sql := IF(@check_exists = 0, 
  'ALTER TABLE `books` ADD CONSTRAINT `chk_quantity` CHECK (`quantity` >= 0)',
  'SELECT ''Check constraint chk_quantity already exists'' AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @check_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'books' AND CONSTRAINT_NAME = 'chk_available_quantity');

SET @sql := IF(@check_exists = 0, 
  'ALTER TABLE `books` ADD CONSTRAINT `chk_available_quantity` CHECK (`available_quantity` >= 0 AND `available_quantity` <= `quantity`)',
  'SELECT ''Check constraint chk_available_quantity already exists'' AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add CHECK constraints to book_borrowings (if not exists)
SET @check_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'book_borrowings' AND CONSTRAINT_NAME = 'chk_due_date');

SET @sql := IF(@check_exists = 0, 
  'ALTER TABLE `book_borrowings` ADD CONSTRAINT `chk_due_date` CHECK (`due_date` >= `borrow_date`)',
  'SELECT ''Check constraint chk_due_date already exists'' AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @check_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'book_borrowings' AND CONSTRAINT_NAME = 'chk_return_date');

SET @sql := IF(@check_exists = 0, 
  'ALTER TABLE `book_borrowings` ADD CONSTRAINT `chk_return_date` CHECK (`return_date` IS NULL OR `return_date` >= `borrow_date`)',
  'SELECT ''Check constraint chk_return_date already exists'' AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================
-- 90 SEED DATA (OPTIONAL - COMMENT OUT FOR PRODUCTION)
-- ============================================

-- IMPORTANT: Uncomment this section ONLY for development/testing
-- DO NOT use on production database!



-- Insert default notification preferences for existing students
INSERT IGNORE INTO `notification_preferences` (`user_type`, `user_id`)
SELECT 'student', `student_id` FROM `students`;

-- Insert default notification preferences for existing admins
INSERT IGNORE INTO `notification_preferences` (`user_type`, `user_id`)
SELECT 'admin', CAST(`id` AS CHAR) FROM `admins`;

-- Insert sample admin accounts (password for all: admin123)
INSERT IGNORE INTO `admins` (`fullname`, `email`, `password`, `role`, `is_active`) VALUES
('System Administrator', 'admin@spist.edu', '$2b$10$WwLQ8t2l17rh4O042lCB.efw7kXNoOyTSoBJ1zVXU7oqiSCGCFqFK', 'super_admin', TRUE),
('John Admin', 'john.admin@spist.edu', '$2b$10$WwLQ8t2l17rh4O042lCB.efw7kXNoOyTSoBJ1zVXU7oqiSCGCFqFK', 'system_admin', TRUE),
('Jane Manager', 'jane.manager@spist.edu', '$2b$10$WwLQ8t2l17rh4O042lCB.efw7kXNoOyTSoBJ1zVXU7oqiSCGCFqFK', 'system_admin', TRUE),
('Jowel Galang', 'hahacctmo145@gmail.com', '$2b$10$WwLQ8t2l17rh4O042lCB.efw7kXNoOyTSoBJ1zVXU7oqiSCGCFqFK', 'super_admin', TRUE)
ON DUPLICATE KEY UPDATE
  `password` = VALUES(`password`),
  `is_active` = TRUE;

-- Insert sample student accounts (password: student123)
INSERT IGNORE INTO `students` (`student_id`, `fullname`, `email`, `password`, `department`, `year_level`, `student_type`, `contact_number`, `status`) VALUES
('STD-2024-001', 'Juan dela Cruz', 'juan.delacruz@spist.edu', '$2b$10$JkDx/nLnBg9r8cA/zlOXjuz0mfRO05W.p6Z1Q5wlWAgyMv04PrSve', 'BSCS', '3', 'undergraduate', '09123456789', 'active'),
('STD-2024-002', 'Maria Santos', 'maria.santos@spist.edu', '$2b$10$JkDx/nLnBg9r8cA/zlOXjuz0mfRO05W.p6Z1Q5wlWAgyMv04PrSve', 'BSIT', '2', 'undergraduate', '09234567890', 'active'),
('STD-2024-003', 'Pedro Garcia', 'pedro.garcia@spist.edu', '$2b$10$JkDx/nLnBg9r8cA/zlOXjuz0mfRO05W.p6Z1Q5wlWAgyMv04PrSve', 'BSCS', '4', 'undergraduate', '09345678901', 'active'),
('STD-2024-004', 'Ana Reyes', 'ana.reyes@spist.edu', '$2b$10$JkDx/nLnBg9r8cA/zlOXjuz0mfRO05W.p6Z1Q5wlWAgyMv04PrSve', 'BSIT', '1', 'undergraduate', '09456789012', 'active'),
('STD-2024-005', 'Jose Rizal', 'jose.rizal@spist.edu', '$2b$10$JkDx/nLnBg9r8cA/zlOXjuz0mfRO05W.p6Z1Q5wlWAgyMv04PrSve', 'BSCS', '3', 'transferee', '09567890123', 'active')
ON DUPLICATE KEY UPDATE `student_id` = `student_id`;

-- Insert sample books (ISBN must be unique)
INSERT INTO `books` (`title`, `author`, `isbn`, `category`, `quantity`, `available_quantity`, `status`, `added_by`) VALUES
('Introduction to Python Programming', 'John Developer', '978-0-123456-78-9', 'Programming', 5, 3, 'available', 1),
('Database Management Systems', 'Sarah Database', '978-0-234567-89-0', 'Database', 3, 3, 'available', 1),
('Web Development with JavaScript', 'Mike Frontend', '978-0-345678-90-1', 'Web Development', 4, 2, 'available', 1),
('Data Structures and Algorithms', 'Alice Coder', '978-0-456789-01-2', 'Programming', 3, 1, 'available', 1),
('Network Security Fundamentals', 'Bob Security', '978-0-567890-12-3', 'Networking', 2, 2, 'available', 1),
('Advanced Java Programming', 'Jane Java', '978-0-678901-23-4', 'Programming', 4, 4, 'available', 1),
('Cloud Computing Essentials', 'Cloud Expert', '978-0-789012-34-5', 'Cloud Computing', 3, 3, 'available', 1),
('Machine Learning Basics', 'AI Researcher', '978-0-890123-45-6', 'Artificial Intelligence', 2, 1, 'available', 1),
('Mobile App Development', 'App Creator', '978-0-901234-56-7', 'Mobile Development', 3, 3, 'available', 1),
('Cybersecurity Best Practices', 'Security Pro', '978-0-012345-67-8', 'Security', 2, 2, 'available', 1)
ON DUPLICATE KEY UPDATE `isbn` = `isbn`;

-- Insert sample borrowing records
INSERT IGNORE INTO `book_borrowings` (`id`, `book_id`, `student_id`, `approved_by`, `borrow_date`, `due_date`, `return_date`, `status`) VALUES
(1, 1, 'STD-2024-001', 1, '2024-11-01 10:00:00', '2024-11-15 10:00:00', '2024-11-14 09:30:00', 'returned'),
(2, 2, 'STD-2024-002', 1, '2024-11-05 14:00:00', '2024-11-19 14:00:00', NULL, 'borrowed'),
(3, 3, 'STD-2024-003', 1, '2024-11-10 11:00:00', '2024-11-24 11:00:00', NULL, 'borrowed'),
(4, 4, 'STD-2024-004', 1, '2024-11-12 15:30:00', '2024-11-26 15:30:00', NULL, 'borrowed'),
(5, 8, 'STD-2024-005', 1, '2024-11-15 09:00:00', '2024-11-29 09:00:00', NULL, 'borrowed')
ON DUPLICATE KEY UPDATE `id` = `id`;



-- ============================================
-- VERIFICATION & COMPLETION
-- ============================================

COMMIT;

-- Display completion status
SELECT 'Master schema migration completed successfully!' AS Status;

-- Show all tables
SHOW TABLES;

-- Show table counts
SELECT 
  'admins' AS table_name, COUNT(*) AS row_count FROM admins
UNION ALL
SELECT 'students', COUNT(*) FROM students
UNION ALL
SELECT 'books', COUNT(*) FROM books
UNION ALL
SELECT 'book_borrowings', COUNT(*) FROM book_borrowings
UNION ALL
SELECT 'book_copies', COUNT(*) FROM book_copies
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 'notification_preferences', COUNT(*) FROM notification_preferences
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- 
-- Next Steps:
-- 1. Verify all tables were created/updated successfully
-- 2. Test your application routes
-- 3. Check that all existing data is intact
-- 4. Update notification preferences for any new users
--
-- For troubleshooting:
-- - Check foreign key relationships: 
--   SELECT * FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE();
-- - Check indexes: 
--   SELECT TABLE_NAME, INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE();
--
-- ============================================