const db = require('./src/config/database');

(async () => {
  try {
    console.log('=== Testing Books Quantity Sum ===\n');
    
    // Test the OLD (broken) dashboard query
    const oldQuery = "SELECT COALESCE(SUM(quantity), 0) as count FROM books WHERE status = 'active'";
    console.log('OLD Dashboard Query (broken):', oldQuery);
    const oldResult = await db.query(oldQuery);
    console.log('OLD Result:', oldResult[0]?.count, '\n');
    
    // Test the NEW (fixed) dashboard query
    const newQuery = "SELECT COALESCE(SUM(quantity), 0) as count FROM books WHERE status IN ('available', 'borrowed', 'maintenance')";
    console.log('NEW Dashboard Query (fixed):', newQuery);
    const newResult = await db.query(newQuery);
    console.log('NEW Result:', newResult[0]?.count, '\n');
    
    // Get individual book quantities
    const booksQuery = "SELECT id, title, quantity, available_quantity, status FROM books WHERE status IN ('available', 'borrowed', 'maintenance') ORDER BY id";
    const books = await db.query(booksQuery);
    console.log('Individual Books:');
    let manualSum = 0;
    books.forEach(book => {
      console.log(`  ID ${book.id}: "${book.title}" - Quantity: ${book.quantity}, Available: ${book.available_quantity}, Status: ${book.status}`);
      manualSum += book.quantity;
    });
    console.log('\nManual sum of quantities:', manualSum);
    console.log('Total books found:', books.length);
    
    // Check for any non-active books
    const allBooksQuery = "SELECT status, COUNT(*) as count, SUM(quantity) as total_qty FROM books GROUP BY status";
    const allBooks = await db.query(allBooksQuery);
    console.log('\nBooks by status:');
    allBooks.forEach(row => {
      console.log(`  Status "${row.status}": ${row.count} books, Total Quantity: ${row.total_qty}`);
    });
    
    // Verify the fix
    console.log('\n=== VERIFICATION ===');
    console.log('Expected total (manual sum):', manualSum);
    console.log('NEW query result:', newResult[0]?.count);
    console.log('Match:', manualSum == newResult[0]?.count ? '✓ SUCCESS' : '✗ FAILED');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    db.end();
  }
})();
