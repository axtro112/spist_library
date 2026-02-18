const mysql = require('mysql2/promise');

const connection = {
  host: 'tramway.proxy.rlwy.net',
  port: 32416,
  user: 'root',
  password: 'IMvoNFLYLMIcDtdWybJxaBjCFbebbgxJ',
  database: 'spist_library_primary'
};

async function createSessionsTable() {
  let conn;
  try {
    console.log('Connecting to Railway MySQL database...');
    conn = await mysql.createConnection(connection);
    console.log('✓ Connected successfully\n');

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS sessions (
        session_id VARCHAR(128) COLLATE utf8mb4_bin PRIMARY KEY,
        expires INT(11) UNSIGNED NOT NULL,
        data MEDIUMTEXT COLLATE utf8mb4_bin,
        INDEX expires (expires)
      )
    `;

    console.log('Creating sessions table...');
    await conn.query(createTableSQL);
    console.log('✓ Sessions table created successfully\n');

    // Verify the table
    const [rows] = await conn.query('SHOW TABLES');
    const tables = rows.map(r => Object.values(r)[0]);
    console.log('Database tables:', tables);

    await conn.end();
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

createSessionsTable();
