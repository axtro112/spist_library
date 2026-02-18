/**
 * Initialize Railway Database with Schema and Sample Data
 * This script will:
 * 1. Create the database schema
 * 2. Insert sample test data
 * 3. Create sample admin and student accounts
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Railway MySQL Connection (from production environment variables)
const railwayConfig = {
  host: process.env.DB_HOST || 'mysql.railway.internal',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spist_library_primary',
  port: process.env.DB_PORT || 3306,
};

console.log('🚀 Initializing Railway Database...');
console.log('Connection config:', {
  host: railwayConfig.host,
  user: railwayConfig.user,
  database: railwayConfig.database,
  port: railwayConfig.port,
});

async function initializeDatabase() {
  let connection;

  try {
    // Connect to database
    connection = await mysql.createConnection(railwayConfig);
    console.log('✅ Connected to Railway MySQL\n');

    // Read schema file
    const schemaPath = path.join(__dirname, 'spist_library_primary.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    // Read sample data file
    const sampleDataPath = path.join(__dirname, 'sample_data.sql');
    const sampleDataSQL = fs.readFileSync(sampleDataPath, 'utf8');

    // Split and execute schema statements
    console.log('📋 Creating database schema...');
    const schemaStatements = schemaSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        return (
          s.length > 0 &&
          !s.startsWith('--') &&
          /\b(CREATE|ALTER|INSERT|DROP)\b/i.test(s)
        );
      });

    for (const stmt of schemaStatements) {
      try {
        await connection.query(stmt);
      } catch (err) {
        // Ignore table already exists errors
        if (
          err.code !== 'ER_TABLE_EXISTS_ERROR' &&
          err.code !== 'ER_DUP_ENTRY'
        ) {
          console.warn('⚠️  Warning:', err.message);
        }
      }
    }
    console.log('✅ Schema created/verified\n');

    // Split and execute sample data statements
    console.log('📚 Inserting sample data...');
    const sampleStatements = sampleDataSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        return (
          s.length > 0 &&
          !s.startsWith('--') &&
          /\b(INSERT|UPDATE|DELETE)\b/i.test(s)
        );
      });

    for (const stmt of sampleStatements) {
      try {
        await connection.query(stmt);
      } catch (err) {
        // Ignore duplicate entry errors (data already exists)
        if (err.code !== 'ER_DUP_ENTRY') {
          console.warn('⚠️  Warning:', err.message);
        }
      }
    }
    console.log('✅ Sample data inserted\n');

    // Display test credentials
    console.log('🎉 Database initialization complete!\n');
    console.log('═══════════════════════════════════════');
    console.log('TEST CREDENTIALS');
    console.log('═══════════════════════════════════════');
    console.log('\n🔐 Admin Login:');
    console.log('   Email: admin@spist.edu');
    console.log('   Password: admin123\n');
    console.log('👤 Student Login:');
    console.log('   Student ID: STD-2024-001');
    console.log('   Password: student123\n');
    console.log('   OR');
    console.log('   Email: juan.delacruz@spist.edu');
    console.log('   Password: student123\n');
    console.log('═══════════════════════════════════════');
    console.log('\n⚠️  IMPORTANT: Change these passwords in production!\n');

    await connection.end();
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

// Run initialization
initializeDatabase();
