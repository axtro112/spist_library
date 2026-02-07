const db = require('./src/utils/db');
const dbConnection = require('./src/config/database');

async function setupTestBooks() {
  try {
    // Check current books
    const allBooks = await db.query('SELECT COUNT(*) as count FROM books');
    const availableBooks = await db.query('SELECT COUNT(*) as count FROM books WHERE status = "active" AND available_quantity > 0');
    
    console.log(`Total books: ${allBooks[0].count}`);
    console.log(`Available books: ${availableBooks[0].count}\n`);
    
    if (availableBooks[0].count < 4) {
      console.log('Creating test books...\n');
      
      const testBooks = [
        { title: 'Test Book 1 - Overdue', author: 'Test Author', isbn: 'TEST-001', category: 'Fiction' },
        { title: 'Test Book 2 - Due Today', author: 'Test Author', isbn: 'TEST-002', category: 'Science' },
        { title: 'Test Book 3 - Due Soon', author: 'Test Author', isbn: 'TEST-003', category: 'History' },
        { title: 'Test Book 4 - Normal', author: 'Test Author', isbn: 'TEST-004', category: 'Technology' }
      ];
      
      for (const book of testBooks) {
        const result = await db.query(`
          INSERT INTO books (title, author, isbn, category, quantity, available_quantity, status)
          VALUES (?, ?, ?, ?, 1, 1, 'active')
        `, [book.title, book.author, book.isbn, book.category]);
        
        console.log(`✓ Created: ${book.title} (ID: ${result.insertId})`);
      }
      
      console.log('\n✅ Test books created!');
    } else {
      console.log('✓ Sufficient books available');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    dbConnection.end();
  }
}

setupTestBooks();
