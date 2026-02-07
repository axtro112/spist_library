const mysql = require('mysql2/promise');

(async () => {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', // Replace with your MySQL root password
    database: 'spist_library'
  });

  try {
    console.log('Connected to the database.');

    // Update query to trim leading and trailing spaces from email field
    const [result] = await connection.execute("UPDATE admins SET email = TRIM(email);");
    console.log('Email field updated successfully:', result);
  } catch (error) {
    console.error('Error updating email field:', error.message);
  } finally {
    await connection.end();
    console.log('Database connection closed.');
  }
})();