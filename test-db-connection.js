const db = require('./src/config/database');

(async () => {
  try {
    const result = await db.query('SELECT 1 + 1 AS solution');
    console.log('Database connection successful! Test query result:', result);
  } catch (error) {
    console.error('Database connection failed:', error.message);
  } finally {
    db.end();
  }
})();