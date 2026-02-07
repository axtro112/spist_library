const db = require('./src/config/database');

(async () => {
  try {
    // Check total books
    const totalBooks = await db.query('SELECT COUNT(*) as count FROM books');
    console.log('Total books:', totalBooks[0].count);

    // Check books with status = 'available'
    const availableBooks = await db.query("SELECT COUNT(*) as count FROM books WHERE status = 'available'");
    console.log('Available books:', availableBooks[0].count);

    // Check books with categories
    const booksWithCategories = await db.query("SELECT COUNT(*) as count FROM books WHERE category IS NOT NULL AND category != ''");
    console.log('Books with categories:', booksWithCategories[0].count);

    // Get distinct categories
    const categories = await db.query("SELECT DISTINCT category FROM books WHERE status = 'available' AND category IS NOT NULL AND category != '' ORDER BY category ASC");
    console.log('\nCategories found:', categories.length);
    categories.forEach(cat => console.log('  -', cat.category));

    // Show sample books with their status and category
    const sampleBooks = await db.query("SELECT id, title, category, status FROM books LIMIT 10");
    console.log('\nSample books:');
    sampleBooks.forEach(book => {
      console.log(`  ID ${book.id}: "${book.title}" - Category: "${book.category}" - Status: "${book.status}"`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    db.end();
  }
})();
