const db = require('./src/config/database');

db.query('SHOW TABLES LIKE "notification%"', (err, results) => {
  if (err) {
    console.error('Error:', err);
    db.end();
    return;
  }
  
  console.log('\n✓ Tables created:');
  results.forEach(row => {
    const tableName = row[Object.keys(row)[0]];
    console.log(`  - ${tableName}`);
  });
  
  db.query('SELECT COUNT(*) as count FROM notification_preferences', (err2, result2) => {
    if (!err2) {
      console.log(`\n✓ Default preferences created for ${result2[0].count} users`);
    }
    db.end();
  });
});
