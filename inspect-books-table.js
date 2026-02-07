const db = require('./src/config/database');

(async () => {
  try {
    const query = 'SELECT * FROM books';
    const books = await db.query(query);
    console.log('Books table contents:', books);
  } catch (error) {
    console.error('Error inspecting books table:', error.message);
  } finally {
    db.end();
  }
})();