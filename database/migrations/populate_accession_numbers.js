/**
 * ACCESSION NUMBER POPULATION SCRIPT
 * 
 * Purpose: Generate individual copies with accession numbers for all existing books
 * Run ONCE after creating book_copies table
 * 
 * What it does:
 * 1. Reads all books from the books table
 * 2. For each book with quantity > 0, creates individual copies
 * 3. Generates sequential accession numbers (ACC-2026-00001, ACC-2026-00002, etc.)
 * 4. Sets initial condition based on book age
 * 5. Links existing borrowings to specific copies
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spist_library',
  multipleStatements: true
};

async function populateAccessionNumbers() {
  let connection;
  
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    
    // Step 1: Get current year and starting sequence
    const currentYear = new Date().getFullYear();
    const [seqRows] = await connection.query(
      'SELECT last_sequence FROM accession_sequence WHERE year = ?',
      [currentYear]
    );
    
    let sequence = seqRows.length > 0 ? seqRows[0].last_sequence : 0;
    console.log(`📅 Starting with sequence: ${sequence + 1} for year ${currentYear}\n`);
    
    // Step 2: Get all books with their quantities
    const [books] = await connection.query(`
      SELECT id, title, author, quantity, added_date, status 
      FROM books 
      WHERE status = 'active' AND quantity > 0
      ORDER BY id ASC
    `);
    
    console.log(`📚 Found ${books.length} books to process\n`);
    
    let totalCopies = 0;
    const insertedCopies = [];
    
    // Step 3: Generate copies for each book
    for (const book of books) {
      const copies = book.quantity;
      console.log(`\n📖 Processing: "${book.title}" (ID: ${book.id})`);
      console.log(`   Creating ${copies} cop${copies === 1 ? 'y' : 'ies'}...`);
      
      for (let copyNum = 1; copyNum <= copies; copyNum++) {
        sequence++;
        const accessionNumber = `ACC-${currentYear}-${String(sequence).padStart(5, '0')}`;
        
        // Determine initial condition based on book age
        const bookAge = Math.floor((new Date() - new Date(book.added_date)) / (1000 * 60 * 60 * 24 * 365));
        let condition = 'excellent';
        if (bookAge > 5) condition = 'fair';
        else if (bookAge > 2) condition = 'good';
        
        // Insert the copy
        await connection.query(`
          INSERT INTO book_copies 
          (accession_number, book_id, copy_number, condition_status, acquisition_date, status)
          VALUES (?, ?, ?, ?, ?, 'available')
        `, [accessionNumber, book.id, copyNum, condition, book.added_date]);
        
        insertedCopies.push({
          accessionNumber,
          bookId: book.id,
          copyNumber: copyNum
        });
        
        totalCopies++;
        console.log(`   ✅ ${accessionNumber} - Copy ${copyNum} (${condition})`);
      }
    }
    
    // Step 4: Update accession sequence
    await connection.query(
      'UPDATE accession_sequence SET last_sequence = ? WHERE year = ?',
      [sequence, currentYear]
    );
    
    console.log(`\n\n✨ Successfully created ${totalCopies} accession records!`);
    console.log(`📊 Next accession number will be: ACC-${currentYear}-${String(sequence + 1).padStart(5, '0')}`);
    
    // Step 5: Link existing borrowings to copies (first available copy)
    console.log('\n\n🔗 Linking existing borrowings to copies...');
    
    const [borrowings] = await connection.query(`
      SELECT bb.id, bb.book_id 
      FROM book_borrowings bb
      WHERE bb.status IN ('borrowed', 'overdue', 'pending')
      AND bb.return_date IS NULL
      AND bb.accession_number IS NULL
    `);
    
    console.log(`Found ${borrowings.length} active borrowings to link`);
    
    for (const borrowing of borrowings) {
      // Find first available copy for this book
      const [availableCopy] = await connection.query(`
        SELECT accession_number 
        FROM book_copies 
        WHERE book_id = ? AND status = 'available'
        LIMIT 1
      `, [borrowing.book_id]);
      
      if (availableCopy.length > 0) {
        const accNum = availableCopy[0].accession_number;
        
        // Update borrowing with accession number
        await connection.query(
          'UPDATE book_borrowings SET accession_number = ? WHERE id = ?',
          [accNum, borrowing.id]
        );
        
        // Mark copy as borrowed
        await connection.query(
          "UPDATE book_copies SET status = 'borrowed' WHERE accession_number = ?",
          [accNum]
        );
        
        console.log(`   ✅ Linked borrowing ${borrowing.id} to ${accNum}`);
      }
    }
    
    // Step 6: Verification
    console.log('\n\n🔍 VERIFICATION:\n');
    
    const [copyCount] = await connection.query('SELECT COUNT(*) as total FROM book_copies');
    console.log(`✓ Total copies created: ${copyCount[0].total}`);
    
    const [statusBreakdown] = await connection.query(`
      SELECT status, COUNT(*) as count 
      FROM book_copies 
      GROUP BY status
    `);
    console.log('\n✓ Status breakdown:');
    statusBreakdown.forEach(row => {
      console.log(`   - ${row.status}: ${row.count}`);
    });
    
    const [conditionBreakdown] = await connection.query(`
      SELECT condition_status, COUNT(*) as count 
      FROM book_copies 
      GROUP BY condition_status
    `);
    console.log('\n✓ Condition breakdown:');
    conditionBreakdown.forEach(row => {
      console.log(`   - ${row.condition_status}: ${row.count}`);
    });
    
    // Step 7: Generate sample report
    console.log('\n\n📋 SAMPLE ACCESSION RECORDS:\n');
    const [samples] = await connection.query(`
      SELECT 
        bc.accession_number,
        b.title,
        bc.copy_number,
        bc.condition_status,
        bc.status
      FROM book_copies bc
      JOIN books b ON bc.book_id = b.id
      LIMIT 10
    `);
    
    console.log('Accession #        | Title                          | Copy | Condition | Status');
    console.log('-------------------|--------------------------------|------|-----------|----------');
    samples.forEach(row => {
      const title = row.title.substring(0, 30).padEnd(30);
      console.log(`${row.accession_number} | ${title} | #${row.copy_number}   | ${row.condition_status.padEnd(9)} | ${row.status}`);
    });
    
    console.log('\n\n🎉 ACCESSION NUMBER SYSTEM SUCCESSFULLY DEPLOYED!\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the script
populateAccessionNumbers();
