-- Add education stage support for students from Pre-School to College.

ALTER TABLE `students`
  ADD COLUMN `education_stage` VARCHAR(30) NOT NULL DEFAULT 'College' AFTER `department_id`;

UPDATE `students`
SET `education_stage` = 'College'
WHERE `education_stage` IS NULL OR TRIM(`education_stage`) = '';

UPDATE `students`
SET `year_level` = CASE
  WHEN `year_level` = '1' THEN '1st Year'
  WHEN `year_level` = '2' THEN '2nd Year'
  WHEN `year_level` = '3' THEN '3rd Year'
  WHEN `year_level` = '4' THEN '4th Year'
  WHEN `year_level` = '5' THEN '5th Year'
  ELSE `year_level`
END;