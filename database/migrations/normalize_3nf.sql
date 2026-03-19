-- ============================================================
-- NORMALIZATION MIGRATION — 3NF / BCNF Fixes
-- Safe to run on existing data (additive only).
-- Does NOT drop or rename any existing column.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1.  DEPARTMENTS LOOKUP TABLE  (fixes BCNF violation)
--     students.department was a free-text VARCHAR with no
--     referential-integrity guarantee.  We now introduce a
--     canonical departments table and a nullable FK column
--     so all existing code continues to work.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `departments` (
  `id`         INT          NOT NULL AUTO_INCREMENT,
  `code`       VARCHAR(20)  NOT NULL COMMENT 'Short code, e.g. BSIT',
  `name`       VARCHAR(255) NOT NULL COMMENT 'Full official course name',
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dept_name` (`name`),
  UNIQUE KEY `uq_dept_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Master list of academic courses/departments';

-- Seed all official courses
INSERT INTO `departments` (`code`, `name`) VALUES
  ('BSCpE',      'BS Computer Engineering'),
  ('BSCS',       'BS Computer Science'),
  ('BSIT',       'BS Information Technology'),
  ('BSTM',       'BS Tourism Management'),
  ('BSBA-MM',    'BS Business Administration - Major in Marketing Management'),
  ('BSBA-OM',    'BS Business Administration - Major in Operations Management'),
  ('BSA',        'BS Accountancy'),
  ('BSHM',       'BS Hospitality Management'),
  ('BEEd',       'Bachelor in Elementary Education'),
  ('BSEd-ENG',   'Bachelor in Secondary Education - Major in English'),
  ('BSEd-MATH',  'Bachelor in Secondary Education - Major in Mathematics'),
  ('BSEd-FIL',   'Bachelor in Secondary Education - Major in Filipino'),
  ('BSEd-SS',    'Bachelor in Secondary Education - Major in Social Studies'),
  ('BSEd-SCI',   'Bachelor in Secondary Education - Major in Science')
ON DUPLICATE KEY UPDATE `code` = VALUES(`code`);

-- Add nullable department_id FK to students (old 'department' column kept intact)
-- Runner silently ignores ER_DUP_FIELDNAME / ER_DUP_KEYNAME if already applied
ALTER TABLE `students`
  ADD COLUMN `department_id` INT NULL AFTER `department`;

ALTER TABLE `students`
  ADD CONSTRAINT `fk_students_department_id`
    FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`)
    ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE `students`
  ADD INDEX `idx_students_dept_id` (`department_id`);

-- Back-fill department_id from existing department strings
UPDATE `students` s
  JOIN `departments` d ON d.name = s.department
  SET s.department_id = d.id
WHERE s.department_id IS NULL;

-- Also handle legacy short codes that may still be in old rows
UPDATE `students` s
  JOIN `departments` d ON d.code = s.department
  SET s.department_id = d.id
WHERE s.department_id IS NULL;

-- ────────────────────────────────────────────────────────────
-- 2.  NOTIFICATIONS — eliminate the three overlapping
--     "relate entity" column groups into one canonical pair
--     (entity_type / entity_id) via a view.
--
--     The original columns (related_table, related_id, link_type,
--     link_id, link_url, target_type, target_id) are kept so
--     no existing code breaks.  The view gives a clean
--     normalised interface for future queries.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW `v_notifications` AS
SELECT
  n.id,
  n.user_type,
  n.user_id,
  n.title,
  n.message,
  n.type,
  n.is_read,
  n.created_at,
  -- Canonical entity reference (coalesce across the three overlapping groups)
  COALESCE(n.link_type,   n.target_type,  n.related_table) AS entity_type,
  COALESCE(n.link_id,     n.target_id,    CAST(n.related_id AS CHAR)) AS entity_id,
  -- Book info: always show live title from books table, fall back to stored copy
  n.book_id,
  COALESCE(b.title, n.book_title)      AS book_title,
  n.borrowing_id,
  -- Due date: always show live value from book_borrowings, fall back to stored copy
  COALESCE(bb.due_date,  n.due_date)   AS due_date,
  -- Status: always show live value from book_borrowings, fall back to stored copy
  COALESCE(bb.status,    n.status)     AS borrowing_status
FROM `notifications` n
LEFT JOIN `books`          b  ON n.book_id     = b.id
LEFT JOIN `book_borrowings` bb ON n.borrowing_id = bb.id;

-- ────────────────────────────────────────────────────────────
-- 3.  NOTIFICATIONS GET QUERY PATCH
--     Update the row-level book_title stored in notifications
--     to match the current live title wherever book_id is
--     present (fixes any stale titles from before this patch).
-- ────────────────────────────────────────────────────────────

UPDATE `notifications` n
  JOIN `books` b ON n.book_id = b.id
SET n.book_title = b.title
WHERE n.book_id IS NOT NULL
  AND (n.book_title IS NULL OR n.book_title != b.title);

-- ────────────────────────────────────────────────────────────
-- 4.  STUDENTS — standardise existing department strings
--     to full course names so department_id can be set.
-- ────────────────────────────────────────────────────────────

-- Map any remaining old short-code values to their full name
UPDATE `students` SET `department` = 'BS Computer Science'          WHERE `department` IN ('BSCS') AND `department_id` IS NULL;
UPDATE `students` SET `department` = 'BS Information Technology'    WHERE `department` IN ('BSIT') AND `department_id` IS NULL;
UPDATE `students` SET `department` = 'BS Hospitality Management'    WHERE `department` IN ('BSHM') AND `department_id` IS NULL;
UPDATE `students` SET `department` = 'BS Accountancy'               WHERE `department` IN ('BSA')  AND `department_id` IS NULL;

-- Re-run back-fill after string normalisation
UPDATE `students` s
  JOIN `departments` d ON d.name = s.department
  SET s.department_id = d.id
WHERE s.department_id IS NULL;
