const db = require('./src/config/database');

const query = `
  SELECT 
    b.id,
    b.title,
    b.quantity,
    b.available_quantity,
    b.status,
    COUNT(bb.id) as active_borrowings
  FROM books b
  LEFT JOIN book_borrowings bb ON b.id = bb.book_id 
    AND bb.return_date IS NULL 
    AND bb.status IN ('borrowed', 'overdue')
  GROUP BY b.id
  ORDER BY b.id;
`;

db.query(query, (err, results) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  
  console.log('\n Current Books Status:\n');
  console.log('ID | Title                    | Total | Available | Status | Active Borrowings');
  console.log('---|--------------------------|-------|-----------|--------|------------------');
  
  results.forEach(book => {
    const total = String(book.quantity || 0).padEnd(5);
    const avail = String(book.available_quantity || 0).padEnd(9);
    const borr = String(book.active_borrowings).padEnd(17);
    const title = book.title.substring(0, 24).padEnd(24);
    
    console.log(`${book.id}  | ${title} | ${total} | ${avail} | ${book.status.padEnd(6)} | ${borr}`);
    
    // Check for mismatch
    const expected_available = book.quantity - book.active_borrowings;
    if (book.available_quantity !== expected_available) {
      console.log(`     MISMATCH! Available should be ${expected_available} (${book.quantity} - ${book.active_borrowings})`);
    }
  });
  
  console.log('\n Fix available quantities? (y/n)');
  
  db.end();
  process.exit(0);
});
