const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'spist_library',
    port: parseInt(process.env.DB_PORT || 3306),
  });

  const migrations = [
    {
      name: 'claim_expires_at',
      sql: "ALTER TABLE `book_borrowings` ADD COLUMN `claim_expires_at` DATETIME NULL COMMENT 'Deadline to claim borrowed books' AFTER `due_date`"
    },
    {
      name: 'email_sent_at',
      sql: "ALTER TABLE `book_borrowings` ADD COLUMN `email_sent_at` DATETIME NULL AFTER `claim_expires_at`"
    }
  ];

  for (const m of migrations) {
    const [rows] = await conn.execute(
      `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'book_borrowings' AND COLUMN_NAME = ?`,
      [m.name]
    );
    if (rows[0].cnt === 0) {
      await conn.execute(m.sql);
      console.log('Added column:', m.name);
    } else {
      console.log('Already exists:', m.name);
    }
  }

  const [cols] = await conn.execute('SHOW COLUMNS FROM book_borrowings');
  console.log('Columns now:', cols.map(r => r.Field).join(', '));
  await conn.end();
}

runMigration().catch(console.error);
