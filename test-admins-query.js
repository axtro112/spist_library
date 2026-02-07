const db = require('./src/config/database');

(async () => {
  try {
    const query = 'SELECT id, fullname, email, role, created_at FROM admins';
    const admins = await db.query(query);
    console.log('Admins table contents:', admins);
  } catch (error) {
    console.error('Error inspecting admins table:', error.message);
  } finally {
    db.end();
  }
})();