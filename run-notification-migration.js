const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function runMigration() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'spist_library',
      multipleStatements: true
    });

    console.log('✓ Connected to database');

    // Read SQL file
    const sqlPath = path.join(__dirname, 'database', 'migrations', 'add_notifications_system.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');

    console.log('✓ Read migration file');
    console.log('Running migration...\n');

    // Execute SQL
    await connection.query(sql);

    console.log('\n✓ Migration completed successfully!');
    console.log('✓ Tables created:');
    console.log('  - notifications');
    console.log('  - notification_preferences');

  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✓ Database connection closed');
    }
  }
}

runMigration();
