-- Normalize legacy education_stage labels to canonical values.

UPDATE `students`
SET `education_stage` = CASE
  WHEN LOWER(TRIM(REPLACE(REPLACE(`education_stage`, '-', ' '), '  ', ' '))) IN ('preschool', 'pre school') THEN 'Pre-School'
  WHEN LOWER(TRIM(REPLACE(REPLACE(`education_stage`, '-', ' '), '  ', ' '))) IN ('prep', 'preparatory', 'preparatory school') THEN 'Prep'
  WHEN LOWER(TRIM(REPLACE(REPLACE(`education_stage`, '-', ' '), '  ', ' '))) IN ('kinder', 'kindergarten') THEN 'Kinder'
  WHEN LOWER(TRIM(REPLACE(REPLACE(`education_stage`, '-', ' '), '  ', ' '))) IN ('elementary', 'grade school') THEN 'Elementary'
  WHEN LOWER(TRIM(REPLACE(REPLACE(`education_stage`, '-', ' '), '  ', ' '))) IN ('junior high', 'junior high school', 'jhs') THEN 'Junior High'
  WHEN LOWER(TRIM(REPLACE(REPLACE(`education_stage`, '-', ' '), '  ', ' '))) IN ('senior high', 'senior high school', 'shs') THEN 'Senior High'
  WHEN LOWER(TRIM(REPLACE(REPLACE(`education_stage`, '-', ' '), '  ', ' '))) IN ('college', 'college student', 'tertiary') THEN 'College'
  ELSE `education_stage`
END
WHERE `education_stage` IS NOT NULL
  AND TRIM(`education_stage`) <> '';