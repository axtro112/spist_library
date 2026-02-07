/**
 * Migration Script: Add Notification Target Fields
 * Run this script to add target_type, target_id, and related fields to notifications table
 */

const fs = require('fs');
const path = require('path');
const connection = require('../src/config/database');

const migrationPath = path.join(__dirname, 'migrations', 'add_notification_target_fields.sql');

console.log('Starting database migration...');
console.log('Migration file:', migrationPath);

fs.readFile(migrationPath, 'utf8', (err, sql) => {
  if (err) {
    console.error('Error reading migration file:', err);
    process.exit(1);
  }

  // Split SQL file by semicolons to execute each statement separately
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => {
      // Keep only non-empty statements that have SQL keywords (not just comments)
      return s.length > 0 && /\b(ALTER|CREATE|UPDATE|INSERT|DELETE|DROP|SELECT)\b/i.test(s);
    });

  let completed = 0;
  const total = statements.length;

  console.log(`Found ${total} SQL statements to execute\n`);

  function executeNext() {
    if (completed >= total) {
      console.log('\n✅ Migration completed successfully!');
      console.log('All notification target fields have been added.');
      connection.end();
      process.exit(0);
      return;
    }

    const statement = statements[completed];
    console.log(`[${completed + 1}/${total}] Executing: ${statement.substring(0, 60)}...`);

    connection.query(statement, (error, results) => {
      if (error) {
        // Ignore "duplicate column" errors (means column already exists)
        if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_DUP_KEYNAME') {
          console.log(`  ⚠️  Column/index already exists, skipping...`);
        } else {
          console.error('  ❌ Error executing statement:', error.message);
          connection.end();
          process.exit(1);
          return;
        }
      } else {
        console.log(`  ✅ Success`);
      }

      completed++;
      executeNext();
    });
  }

  executeNext();
});
