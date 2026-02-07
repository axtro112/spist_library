/**
 * CREATE BOOK COPIES FOR EXISTING BOOKS
 * 
 * This script automatically generates book_copies entries for all books
 * that don't have copies yet. Each book will get copies equal to its quantity.
 */

const db = require('./src/config/database');

async function createBookCopies() {
  try {
    console.log('Starting book copies generation...\n');
    
    // Get all books
    const books = await db.query(`
      SELECT id, title, quantity, available_quantity 
      FROM books 
      WHERE status = 'available'
      ORDER BY id
    `);
    
    console.log(`Found ${books.length} books\n`);
    
    let totalCopiesCreated = 0;
    let booksProcessed = 0;
    
    for (const book of books) {
      // Check if book already has copies
      const existingCopies = await db.query(
        'SELECT COUNT(*) as count FROM book_copies WHERE book_id = ?',
        [book.id]
      );
      
      const existingCount = existingCopies[0].count;
      
      if (existingCount >= book.quantity) {
        console.log(`✓ Book "${book.title}" already has ${existingCount} copies - skipping`);
        continue;
      }
      
      // Calculate how many copies to create
      const copiesToCreate = book.quantity - existingCount;
      
      console.log(`\n📚 Creating ${copiesToCreate} copies for: "${book.title}"`);
      console.log(`   Book ID: ${book.id}, Quantity: ${book.quantity}, Existing: ${existingCount}`);
      
      // Create copies
      for (let i = existingCount + 1; i <= book.quantity; i++) {
        const accessionNumber = `ACC-${String(book.id).padStart(4, '0')}-${String(i).padStart(3, '0')}`;
        
        await db.query(`
          INSERT INTO book_copies (
            book_id, 
            accession_number, 
            copy_number, 
            status, 
            condition_status,
            location,
            acquisition_date
          ) VALUES (?, ?, ?, 'available', 'good', 'Main Library', NOW())
        `, [book.id, accessionNumber, i]);
        
        totalCopiesCreated++;
        process.stdout.write(`   Creating copy ${i}/${book.quantity}: ${accessionNumber}\r`);
      }
      
      console.log(`\n   ✓ Created ${copiesToCreate} copies`);
      booksProcessed++;
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ BOOK COPIES GENERATION COMPLETE');
    console.log('='.repeat(60));
    console.log(`Books processed: ${booksProcessed}`);
    console.log(`Total copies created: ${totalCopiesCreated}`);
    console.log('='.repeat(60));
    
    // Show summary
    const summary = await db.query(`
      SELECT 
        COUNT(DISTINCT book_id) as total_books,
        COUNT(*) as total_copies,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available_copies,
        SUM(CASE WHEN status = 'borrowed' THEN 1 ELSE 0 END) as borrowed_copies
      FROM book_copies
    `);
    
    console.log('\nDATABASE SUMMARY:');
    console.log(`Total books with copies: ${summary[0].total_books}`);
    console.log(`Total copies in system: ${summary[0].total_copies}`);
    console.log(`Available copies: ${summary[0].available_copies}`);
    console.log(`Borrowed copies: ${summary[0].borrowed_copies}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
createBookCopies();
