-- ============================================
-- SPIST LIBRARY MANAGEMENT SYSTEM
-- Complete Database Schema & Migration Suite
-- Version: 2.0
-- ============================================
--
-- IMPORTANT: READ BEFORE RUNNING
-- This file contains the complete database schema for the SPIST Library Management System.
-- It includes both the base schema and v2.0 enhancements.
--
-- ============================================
-- FILE ORGANIZATION
-- ============================================
--
-- This repository contains several SQL files:
--
-- 1. spist_library_schema.sql (THIS FILE)
--    - Complete schema definition (database-agnostic)
--    - Can be imported into any database name
--    - Safe for production, staging, development, testing
--
-- 2. spist_library.sql
--    - Original export from phpMyAdmin
--    - Contains sample data and hardcoded database name
--    - Use for reference or full restore
--
-- 3. spist_library_template.sql
--    - Clean template for new environments
--    - No sample data, no database-specific references
--    - Recommended for new deployments
--
-- 4. ROLLBACK_v2_to_v1.sql
--    - Emergency rollback script if v2.0 migration fails
--    - Reverts schema changes
--
-- ============================================
-- USAGE INSTRUCTIONS
-- ============================================
--
-- FOR NEW INSTALLATION:
-- --------------------
-- Step 1: Create database
--   mysql -u root -p -e "CREATE DATABASE spist_library;"
--
-- Step 2: Import this schema
--   mysql -u root -p spist_library < spist_library_schema.sql
--
-- Step 3: Verify installation
--   mysql -u root -p spist_library -e "SHOW TABLES;"
--
-- FOR DEVELOPMENT ENVIRONMENT:
-- ---------------------------
-- Step 1: Create dev database
--   mysql -u root -p -e "CREATE DATABASE spist_library_dev;"
--
-- Step 2: Import schema
--   mysql -u root -p spist_library_dev < spist_library_schema.sql
--
-- Step 3: Update .env file
--   DB_NAME=spist_library_dev
--
-- FOR TESTING ENVIRONMENT:
-- -----------------------
-- Step 1: Create test database
--   mysql -u root -p -e "CREATE DATABASE spist_library_test;"
--
-- Step 2: Import schema
--   mysql -u root -p spist_library_test < spist_library_schema.sql
--
-- Step 3: Update .env file
--   DB_NAME=spist_library_test
--
-- ============================================
-- ENVIRONMENT CONFIGURATION
-- ============================================
--
-- This schema works with your .env configuration:
--
-- Production:    DB_NAME=spist_library
-- Staging:       DB_NAME=spist_library_staging
-- Development:   DB_NAME=spist_library_dev
-- Testing:       DB_NAME=spist_library_test
--
-- See .env.example for complete configuration template
--
-- ============================================
-- SCHEMA VERSION INFORMATION
-- ============================================
--
-- Version 1.0 (Initial Release)
-- - Basic tables: admins, students, books, book_borrowings
-- - Foreign key relationships
-- - Basic indexes
--
-- Version 2.0 (Current)
-- - Added: available_quantity to books table
-- - Added: approved_by to book_borrowings
-- - Added: audit_logs table
-- - Enhanced: ENUM values for status fields
-- - Enhanced: Performance indexes
-- - Enhanced: CHECK constraints
-- - Enhanced: updated_at timestamps
--
-- ============================================
-- BEGIN SCHEMA DEFINITION
-- ============================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

-- ============================================
-- SECTION 1: TABLE DEFINITIONS
-- ============================================

-- --------------------------------------------
-- Table: admins
-- Purpose: Store administrator accounts and credentials
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS `admins` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `fullname` varchar(255) NOT NULL COMMENT 'Administrator full name',
  `email` varchar(255) NOT NULL COMMENT 'Unique email address for login',
  `password` varchar(255) NOT NULL COMMENT 'Bcrypt hashed password',
  `role` enum('super_admin','system_admin') DEFAULT 'system_admin' COMMENT 'Admin privilege level',
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Account status (v2.0)',
  `resetToken` varchar(255) DEFAULT NULL COMMENT 'Password reset token',
  `resetTokenExpiry` datetime DEFAULT NULL COMMENT 'Token expiration time',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'Account creation timestamp',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last modification timestamp (v2.0)',
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
  `password` varchar(255) NOT NULL COMMENT 'Bcrypt hashed password',
  `department` varchar(50) NOT NULL COMMENT 'Academic department (e.g., BSCS, BSIT)',
  `year_level` varchar(20) NOT NULL COMMENT 'Current year level (e.g., 1st Year, 2nd Year)',
  `student_type` ENUM('undergraduate', 'graduate', 'transferee') NOT NULL COMMENT 'Student classification (v2.0)',
  `contact_number` varchar(20) DEFAULT NULL COMMENT 'Phone number for notifications',
  `resetToken` varchar(255) DEFAULT NULL COMMENT 'Password reset token',
  `resetTokenExpiry` datetime DEFAULT NULL COMMENT 'Token expiration time',
  `status` ENUM('active', 'inactive', 'suspended', 'graduated') NOT NULL DEFAULT 'active' COMMENT 'Account status (v2.0 expanded)',
  `created_at` datetime DEFAULT current_timestamp() COMMENT 'Account creation timestamp',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last modification timestamp (v2.0)',
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
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last modification timestamp (v2.0)',
  `status` ENUM('available', 'borrowed', 'maintenance') DEFAULT 'available' COMMENT 'Book status',
  `added_by` INT DEFAULT NULL COMMENT 'Admin ID who added the book (v2.0)',
  `quantity` int(11) DEFAULT 1 COMMENT 'Total copies in library',
  `available_quantity` INT NOT NULL DEFAULT 1 COMMENT 'Currently available copies (v2.0)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `isbn` (`isbn`),
  KEY `idx_category` (`category`),
  KEY `idx_title` (`title`),
  KEY `idx_status` (`status`),
  KEY `idx_added_by` (`added_by`),
  CONSTRAINT `fk_books_added_by` FOREIGN KEY (`added_by`) REFERENCES `admins` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_quantity` CHECK (`quantity` >= 0),
  CONSTRAINT `chk_available_quantity` CHECK (`available_quantity` >= 0 AND `available_quantity` <= `quantity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Book inventory';

-- --------------------------------------------
-- Table: book_borrowings
-- Purpose: Track book borrowing transactions
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS `book_borrowings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `book_id` int(11) NOT NULL COMMENT 'Reference to books table',
  `student_id` varchar(20) NOT NULL COMMENT 'Reference to students table',
  `approved_by` INT DEFAULT NULL COMMENT 'Admin who approved the borrowing (v2.0)',
  `borrow_date` datetime DEFAULT current_timestamp() COMMENT 'Date book was borrowed',
  `due_date` datetime NOT NULL COMMENT 'Date book should be returned',
  `return_date` datetime DEFAULT NULL COMMENT 'Actual return date (NULL if not returned)',
  `status` ENUM('pending', 'approved', 'borrowed', 'returned', 'overdue', 'cancelled') DEFAULT 'borrowed' COMMENT 'Borrowing status (v2.0 expanded)',
  `notes` TEXT DEFAULT NULL COMMENT 'Additional notes or remarks (v2.0)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp (v2.0)',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last modification timestamp (v2.0)',
  PRIMARY KEY (`id`),
  KEY `idx_student_id` (`student_id`),
  KEY `idx_book_id` (`book_id`),
  KEY `idx_status` (`status`),
  KEY `idx_student_status` (`student_id`, `status`),
  KEY `idx_borrow_date` (`borrow_date`),
  KEY `idx_due_date` (`due_date`),
  KEY `idx_approved_by` (`approved_by`),
  CONSTRAINT `book_borrowings_ibfk_1` FOREIGN KEY (`book_id`) REFERENCES `books` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `book_borrowings_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_borrowings_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `admins` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_due_date` CHECK (`due_date` >= `borrow_date`),
  CONSTRAINT `chk_return_date` CHECK (`return_date` IS NULL OR `return_date` >= `borrow_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Book borrowing transactions';

-- --------------------------------------------
-- Table: audit_logs (v2.0)
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Audit trail for all database changes (v2.0)';

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

-- ============================================
-- SECTION 2: DEFAULT DATA (Optional)
-- ============================================
-- Uncomment to insert default admin account
-- Password: admin123 (CHANGE IMMEDIATELY AFTER FIRST LOGIN)
--
-- INSERT INTO `admins` (`fullname`, `email`, `password`, `role`) VALUES
-- ('System Administrator', 'admin@spist.edu', '$2b$10$XsCv92X03pF9juwKuGO3FOx5jvNV5B4c1gvpjfv21vPH7V5NHCKEO', 'super_admin');

-- ============================================
-- SECTION 3: VERIFICATION QUERIES
-- ============================================
-- Run these to verify installation:

-- Check all tables created
-- SELECT 'Tables created successfully!' as Status;
-- SHOW TABLES;

-- Check table structures
-- SHOW COLUMNS FROM admins;
-- SHOW COLUMNS FROM students;
-- SHOW COLUMNS FROM books;
-- SHOW COLUMNS FROM book_borrowings;
-- SHOW COLUMNS FROM audit_logs;

-- Check indexes
-- SHOW INDEX FROM books;
-- SHOW INDEX FROM book_borrowings;

-- Check foreign keys
-- SELECT 
--   CONSTRAINT_NAME,
--   TABLE_NAME,
--   REFERENCED_TABLE_NAME,
--   UPDATE_RULE,
--   DELETE_RULE
-- FROM information_schema.REFERENTIAL_CONSTRAINTS
-- WHERE CONSTRAINT_SCHEMA = DATABASE();

-- ============================================
-- INSTALLATION COMPLETE
-- ============================================
-- 
-- Next Steps:
-- 1. Update your .env file with the database name you used
-- 2. Start the Node.js server: npm start
-- 3. Access the application at http://localhost:3000
-- 4. Import initial book data via CSV/Excel if needed
--
-- For multi-environment setup, see DATABASE_SETUP.md
-- For quick reference, see QUICK_REFERENCE.md
--
-- ============================================
