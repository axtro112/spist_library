-- Fix admins.id to be PRIMARY KEY + AUTO_INCREMENT
-- Safe for repeated execution.

SET @db_name = DATABASE();

SELECT COUNT(*) INTO @has_pk
FROM information_schema.TABLE_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = @db_name
  AND TABLE_NAME = 'admins'
  AND CONSTRAINT_TYPE = 'PRIMARY KEY';

SET @add_pk_sql = IF(
  @has_pk = 0,
  'ALTER TABLE admins ADD PRIMARY KEY (id)',
  'SELECT ''PRIMARY KEY already exists on admins.id'' AS info'
);
PREPARE stmt_add_pk FROM @add_pk_sql;
EXECUTE stmt_add_pk;
DEALLOCATE PREPARE stmt_add_pk;

SELECT EXTRA INTO @id_extra
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @db_name
  AND TABLE_NAME = 'admins'
  AND COLUMN_NAME = 'id';

SET @make_ai_sql = IF(
  @id_extra LIKE '%auto_increment%',
  'SELECT ''admins.id is already AUTO_INCREMENT'' AS info',
  'ALTER TABLE admins MODIFY id INT NOT NULL AUTO_INCREMENT'
);
PREPARE stmt_make_ai FROM @make_ai_sql;
EXECUTE stmt_make_ai;
DEALLOCATE PREPARE stmt_make_ai;
