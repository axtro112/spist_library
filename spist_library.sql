-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: May 09, 2025 at 06:20 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `spist_library`
--

-- --------------------------------------------------------

--
-- Table structure for table `admins`
--

CREATE TABLE `admins` (
  `id` int(11) NOT NULL,
  `fullname` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('super_admin','system_admin') DEFAULT 'system_admin',
  `resetToken` varchar(255) DEFAULT NULL,
  `resetTokenExpiry` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `admins`
--

INSERT INTO `admins` (`id`, `fullname`, `email`, `password`, `role`, `created_at`) VALUES
(5, 'Admin Lulli', 'adminlulli@spist.edu', '$2b$10$XsCv92X03pF9juwKuGO3FOx5jvNV5B4c1gvpjfv21vPH7V5NHCKEO', 'super_admin', '2025-05-09 03:20:48'),
(6, 'Hezekiah', 'adminhezekiah@spist.edu', '$2b$10$awdAq5VwqOsyPNKyvk0bBO4T2N0Br8U5qEKI3EVeC2MV.25EMN8ZS', 'system_admin', '2025-05-09 03:30:46');

-- --------------------------------------------------------

--
-- Table structure for table `books`
--

CREATE TABLE `books` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `author` varchar(100) DEFAULT NULL,
  `isbn` varchar(20) DEFAULT NULL,
  `category` varchar(50) DEFAULT NULL,
  `added_date` datetime DEFAULT current_timestamp(),
  `status` enum('available','borrowed','maintenance') DEFAULT 'available'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `books`
--

INSERT INTO `books` (`id`, `title`, `author`, `isbn`, `category`, `added_date`, `status`) VALUES
(1, 'Introduction to Python Programming', 'John Developer', '978-5-2345-9090-0', 'Programming', '2025-05-09 10:28:10', 'borrowed'),
(2, 'Database Management Systems', 'Sarah Admin', '978-5-2345-9090-6', 'Database', '2025-05-09 10:28:10', 'available'),
(3, 'Web Development Basics', 'Mike Designer', '978-1-2345-8390-6', 'Web Development', '2025-05-09 10:28:10', 'borrowed'),
(4, 'Data Structures and Algorithms', 'Alice Coder', '978-1-2345-9390-1', 'Programming', '2025-05-09 10:28:10', 'borrowed'),
(5, 'Network Security Fundamentals', 'Bob Security', '973-1-2345-9390-6', 'Networking', '2025-05-09 10:28:10', 'available'),
(6, 'Advanced Java Programming', 'Jane Java', '978-1-2345-9370-6', 'Programming', '2025-05-09 10:28:10', 'available'),
(7, 'Cloud Computing Essentials', 'Cloud Expert', '978-1-2345-9380-6', 'Cloud Computing', '2025-05-09 10:28:10', 'available'),
(8, 'Mama mo', 'Lulli', '978-1-2345-9090-6', 'Filipino', '2025-05-09 11:29:29', 'borrowed'),
(9, 'Ang lola mo', 'Lulli', '978-1-2345-8090-6', 'Filipino', '2025-05-09 20:52:44', 'borrowed');

-- --------------------------------------------------------

--
-- Table structure for table `book_borrowings`
--

CREATE TABLE `book_borrowings` (
  `id` int(11) NOT NULL,
  `book_id` int(11) NOT NULL,
  `student_id` varchar(20) NOT NULL,
  `borrow_date` datetime DEFAULT current_timestamp(),
  `due_date` datetime NOT NULL,
  `return_date` datetime DEFAULT NULL,
  `status` enum('borrowed','returned','overdue') DEFAULT 'borrowed'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `book_borrowings`
--

INSERT INTO `book_borrowings` (`id`, `book_id`, `student_id`, `borrow_date`, `due_date`, `return_date`, `status`) VALUES
(1, 1, '2024-0001', '2025-04-01 10:00:00', '2025-04-15 10:00:00', '2025-05-09 14:15:37', 'returned'),
(2, 2, '2024-0002', '2024-03-02 11:00:00', '2024-03-16 11:00:00', '2025-05-09 14:14:59', 'returned'),
(4, 4, '2024-0003', '2024-02-15 09:00:00', '2024-02-29 09:00:00', '2024-02-28 14:00:00', 'returned'),
(5, 5, '2024-0004', '2024-02-16 10:00:00', '2024-03-01 10:00:00', '2024-02-29 15:00:00', 'returned'),
(6, 6, '2024-0005', '2024-02-01 13:00:00', '2024-02-15 13:00:00', '2025-05-09 19:46:25', 'returned'),
(7, 7, '2024-0003', '2024-02-02 14:00:00', '2024-02-16 14:00:00', '2025-05-09 19:46:34', 'returned'),
(14, 1, '2024-0001', '2025-05-01 10:00:00', '2025-05-15 10:00:00', '2025-05-09 19:45:42', 'returned'),
(15, 2, '2024-0002', '2025-05-02 14:30:00', '2025-05-16 14:30:00', '2025-05-09 18:56:41', 'returned'),
(16, 3, '2024-0003', '2025-05-03 10:00:00', '2025-05-17 10:00:00', '2025-05-15 11:30:00', 'returned'),
(17, 4, '2024-0004', '2025-05-04 11:15:00', '2025-05-18 11:15:00', '2025-05-16 16:45:00', 'returned'),
(18, 5, '2024-0001', '2025-05-05 13:45:00', '2025-05-10 13:45:00', '2025-05-09 19:46:13', 'returned'),
(19, 6, '2024-0002', '2025-05-06 15:20:00', '2025-05-11 15:20:00', '2025-05-09 19:46:25', 'returned'),
(36, 9, '2024-0003', '2025-05-09 21:56:55', '2025-05-23 21:56:55', '2025-05-09 21:57:04', 'returned'),
(54, 8, 'STD-2023-020', '2025-05-09 22:57:57', '2025-05-21 00:00:00', '2025-05-21 00:00:00', 'returned'),
(55, 9, 'STD-2023-020', '2025-05-09 22:59:27', '2025-06-08 00:00:00', '2025-05-09 23:00:12', 'returned'),
(56, 9, 'STD-2023-020', '2025-05-09 23:02:52', '2025-05-22 00:00:00', '2025-05-09 23:03:22', 'returned'),
(57, 1, 'STD-2023-020', '2025-05-09 23:10:19', '2025-05-22 00:00:00', '2025-05-09 23:30:26', 'returned'),
(58, 4, 'STD-2023-020', '2025-05-09 23:11:43', '2025-06-08 00:00:00', '2025-05-09 23:30:21', 'returned'),
(59, 6, 'STD-2023-020', '2025-05-09 23:16:52', '2025-06-08 00:00:00', '2025-05-09 23:30:17', 'returned'),
(67, 9, 'STD-2023-020', '2025-05-09 23:39:48', '2025-06-08 00:00:00', NULL, 'borrowed'),
(68, 8, 'STD-2023-020', '2025-05-09 23:40:44', '2025-06-08 00:00:00', NULL, 'borrowed'),
(69, 4, 'STD-2023-020', '2025-05-09 23:40:53', '2025-06-08 00:00:00', NULL, 'borrowed'),
(70, 7, 'STD-2023-021', '2025-05-09 23:46:35', '2025-06-08 00:00:00', '2025-05-09 23:48:41', 'returned'),
(71, 3, 'STD-2023-021', '2025-05-09 23:46:47', '2025-06-08 00:00:00', NULL, 'borrowed'),
(72, 1, 'STD-2023-020', '2025-05-10 00:01:09', '2025-06-08 00:00:00', NULL, 'borrowed');

-- --------------------------------------------------------

--
-- Table structure for table `students`
--

CREATE TABLE `students` (
  `id` int(11) NOT NULL,
  `student_id` varchar(20) NOT NULL,
  `fullname` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `department` varchar(50) NOT NULL,
  `year_level` varchar(20) NOT NULL,
  `student_type` varchar(20) NOT NULL,
  `contact_number` varchar(20) DEFAULT NULL,
  `resetToken` varchar(255) DEFAULT NULL,
  `resetTokenExpiry` datetime DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `students`
--

INSERT INTO `students` (`id`, `student_id`, `fullname`, `email`, `password`, `department`, `year_level`, `student_type`, `contact_number`, `status`, `created_at`) VALUES
(1, '2024-0001', 'John Smith', 'john.smith@spist.edu', 'hashed_password_1', 'Computer Science', '3rd Year', 'Regular', '09123456789', 'active', '2025-05-09 10:28:10'),
(2, '2024-0002', 'Maria Garcia', 'maria.garcia@spist.edu', 'hashed_password_2', 'Information Technology', '2nd Year', 'Regular', '09234567890', 'active', '2025-05-09 10:28:10'),
(3, '2024-0003', 'James Wilson', 'james.wilson@spist.edu', 'hashed_password_3', 'Computer Science', '4th Year', 'Regular', '09345678901', 'active', '2025-05-09 10:28:10'),
(4, '2024-0004', 'Sarah Chen', 'sarah.chen@spist.edu', 'hashed_password_4', 'Information Technology', '1st Year', 'Regular', '09456789012', 'active', '2025-05-09 10:28:10'),
(5, '2024-0005', 'Michael Lee', 'michael.lee@spist.edu', 'hashed_password_5', 'Computer Science', '2nd Year', 'Regular', '09567890123', 'active', '2025-05-09 10:28:10'),
(6, 'STD-2023-020', 'John Andrew Borabo', 'johnandrewborabo44@gmail.com', '$2b$10$JkDx/nLnBg9r8cA/zlOXjuz0mfRO05W.p6Z1Q5wlWAgyMv04PrSve', 'BSCS', '3', 'undergraduate', '09665723918', 'active', '2025-05-09 11:26:08'),
(7, 'STD-2023-021', 'Hezekiah Nafora', 'hnafora@gmail.com', '$2b$10$XKpKhjMrouBOSntcsTFIr.1wlo4Po/yCPcxkDkGEJUFUF56tGyaaa', 'BSCS', '3', 'undergraduate', '09665723912', 'active', '2025-05-09 23:45:51');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admins`
--
ALTER TABLE `admins`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `books`
--
ALTER TABLE `books`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `isbn` (`isbn`);

--
-- Indexes for table `book_borrowings`
--
ALTER TABLE `book_borrowings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_student_id` (`student_id`),
  ADD KEY `idx_book_id` (`book_id`),
  ADD KEY `idx_status` (`status`);

--
-- Indexes for table `students`
--
ALTER TABLE `students`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `student_id` (`student_id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `admins`
--
ALTER TABLE `admins`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `books`
--
ALTER TABLE `books`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `book_borrowings`
--
ALTER TABLE `book_borrowings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=73;

--
-- AUTO_INCREMENT for table `students`
--
ALTER TABLE `students`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `book_borrowings`
--
ALTER TABLE `book_borrowings`
  ADD CONSTRAINT `book_borrowings_ibfk_1` FOREIGN KEY (`book_id`) REFERENCES `books` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `book_borrowings_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
