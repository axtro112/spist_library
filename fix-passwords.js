const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

async function fixPasswords() {
  // Generate correct hashes
  const adminHash = await bcrypt.hash('admin123', 10);
  const studentHash = await bcrypt.hash('student123', 10);

  console.log('Generated admin hash:', adminHash);
  console.log('Generated student hash:', studentHash);

  // Verify they work
  const adminOk = await bcrypt.compare('admin123', adminHash);
  const studentOk = await bcrypt.compare('student123', studentHash);
  console.log('admin123 verifies:', adminOk);
  console.log('student123 verifies:', studentOk);

  // Update database
  const conn = await mysql.createConnection({
    host: 'tramway.proxy.rlwy.net',
    port: 32416,
    user: 'root',
    password: 'IMvoNFLYLMIcDtdWybJxaBjCFbebbgxJ',
    database: 'railway'
  });

  await conn.query('UPDATE admins SET password = ?', [adminHash]);
  console.log('\n✓ Updated all admin passwords to: admin123');

  await conn.query('UPDATE students SET password = ?', [studentHash]);
  console.log('✓ Updated all student passwords to: student123');

  const [[admin]] = await conn.query('SELECT email, password FROM admins LIMIT 1');
  const match = await bcrypt.compare('admin123', admin.password);
  console.log('\nVerification - admin@spist.edu with admin123:', match ? '✅ WORKS' : '❌ FAILED');

  await conn.end();
  console.log('\n✅ Done! Try logging in now.');
}

fixPasswords().catch(e => { console.error('Error:', e.message); process.exit(1); });
