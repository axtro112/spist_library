/**
 * Fix book_copies: populate entries for all books using correct column names
 * Run: node fix-book-copies.js
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

async function fix() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'spist_library',
    port: parseInt(process.env.DB_PORT || 3306),
  });

  try {
    const currentYear = new Date().getFullYear();

    // Get or init sequence
    const [seqRows] = await conn.execute(
      'SELECT last_sequence FROM accession_sequence WHERE year = ?', [currentYear]
    );
    let sequence = seqRows.length > 0 ? seqRows[0].last_sequence : 0;

    // Get all books (status = 'available' is the actual value in this DB)
    const [books] = await conn.execute(
      `SELECT id, title, available_quantity, added_date FROM books WHERE available_quantity > 0 ORDER BY id`
    );

    console.log(`\n📚 Found ${books.length} books to populate copies for.\n`);

    let totalCreated = 0;

    for (const book of books) {
      // Skip if copies already exist
      const [existing] = await conn.execute(
        'SELECT COUNT(*) as cnt FROM book_copies WHERE book_id = ?', [book.id]
      );
      if (existing[0].cnt > 0) {
        console.log(`⏭  Skipping "${book.title}" — already has ${existing[0].cnt} copies`);
        continue;
      }

      const qty = book.available_quantity;
      const addedDate = book.added_date || new Date().toISOString().split('T')[0];
      const bookAge = Math.floor((Date.now() - new Date(addedDate)) / (1000*60*60*24*365));
      const condition = bookAge > 5 ? 'fair' : bookAge > 2 ? 'good' : 'excellent';

      for (let i = 1; i <= qty; i++) {
        sequence++;
        const accNum = `ACC-${currentYear}-${String(sequence).padStart(5,'0')}`;
        await conn.execute(
          `INSERT INTO book_copies (accession_number, book_id, copy_number, condition_status, acquisition_date, status)
           VALUES (?, ?, ?, ?, ?, 'available')`,
          [accNum, book.id, i, condition, addedDate]
        );
      }

      console.log(`✅ "${book.title}" — created ${qty} cop${qty===1?'y':'ies'}`);
      totalCreated += qty;
    }

    // Update sequence table
    await conn.execute(
      `INSERT INTO accession_sequence (year, last_sequence) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE last_sequence = ?`,
      [currentYear, sequence, sequence]
    );

    console.log(`\n🎉 Done! Created ${totalCreated} total copies across all books.`);

    // Verify
    const [summary] = await conn.execute(
      `SELECT b.id, b.title, b.available_quantity,
         COUNT(bc.accession_number) AS copies_in_table,
         SUM(bc.status='available') AS available
       FROM books b LEFT JOIN book_copies bc ON bc.book_id=b.id
       GROUP BY b.id ORDER BY b.id`
    );
    console.log('\n📊 Verification:');
    console.log('ID | qty | in_table | available | title');
    summary.forEach(r =>
      console.log(`${r.id}  | ${r.available_quantity}   | ${r.copies_in_table}        | ${r.available}         | ${r.title}`)
    );

  } finally {
    await conn.end();
  }
}

fix().catch(console.error);
