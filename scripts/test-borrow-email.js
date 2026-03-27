const { sendBorrowingClaimEmailForBorrowings } = require('../src/services/borrowService');
const db = require('../src/utils/db');

db.query('SELECT id, claim_expires_at FROM book_borrowings WHERE student_id = ? ORDER BY id DESC LIMIT 1', ['C22-4587-01'])
  .then(rows => {
    if (!rows.length) { console.log('No borrowings found for C22-4587-01'); process.exit(0); }
    const row = rows[0];
    const expires = row.claim_expires_at ? new Date(row.claim_expires_at) : new Date(Date.now() + 24 * 60 * 60 * 1000);
    console.log('Testing with borrowing ID:', row.id, '| Expires:', expires.toISOString());
    return sendBorrowingClaimEmailForBorrowings('C22-4587-01', [row.id], expires);
  })
  .then(status => {
    console.log('Email result:', JSON.stringify(status));
    process.exit(status.success ? 0 : 1);
  })
  .catch(e => {
    console.error('ERROR:', e.message);
    process.exit(1);
  });
