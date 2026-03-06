/**
 * Fix Admin Password Script
 * This script finds admins with unhashed passwords and updates them with bcrypt hashes.
 */

const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixAdminPasswords() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'spist_library',
    port: parseInt(process.env.DB_PORT || 3306),
  });

  try {
    console.log('Connected to database.');

    // Fetch all admins
    const [admins] = await connection.execute('SELECT id, email, password FROM admins');

    for (const admin of admins) {
      const pwd = admin.password;

      // Check if password is already a bcrypt hash
      const isHashed = pwd && pwd.startsWith('$2b$') || (pwd && pwd.startsWith('$2a$'));

      if (!isHashed) {
        console.log(`Admin ID ${admin.id} (${admin.email}) has a plain text password. Hashing...`);
        const hashedPassword = await bcrypt.hash(pwd, 10);
        await connection.execute('UPDATE admins SET password = ? WHERE id = ?', [hashedPassword, admin.id]);
        console.log(`✅ Admin ID ${admin.id} password updated successfully.`);
      } else {
        console.log(`Admin ID ${admin.id} (${admin.email}) already has a hashed password. Skipping.`);
      }
    }

    console.log('\nDone! All admin passwords are now properly hashed.');
  } catch (err) {
    console.error('Error fixing admin passwords:', err.message);
  } finally {
    await connection.end();
  }
}

fixAdminPasswords();
