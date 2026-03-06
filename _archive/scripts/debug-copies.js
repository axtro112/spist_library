/**
 * Debug Book Copies Script
 * Run: node debug-copies.js [bookId]
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

const bookId = process.argv[2] || 6;

async function check() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'spist_library',
    port: parseInt(process.env.DB_PORT || 3306),
  });

  try {
    // Check the book
    const [book] = await conn.execute(
      'SELECT id, title, available_quantity FROM books WHERE id = ?', [bookId]
    );
    console.log(`\n📚 Book ID ${bookId}:`, book.length ? JSON.stringify(book[0]) : 'NOT FOUND');

    // Check its copies
    const [copies] = await conn.execute(
      'SELECT accession_number, copy_number, status, condition_status FROM book_copies WHERE book_id = ?', [bookId]
    );
    console.log(`\n📋 book_copies entries (${copies.length} total):`);
    if (copies.length === 0) {
      console.log('  ❌ NO COPIES in book_copies table — this is why borrowing fails!');
      console.log('\n🔧 To fix, run the populate script:');
      console.log('   node database/migrations/populate_accession_numbers.js');
    } else {
      copies.forEach(c => console.log(`  - ${c.accession_number} | copy #${c.copy_number} | status: ${c.status} | condition: ${c.condition_status}`));
      const available = copies.filter(c => c.status === 'available');
      console.log(`\n  Available copies: ${available.length}`);
      if (available.length === 0) {
        console.log('  ❌ ALL copies are marked as borrowed/maintenance — none available!');
        console.log('\n🔧 To reset all to available:');
        console.log(`   UPDATE book_copies SET status = 'available' WHERE book_id = ${bookId} AND status = 'borrowed';`);
      }
    }

    // Show all books summary
    const [allBooks] = await conn.execute(
      `SELECT b.id, b.title, b.available_quantity,
        COUNT(bc.accession_number) AS total_copies_in_table,
        SUM(bc.status = 'available') AS available_copies
       FROM books b
       LEFT JOIN book_copies bc ON bc.book_id = b.id
       GROUP BY b.id ORDER BY b.id`
    );
    console.log('\n📊 All books summary:');
    console.log('ID | available_qty | copies_in_table | available_copies | title');
    allBooks.forEach(b =>
      console.log(`${b.id}  | ${b.available_quantity}             | ${b.total_copies_in_table}               | ${b.available_copies}                | ${b.title}`)
    );

  } finally {
    await conn.end();
  }
}

check().catch(console.error);
