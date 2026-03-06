/**
 * Debug Login Script
 * Run: node debug-login.js <email> <password>
 * Example: node debug-login.js student@example.com mypassword123
 */

const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
require('dotenv').config();

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log('Usage: node debug-login.js <email> <password>');
  process.exit(1);
}

async function debugLogin() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'spist_library',
    port: parseInt(process.env.DB_PORT || 3306),
  });

  try {
    console.log(`\n🔍 Checking login for: ${email}\n`);

    // Check students table
    const [students] = await connection.execute(
      'SELECT id, student_id, fullname, email, password, status FROM students WHERE email = ?',
      [email]
    );

    if (students.length === 0) {
      console.log('❌ No student found with this email.');
      console.log('\n📋 All registered students:');
      const [all] = await connection.execute('SELECT id, student_id, fullname, email, status FROM students');
      if (all.length === 0) {
        console.log('   (no students registered at all)');
      } else {
        all.forEach(s => console.log(`   - ${s.email} (${s.fullname}) | status: ${s.status}`));
      }
    } else {
      const student = students[0];
      console.log(`✅ Student found: ${student.fullname} (${student.email})`);
      console.log(`   Status: ${student.status}`);
      console.log(`   Has password hash: ${!!student.password}`);

      if (!student.password) {
        console.log('❌ No password stored — account was created via Google OAuth only.');
      } else {
        const isHashed = student.password.startsWith('$2b$') || student.password.startsWith('$2a$');
        console.log(`   Password is bcrypt hash: ${isHashed}`);

        if (!isHashed) {
          console.log('⚠️  Password is stored as PLAIN TEXT — run fix to hash it.');
          const match = student.password === password;
          console.log(`   Plain text match: ${match}`);

          if (match) {
            console.log('\n🔧 Fixing: hashing the plain text password now...');
            const hashed = await bcrypt.hash(password, 10);
            await connection.execute('UPDATE students SET password = ? WHERE id = ?', [hashed, student.id]);
            console.log('✅ Password hashed and updated. Try logging in again.');
          }
        } else {
          const match = await bcrypt.compare(password, student.password);
          console.log(`   Password matches: ${match}`);

          if (match) {
            console.log('\n✅ Credentials are correct — login SHOULD work.');
            console.log('   If still failing, check for a server or session issue.');
          } else {
            console.log('\n❌ Password does NOT match what is stored in the database.');
            console.log('   You may have registered with a different password.');
            console.log('   Use Forgot Password to reset it.');
          }
        }
      }
    }

    // Check admins table too
    const [admins] = await connection.execute(
      'SELECT id, email, password, role FROM admins WHERE email = ?',
      [email]
    );
    if (admins.length > 0) {
      const admin = admins[0];
      console.log(`\n📌 Also found as ADMIN: ${admin.email} (role: ${admin.role})`);
      if (admin.password) {
        const match = await bcrypt.compare(password, admin.password);
        console.log(`   Admin password matches: ${match}`);
      }
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await connection.end();
  }
}

debugLogin();
