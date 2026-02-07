const db = require('./src/config/database');

(async () => {
  try {
    const admins = await db.query('SELECT id, fullname, email, role, created_at FROM admins ORDER BY id');
    console.log('\n=== ALL ADMINS IN DATABASE ===\n');
    console.table(admins);
    
    console.log('\n=== ROLE BREAKDOWN ===');
    const superAdmins = admins.filter(a => a.role === 'super_admin');
    const systemAdmins = admins.filter(a => a.role === 'system_admin');
    
    console.log(`Super Admins: ${superAdmins.length}`);
    superAdmins.forEach(a => console.log(`  - ${a.fullname} (${a.email})`));
    
    console.log(`\nSystem Admins: ${systemAdmins.length}`);
    systemAdmins.forEach(a => console.log(`  - ${a.fullname} (${a.email})`));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    db.end();
  }
})();