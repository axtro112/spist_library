const mysql = require('mysql2/promise');
require('dotenv').config();

async function insertSampleBooks() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'spist_library'
    });

    console.log('Connected to database');

    const books = [
      ['978-0134685991', 'Effective Java', 'Joshua Bloch', 'Programming', 5, 5],
      ['978-0596517748', 'JavaScript: The Good Parts', 'Douglas Crockford', 'Programming', 4, 4],
      ['978-0132350884', 'Clean Code', 'Robert C. Martin', 'Programming', 6, 6],
      ['978-0201633610', 'Design Patterns', 'Erich Gamma', 'Programming', 3, 3],
      ['978-0735619678', 'Code Complete', 'Steve McConnell', 'Programming', 4, 4],

      ['978-0073523323', 'Database System Concepts', 'Abraham Silberschatz', 'Database', 5, 5],
      ['978-0134757599', 'Database Management Systems', 'Raghu Ramakrishnan', 'Database', 4, 4],
      ['978-1449373320', 'Designing Data-Intensive Applications', 'Martin Kleppmann', 'Database', 3, 3],

      ['978-0262033848', 'Introduction to Algorithms', 'Thomas H. Cormen', 'Computer Science', 5, 5],
      ['978-0133594140', 'Computer Networking', 'James Kurose', 'Computer Science', 4, 4],
      ['978-0136091813', 'Computer Organization and Design', 'David A. Patterson', 'Computer Science', 3, 3],

      ['978-0071809252', 'Fundamentals of Corporate Finance', 'Stephen Ross', 'Business', 5, 5],
      ['978-0134741116', 'Marketing Management', 'Philip Kotler', 'Business', 4, 4],
      ['978-0133506297', 'Operations Management', 'Jay Heizer', 'Business', 3, 3],

      ['978-0134477473', 'Starting Out with Python', 'Tony Gaddis', 'Programming', 6, 6],
      ['978-1491946008', 'Fluent Python', 'Luciano Ramalho', 'Programming', 3, 3],
      ['978-1593279288', 'Python Crash Course', 'Eric Matthes', 'Programming', 5, 5],

      ['978-1449355739', 'Learning React', 'Alex Banks', 'Web Development', 4, 4],
      ['978-1491952023', 'Node.js Design Patterns', 'Mario Casciaro', 'Web Development', 3, 3],
      ['978-0596805524', 'HTML5: The Missing Manual', 'Matthew MacDonald', 'Web Development', 4, 4],

      ['978-0134757711', 'Introduction to Hospitality', 'John Walker', 'Hospitality Management', 5, 5],
      ['978-1118988695', 'Restaurant Management', 'Dennis Reynolds', 'Hospitality Management', 3, 3],
      ['978-0134105925', 'Tourism Management', 'Stephen Page', 'Hospitality Management', 4, 4],

      ['978-0134819662', 'Educational Psychology', 'Anita Woolfolk', 'Education', 5, 5],
      ['978-1506351544', 'Curriculum Development', 'Allan Glatthorn', 'Education', 3, 3],
      ['978-1452217352', 'Classroom Assessment', 'James Popham', 'Education', 4, 4]
    ];

    const query = `INSERT INTO books (isbn, title, author, category, quantity, available_quantity) VALUES (?, ?, ?, ?, ?, ?)`;

    let inserted = 0;
    for (const book of books) {
      try {
        await connection.execute(query, book);
        inserted++;
        console.log(`✓ Inserted: ${book[1]}`);
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          console.log(`⊘ Skipped (duplicate): ${book[1]}`);
        } else {
          console.error(`✗ Error inserting ${book[1]}:`, err.message);
        }
      }
    }

    console.log(`\n Successfully inserted ${inserted} books out of ${books.length}`);
    await connection.end();
  } catch (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
}

insertSampleBooks();
