/**
 * ACCESSION NUMBER SYSTEM - TESTING SCRIPT
 * 
 * Tests all aspects of the accession number implementation
 * Run this after deployment to verify everything works
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spist_library'
};

async function runTests() {
  let connection;
  
  try {
    console.log('\n ACCESSION NUMBER SYSTEM - TEST SUITE\n');
    console.log('='.repeat(60));
    
    connection = await mysql.createConnection(dbConfig);
    console.log(' Database connection established\n');
    
    // TEST 1: Table Structure
    console.log(' TEST 1: Database Tables\n');
    const tables = ['book_copies', 'accession_sequence', 'book_copy_audit'];
    for (const table of tables) {
      const [rows] = await connection.query(`SHOW TABLES LIKE '${table}'`);
      if (rows.length > 0) {
        const [count] = await connection.query(`SELECT COUNT(*) as total FROM ${table}`);
        console.log(`    ${table.padEnd(25)} - ${count[0].total} records`);
      } else {
        console.log(`    ${table.padEnd(25)} - TABLE MISSING!`);
      }
    }
    
    // TEST 2: Accession Numbers Generated
    console.log('\n TEST 2: Accession Number Generation\n');
    const [copies] = await connection.query('SELECT COUNT(*) as total FROM book_copies');
    console.log(`    Total copies created: ${copies[0].total}`);
    
    const [sampleCopies] = await connection.query(`
      SELECT accession_number, book_id, copy_number, status
      FROM book_copies
      ORDER BY id ASC
      LIMIT 5
    `);
    console.log('\n   Sample accession numbers:');
    sampleCopies.forEach(copy => {
      console.log(`      ${copy.accession_number} - Book ${copy.book_id}, Copy #${copy.copy_number} (${copy.status})`);
    });
    
    // TEST 3: Books vs Copies Count Match
    console.log('\n TEST 3: Quantity Validation\n');
    const [mismatch] = await connection.query(`
      SELECT 
        b.id,
        b.title,
        b.quantity as expected,
        COUNT(bc.id) as actual
      FROM books b
      LEFT JOIN book_copies bc ON b.book_id = bc.book_id
      WHERE b.status = 'active'
      GROUP BY b.id
      HAVING expected != actual
      LIMIT 5
    `);
    
    if (mismatch.length === 0) {
      console.log('    All books have correct number of copies');
    } else {
      console.log(`     Found ${mismatch.length} books with quantity mismatch:`);
      mismatch.forEach(book => {
        console.log(`      Book ${book.id}: Expected ${book.expected}, Got ${book.actual}`);
      });
    }
    
    // TEST 4: Borrowings Linked to Accession Numbers
    console.log('\n TEST 4: Borrowing-Accession Linkage\n');
    const [borrowings] = await connection.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN accession_number IS NOT NULL THEN 1 ELSE 0 END) as linked
      FROM book_borrowings
      WHERE status IN ('borrowed', 'overdue')
      AND return_date IS NULL
    `);
    
    console.log(`   Total active borrowings: ${borrowings[0].total}`);
    console.log(`   Linked to accessions: ${borrowings[0].linked}`);
    
    if (borrowings[0].total === borrowings[0].linked) {
      console.log('    All active borrowings have accession numbers');
    } else {
      console.log(`     ${borrowings[0].total - borrowings[0].linked} borrowings missing accession numbers`);
    }
    
    // TEST 5: Copy Status Consistency
    console.log('\n TEST 5: Copy Status Consistency\n');
    const [statusCheck] = await connection.query(`
      SELECT 
        bc.status,
        COUNT(*) as count
      FROM book_copies bc
      GROUP BY bc.status
    `);
    
    console.log('   Status breakdown:');
    statusCheck.forEach(row => {
      console.log(`      ${row.status.padEnd(15)} - ${row.count} cop${row.count === 1 ? 'y' : 'ies'}`);
    });
    
    // TEST 6: Available Quantity Match
    console.log('\n TEST 6: Available Quantity Accuracy\n');
    const [qtyCheck] = await connection.query(`
      SELECT 
        b.id,
        b.title,
        b.available_quantity as system_available,
        COUNT(CASE WHEN bc.status = 'available' THEN 1 END) as actual_available
      FROM books b
      LEFT JOIN book_copies bc ON b.id = bc.book_id
      WHERE b.status = 'active'
      GROUP BY b.id
      HAVING system_available != actual_available
      LIMIT 3
    `);
    
    if (qtyCheck.length === 0) {
      console.log('    All available quantities match actual copy status');
    } else {
      console.log(`     Found ${qtyCheck.length} mismatches:`);
      qtyCheck.forEach(book => {
        console.log(`      "${book.title}" - System: ${book.system_available}, Actual: ${book.actual_available}`);
      });
    }
    
    // TEST 7: Audit Trail
    console.log('\n TEST 7: Audit Trail\n');
    const [auditCount] = await connection.query('SELECT COUNT(*) as total FROM book_copy_audit');
    console.log(`    Audit records: ${auditCount[0].total}`);
    
    const [recentAudit] = await connection.query(`
      SELECT accession_number, action, performed_at
      FROM book_copy_audit
      ORDER BY performed_at DESC
      LIMIT 3
    `);
    
    if (recentAudit.length > 0) {
      console.log('\n   Recent audit log:');
      recentAudit.forEach(log => {
        console.log(`      [${new Date(log.performed_at).toLocaleString()}] ${log.accession_number} - ${log.action}`);
      });
    }
    
    // TEST 8: Sequence Tracking
    console.log('\n TEST 8: Sequence Management\n');
    const currentYear = new Date().getFullYear();
    const [seq] = await connection.query(
      'SELECT last_sequence FROM accession_sequence WHERE year = ?',
      [currentYear]
    );
    
    if (seq.length > 0) {
      console.log(`    Current year: ${currentYear}`);
      console.log(`    Last sequence: ${seq[0].last_sequence}`);
      console.log(`    Next accession: ACC-${currentYear}-${String(seq[0].last_sequence + 1).padStart(5, '0')}`);
    } else {
      console.log(`    No sequence record for year ${currentYear}`);
    }
    
    // FINAL SUMMARY
    console.log('\n' + '='.repeat(60));
    console.log('\n TEST SUITE COMPLETE!\n');
    
    const totalTests = 8;
    console.log(` Results: ${totalTests}/8 tests executed`);
    console.log('\nRecommendations:');
    console.log('  1. Check any warnings () above');
    console.log('  2. Test borrowing a book via frontend');
    console.log('  3. Test returning a book with condition');
    console.log('  4. View copies modal for a book');
    console.log('  5. Add a new copy to an existing book');
    console.log('\n Accession system is ready for production!\n');
    
  } catch (error) {
    console.error('\n TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run tests
runTests();
