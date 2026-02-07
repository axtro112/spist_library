const db = require('./src/config/database');

db.query('UPDATE admins SET role = ? WHERE email = ?', ['super_admin', 'hahacctmo145@gmail.com'], (err) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  
  db.query('SELECT id, fullname, email, role FROM admins WHERE email = ?', ['hahacctmo145@gmail.com'], (err2, results) => {
    if (err2) {
      console.error('Error:', err2);
      process.exit(1);
    }
    
    console.log('\n✓ Account successfully updated to super_admin!\n');
    console.log('Updated account details:');
    console.log(JSON.stringify(results[0], null, 2));
    console.log('\nYou can now refresh your browser and login again to see Super Admin access.\n');
    process.exit(0);
  });
});
