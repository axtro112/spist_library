const db = require('./src/config/database');

(async () => {
  try {
    const query = `
      SELECT b.*, a.fullname as added_by_name,
        CASE WHEN b.available_quantity > 0 THEN 1 ELSE 0 END as is_available
      FROM books b
      LEFT JOIN admins a ON b.added_by = a.id
      WHERE b.status = 'active'
      ORDER BY b.title ASC
    `;
    const books = await db.query(query);
    console.log('Books fetched:', books);
  } catch (error) {
    console.error('Error fetching books:', error.message);
  } finally {
    db.end();
  }
})();