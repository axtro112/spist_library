const db = require('./src/config/database');

async function checkAndCreateCopies() {
  try {
    // Check books
    const books = await db.query("SELECT COUNT(*) as count FROM books WHERE status = 'active'");
    console.log(`Active books in database: ${books[0].count}\n`);
    
    if (books[0].count === 0) {
      console.log('❌ No active books found! Please add books first.');
      process.exit(1);
    }
    
    // Get sample books
    const sampleBooks = await db.query("SELECT id, title, quantity FROM books WHERE status = 'active' LIMIT 5");
    console.log('Sample books:');
    sampleBooks.forEach(b => console.log(`  - ID ${b.id}: "${b.title}" (qty: ${b.quantity})`));
    
    // Check existing copies
    const copies = await db.query('SELECT COUNT(*) as count FROM book_copies');
    console.log(`\nExisting book copies: ${copies[0].count}\n`);
    
    if (copies[0].count > 0) {
      console.log('✓ Book copies already exist!');
      process.exit(0);
    }
    
    // Create copies for all books
    const allBooks = await db.query("SELECT id, title, quantity FROM books WHERE status = 'active' ORDER BY id");
    let totalCreated = 0;
    
    console.log(`\nCreating copies for ${allBooks.length} books...\n`);
    
    for (const book of allBooks) {
      for (let i = 1; i <= book.quantity; i++) {
        const accessionNumber = `ACC-${String(book.id).padStart(4, '0')}-${String(i).padStart(3, '0')}`;
        
        await db.query(`
          INSERT INTO book_copies (
            book_id, accession_number, copy_number, status, 
            condition_status, location, date_acquired
          ) VALUES (?, ?, ?, 'available', 'good', 'Main Library', NOW())
        `, [book.id, accessionNumber, i]);
        
        totalCreated++;
      }
      console.log(`✓ Created ${book.quantity} copies for: ${book.title}`);
    }
    
    console.log(`\n✅ SUCCESS! Created ${totalCreated} book copies total.`);
    
    db.end();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkAndCreateCopies();
