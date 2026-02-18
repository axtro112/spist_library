const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Public MySQL connection details
const connection = {
  host: 'tramway.proxy.rlwy.net',
  port: 32416,
  user: 'root',
  password: 'IMvoNFLYLMIcDtdWybJxaBjCFbebbgxJ',
  database: 'railway',
  multipleStatements: true
};

async function initializeDatabase() {
  let conn;
  try {
    console.log('Connecting to Railway MySQL database...');
    conn = await mysql.createConnection(connection);
    console.log('✓ Connected successfully\n');

    // Create database first
    console.log('Creating database spist_library_primary...');
    await conn.query('CREATE DATABASE IF NOT EXISTS spist_library_primary');
    console.log('✓ Database created/verified\n');

    // Read and execute schema
    console.log('Creating database schema...');
    const schemaSQL = fs.readFileSync(
      path.join(__dirname, 'database/spist_library_primary.sql'),
      'utf8'
    );
    // Use the database before running schema
    const schemaWithUse = 'USE spist_library_primary;\n' + schemaSQL;
    await conn.query(schemaWithUse);
    console.log('✓ Schema created successfully\n');

    // Schema already did USE, but close and reconnect to be safe
    await conn.end();
    
    connection.database = 'spist_library_primary';
    conn = await mysql.createConnection(connection);
    console.log('✓ Connected to spist_library_primary\n');

    // Read and execute sample data
    console.log('Inserting sample data...');
    const sampleDataSQL = fs.readFileSync(
      path.join(__dirname, 'database/sample_data.sql'),
      'utf8'
    );
    await conn.query(sampleDataSQL);
    console.log('✓ Sample data inserted successfully\n');

    console.log('===== DATABASE INITIALIZATION COMPLETE =====');
    console.log('\nTest Credentials:');
    console.log('─────────────────────────────────────────');
    console.log('Admin Login:');
    console.log('  Email: admin@spist.edu');
    console.log('  Password: admin123\n');
    console.log('Student Login:');
    console.log('  Student ID: STD-2024-001');
    console.log('  Password: student123\n');
    console.log('App URL: https://spistlibrary-production.up.railway.app');
    console.log('─────────────────────────────────────────');

    await conn.end();
  } catch (error) {
    console.error('✗ Error:', error.message);
    if (error.code === 'ER_ACCESS_DENIED_FOR_USER') {
      console.error('  → Check MySQL credentials');
    } else if (error.code === 'ENOTFOUND') {
      console.error('  → Check MySQL host and network connection');
    }
    process.exit(1);
  }
}

initializeDatabase();
