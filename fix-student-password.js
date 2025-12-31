const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function fixStudentPassword() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'spist_library'
  });

  try {
    // Hash the password '1111'
    const hashedPassword = await bcrypt.hash('1111', 10);
    
    // Update students with null passwords
    const [result] = await connection.execute(
      "UPDATE students SET password = ? WHERE email IN ('nahacctmo145@gmail.com', 'hahacctmo145@gmail.com') AND password IS NULL",
      [hashedPassword]
    );
    
    console.log(`✅ Updated ${result.affectedRows} student(s) with password '1111'`);
    
    // Check all students with null passwords
    const [nullPasswordStudents] = await connection.execute(
      "SELECT email, student_id FROM students WHERE password IS NULL"
    );
    
    if (nullPasswordStudents.length > 0) {
      console.log(`\n⚠️ Warning: ${nullPasswordStudents.length} student(s) still have NULL passwords:`);
      nullPasswordStudents.forEach(s => console.log(`   - ${s.email} (${s.student_id})`));
      console.log('\nWould you like to set default password "1111" for all of them?');
    } else {
      console.log('\n✅ All students have passwords set!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

fixStudentPassword();
