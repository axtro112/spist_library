-- ============================================
-- SAMPLE DATA FOR DEVELOPMENT/TESTING
-- SPIST Library Management System
-- ============================================
--
-- PURPOSE:
-- This file contains sample data for development and testing.
-- Use this to populate a development or testing database with realistic data.
--
-- WARNING:
-- DO NOT run this on production database!
-- This will insert test accounts and sample books.
--
-- USAGE:
-- mysql -u root -p spist_library_dev < database/sample_data.sql
--
-- ============================================

-- Insert sample admin accounts
-- Password for all: admin123 (hashed with bcrypt)
INSERT INTO `admins` (`fullname`, `email`, `password`, `role`, `is_active`) VALUES
('System Administrator', 'admin@spist.edu', '$2b$10$XsCv92X03pF9juwKuGO3FOx5jvNV5B4c1gvpjfv21vPH7V5NHCKEO', 'super_admin', TRUE),
('John Admin', 'john.admin@spist.edu', '$2b$10$XsCv92X03pF9juwKuGO3FOx5jvNV5B4c1gvpjfv21vPH7V5NHCKEO', 'system_admin', TRUE),
('Jane Manager', 'jane.manager@spist.edu', '$2b$10$XsCv92X03pF9juwKuGO3FOx5jvNV5B4c1gvpjfv21vPH7V5NHCKEO', 'system_admin', TRUE);

-- Insert sample student accounts
-- Password for all: student123 (hashed with bcrypt)
INSERT INTO `students` (`student_id`, `fullname`, `email`, `password`, `department`, `year_level`, `student_type`, `contact_number`, `status`) VALUES
('STD-2024-001', 'Juan dela Cruz', 'juan.delacruz@spist.edu', '$2b$10$JkDx/nLnBg9r8cA/zlOXjuz0mfRO05W.p6Z1Q5wlWAgyMv04PrSve', 'BSCS', '3', 'undergraduate', '09123456789', 'active'),
('STD-2024-002', 'Maria Santos', 'maria.santos@spist.edu', '$2b$10$JkDx/nLnBg9r8cA/zlOXjuz0mfRO05W.p6Z1Q5wlWAgyMv04PrSve', 'BSIT', '2', 'undergraduate', '09234567890', 'active'),
('STD-2024-003', 'Pedro Garcia', 'pedro.garcia@spist.edu', '$2b$10$JkDx/nLnBg9r8cA/zlOXjuz0mfRO05W.p6Z1Q5wlWAgyMv04PrSve', 'BSCS', '4', 'undergraduate', '09345678901', 'active'),
('STD-2024-004', 'Ana Reyes', 'ana.reyes@spist.edu', '$2b$10$JkDx/nLnBg9r8cA/zlOXjuz0mfRO05W.p6Z1Q5wlWAgyMv04PrSve', 'BSIT', '1', 'undergraduate', '09456789012', 'active'),
('STD-2024-005', 'Jose Rizal', 'jose.rizal@spist.edu', '$2b$10$JkDx/nLnBg9r8cA/zlOXjuz0mfRO05W.p6Z1Q5wlWAgyMv04PrSve', 'BSCS', '3', 'transferee', '09567890123', 'active');

-- Insert sample books
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
('Cybersecurity Best Practices', 'Security Pro', '978-0-012345-67-8', 'Security', 2, 2, 'available', 1);

-- Insert sample borrowing records
INSERT INTO `book_borrowings` (`book_id`, `student_id`, `approved_by`, `borrow_date`, `due_date`, `return_date`, `status`) VALUES
(1, 'STD-2024-001', 1, '2024-11-01 10:00:00', '2024-11-15 10:00:00', '2024-11-14 09:30:00', 'returned'),
(2, 'STD-2024-002', 1, '2024-11-05 14:00:00', '2024-11-19 14:00:00', NULL, 'borrowed'),
(3, 'STD-2024-003', 1, '2024-11-10 11:00:00', '2024-11-24 11:00:00', NULL, 'borrowed'),
(4, 'STD-2024-004', 1, '2024-11-12 15:30:00', '2024-11-26 15:30:00', NULL, 'borrowed'),
(8, 'STD-2024-005', 1, '2024-11-15 09:00:00', '2024-11-29 09:00:00', NULL, 'borrowed');

-- ============================================
-- SAMPLE DATA INSERTED
-- ============================================
--
-- Default Credentials:
-- 
-- Admin Login:
--   Email: admin@spist.edu
--   Password: admin123
--
-- Student Login:
--   Student ID: STD-2024-001
--   Password: student123
--
-- IMPORTANT: Change these passwords immediately in production!
--
-- ============================================
