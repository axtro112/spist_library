const db = require('./src/config/database');

db.query('DESCRIBE book_copies').then(cols => {
  console.log('book_copies table columns:');
  cols.forEach(c => console.log(`  - ${c.Field} (${c.Type})`));
  db.end();
}).catch(err => {
  console.error('Error:', err.message);
  db.end();
});
