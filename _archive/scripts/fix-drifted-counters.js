/**
 * Fix drifted available_quantity counters:
 * Sets available_quantity = quantity - COUNT(active borrowings) for each book
 * Safe to run multiple times (idempotent).
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'spist_library'
  });

  console.log('Fixing drifted available_quantity counters...');

  const [result] = await c.query(`
    UPDATE books b
    SET b.available_quantity = GREATEST(
      0,
      b.quantity - (
        SELECT COUNT(*)
        FROM book_borrowings bb
        WHERE bb.book_id = b.id
          AND bb.status IN ('borrowed', 'overdue')
          AND bb.return_date IS NULL
      )
    )
    WHERE b.deleted_at IS NULL
  `);

  console.log(`Updated ${result.affectedRows} book(s).`);

  // Verify
  const [check] = await c.query(`
    SELECT b.id, b.title, b.quantity, b.available_quantity,
      COUNT(bb.id) AS active_borrowings,
      b.quantity - COUNT(bb.id) AS expected_available
    FROM books b
    LEFT JOIN book_borrowings bb
      ON bb.book_id = b.id
      AND bb.status IN ('borrowed', 'overdue')
      AND bb.return_date IS NULL
    WHERE b.deleted_at IS NULL
    GROUP BY b.id
    HAVING b.available_quantity != (b.quantity - COUNT(bb.id))
  `);

  if (check.length === 0) {
    console.log('All counters are now correct.');
  } else {
    console.warn('Still drifted:', check);
  }

  await c.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
