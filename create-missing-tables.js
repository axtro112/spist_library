const mysql = require('mysql2/promise');

const config = {
  host: 'tramway.proxy.rlwy.net',
  port: 32416,
  user: 'root',
  password: 'IMvoNFLYLMIcDtdWybJxaBjCFbebbgxJ',
  database: 'railway',
  multipleStatements: true
};

async function createMissingTables() {
  const conn = await mysql.createConnection(config);
  console.log('Connected to railway database\n');

  const sql = `
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_type ENUM('student', 'admin') NOT NULL,
      user_id VARCHAR(50) NOT NULL,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      is_read TINYINT(1) DEFAULT 0,
      related_id INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (user_type, user_id),
      INDEX idx_read (is_read),
      INDEX idx_created (created_at)
    );

    CREATE TABLE IF NOT EXISTS notification_preferences (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_type ENUM('student', 'admin') NOT NULL,
      user_id VARCHAR(50) NOT NULL,
      email_notifications TINYINT(1) DEFAULT 1,
      push_notifications TINYINT(1) DEFAULT 1,
      due_date_reminder TINYINT(1) DEFAULT 1,
      overdue_reminder TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user (user_type, user_id)
    );

    CREATE TABLE IF NOT EXISTS book_copies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      book_id INT NOT NULL,
      accession_number VARCHAR(50) UNIQUE NOT NULL,
      copy_number INT NOT NULL DEFAULT 1,
      condition_status ENUM('good', 'fair', 'poor', 'damaged') DEFAULT 'good',
      is_available TINYINT(1) DEFAULT 1,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      INDEX idx_book (book_id),
      INDEX idx_available (is_available)
    );
  `;

  await conn.query(sql);
  console.log('✓ Created: notifications');
  console.log('✓ Created: notification_preferences');
  console.log('✓ Created: book_copies');

  const [rows] = await conn.query('SHOW TABLES');
  console.log('\nAll tables:', rows.map(r => Object.values(r)[0]).join(', '));

  await conn.end();
  console.log('\n✅ Done! All missing tables created.');
}

createMissingTables().catch(e => { console.error('Error:', e.message); process.exit(1); });
