const mysql = require('mysql2/promise');

const config = {
  host: 'tramway.proxy.rlwy.net',
  port: 32416,
  user: 'root',
  password: 'IMvoNFLYLMIcDtdWybJxaBjCFbebbgxJ',
  database: 'railway',
  multipleStatements: true
};

async function fixNotificationTables() {
  const conn = await mysql.createConnection(config);
  console.log('Connected\n');

  // Drop and recreate notifications with all required columns
  console.log('Recreating notifications table...');
  await conn.query(`DROP TABLE IF EXISTS notifications`);
  await conn.query(`
    CREATE TABLE notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_type ENUM('student','admin') NOT NULL,
      user_id VARCHAR(50) NOT NULL,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      is_read TINYINT(1) DEFAULT 0,
      related_table VARCHAR(100) DEFAULT NULL,
      related_id INT DEFAULT NULL,
      link_type VARCHAR(50) DEFAULT NULL,
      link_id VARCHAR(50) DEFAULT NULL,
      link_url VARCHAR(500) DEFAULT NULL,
      target_type VARCHAR(50) DEFAULT NULL,
      target_id VARCHAR(50) DEFAULT NULL,
      book_id INT DEFAULT NULL,
      book_title VARCHAR(255) DEFAULT NULL,
      borrowing_id INT DEFAULT NULL,
      due_date DATETIME DEFAULT NULL,
      status VARCHAR(50) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (user_type, user_id),
      INDEX idx_read (is_read),
      INDEX idx_created (created_at)
    )
  `);
  console.log('✓ notifications table recreated');

  // Drop and recreate notification_preferences with all required columns
  console.log('Recreating notification_preferences table...');
  await conn.query(`DROP TABLE IF EXISTS notification_preferences`);
  await conn.query(`
    CREATE TABLE notification_preferences (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_type ENUM('student','admin') NOT NULL,
      user_id VARCHAR(50) NOT NULL,
      enable_in_app TINYINT(1) DEFAULT 1,
      enable_realtime TINYINT(1) DEFAULT 1,
      enable_email TINYINT(1) DEFAULT 1,
      enable_due_reminders TINYINT(1) DEFAULT 1,
      reminder_days_before INT DEFAULT 2,
      quiet_hours_start TIME DEFAULT NULL,
      quiet_hours_end TIME DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user (user_type, user_id)
    )
  `);
  console.log('✓ notification_preferences table recreated');

  // Verify
  const [tables] = await conn.query('SHOW TABLES');
  console.log('\nAll tables:', tables.map(r => Object.values(r)[0]).join(', '));

  await conn.end();
  console.log('\n✅ Done! Notification tables fixed.');
}

fixNotificationTables().catch(e => { console.error('Error:', e.message); process.exit(1); });
