require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'spist_library'
  });

  console.log('\n=== Active borrowings vs book quantity ===');
  const [active] = await c.query(`
    SELECT bb.id, bb.status, bb.book_id, b.title, b.available_quantity, b.quantity,
      CASE WHEN b.available_quantity >= b.quantity THEN 'DRIFTED' ELSE 'OK' END AS counter_state
    FROM book_borrowings bb
    LEFT JOIN books b ON bb.book_id = b.id
    WHERE bb.status IN ('borrowed','overdue') AND bb.return_date IS NULL
  `);
  console.table(active);

  console.log('\n=== Drifted records (available_quantity >= quantity while still borrowed) ===');
  const drifted = active.filter(r => r.counter_state === 'DRIFTED');
  console.log(drifted.length, 'drifted record(s) found');
  if (drifted.length) console.table(drifted);

  console.log('\n=== Orphan borrowings (book deleted) ===');
  const [orphans] = await c.query(`
    SELECT bb.id, bb.status, bb.book_id, bb.return_date
    FROM book_borrowings bb
    LEFT JOIN books b ON bb.book_id = b.id
    WHERE b.id IS NULL OR b.deleted_at IS NOT NULL
  `);
  console.table(orphans.length ? orphans : [{ result: 'No orphans found' }]);

  await c.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
