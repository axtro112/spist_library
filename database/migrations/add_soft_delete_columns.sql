-- Migration: Add soft delete support to books, students, and admins tables
-- This allows items to be "trashed" instead of permanently deleted
-- Date: 2026-02-25

USE spist_library;

-- Add deleted_at column to books table
ALTER TABLE books 
ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL DEFAULT NULL AFTER updated_at,
ADD INDEX idx_books_deleted_at (deleted_at);

-- Add deleted_at column to students table  
ALTER TABLE students
ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL DEFAULT NULL AFTER updated_at,
ADD INDEX idx_students_deleted_at (deleted_at);

-- Add deleted_at column to admins table
ALTER TABLE admins
ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL DEFAULT NULL AFTER updated_at,
ADD INDEX idx_admins_deleted_at (deleted_at);

-- Verify the changes
SELECT 'Books table structure:' as '';
DESCRIBE books;

SELECT 'Students table structure:' as '';
DESCRIBE students;

SELECT 'Admins table structure:' as '';
DESCRIBE admins;

SELECT '✅ Soft delete columns added successfully!' as 'Migration Status';
