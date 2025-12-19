-- ================================================
-- Google Authentication Migration
-- Date: December 17, 2025
-- Purpose: Add Google OAuth support for students and admins
-- ================================================

-- Add google_id column to students table
ALTER TABLE `students` 
ADD COLUMN `google_id` VARCHAR(255) NULL UNIQUE COMMENT 'Google OAuth user ID' AFTER `student_id`,
ADD INDEX `idx_google_id` (`google_id`);

-- Add google_id column to admins table
ALTER TABLE `admins` 
ADD COLUMN `google_id` VARCHAR(255) NULL UNIQUE COMMENT 'Google OAuth user ID' AFTER `id`,
ADD INDEX `idx_google_id_admins` (`google_id`);

-- Make password nullable for Google-only accounts
ALTER TABLE `students` 
MODIFY COLUMN `password` VARCHAR(255) NULL COMMENT 'Bcrypt hashed password (null for Google-only accounts)';

ALTER TABLE `admins` 
MODIFY COLUMN `password` VARCHAR(255) NULL COMMENT 'Bcrypt hashed password (null for Google-only accounts)';

-- ================================================
-- HOW TO APPLY THIS MIGRATION:
-- ================================================
-- mysql -u root -p spist_library < database/migrations/add_google_auth.sql
-- ================================================
