const mysql = require('mysql2/promise');

const config = {
  host: 'tramway.proxy.rlwy.net',
  port: 32416,
  user: 'root',
  password: 'IMvoNFLYLMIcDtdWybJxaBjCFbebbgxJ',
};

async function run() {
  const conn = await mysql.createConnection({ ...config, database: 'railway' });
  console.log('Connected to railway database\n');

  // Insert sessions table if missing
  await conn.query(`CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(128) COLLATE utf8mb4_bin PRIMARY KEY,
    expires INT(11) UNSIGNED NOT NULL,
    data MEDIUMTEXT COLLATE utf8mb4_bin,
    INDEX expires (expires)
  )`);
  console.log('✓ Sessions table ready');

  // Clear existing data to avoid duplicates
  await conn.query('SET FOREIGN_KEY_CHECKS=0');
  await conn.query('TRUNCATE TABLE book_borrowings');
  await conn.query('TRUNCATE TABLE books');
  await conn.query('TRUNCATE TABLE students');
  await conn.query('TRUNCATE TABLE admins');
  await conn.query('SET FOREIGN_KEY_CHECKS=1');
  console.log('✓ Cleared existing data');

  // Insert admins (password: admin123)
  await conn.query(`INSERT INTO admins (fullname, email, password, role, is_active) VALUES
    ('System Administrator', 'admin@spist.edu', '$2b$10$XsCv92X03pF9juwKuGO3FOx5jvNV5B4c1gvpjfv21vPH7V5NHCKEO', 'super_admin', TRUE),
    ('John Admin', 'john.admin@spist.edu', '$2b$10$XsCv92X03pF9juwKuGO3FOx5jvNV5B4c1gvpjfv21vPH7V5NHCKEO', 'system_admin', TRUE),
    ('Jane Manager', 'jane.manager@spist.edu', '$2b$10$XsCv92X03pF9juwKuGO3FOx5jvNV5B4c1gvpjfv21vPH7V5NHCKEO', 'system_admin', TRUE)`);
  console.log('✓ Inserted 3 admins');

  // Insert students (password: student123)
  await conn.query(`INSERT INTO students (student_id, fullname, email, password, department, year_level, student_type, contact_number, status) VALUES
    ('STD-2024-001', 'Juan dela Cruz', 'juan.delacruz@spist.edu', '$2b$10$JkDx/nLnBg9r8cA/zlOXjuz0mfRO05W.p6Z1Q5wlWAgyMv04PrSve', 'BSCS', '3', 'undergraduate', '09123456789', 'active'),
    ('STD-2024-002', 'Maria Santos', 'maria.santos@spist.edu', '$2b$10$JkDx/nLnBg9r8cA/zlOXjuz0mfRO05W.p6Z1Q5wlWAgyMv04PrSve', 'BSIT', '2', 'undergraduate', '09234567890', 'active'),
    ('STD-2024-003', 'Pedro Garcia', 'pedro.garcia@spist.edu', '$2b$10$JkDx/nLnBg9r8cA/zlOXjuz0mfRO05W.p6Z1Q5wlWAgyMv04PrSve', 'BSCS', '4', 'undergraduate', '09345678901', 'active'),
    ('STD-2024-004', 'Ana Reyes', 'ana.reyes@spist.edu', '$2b$10$JkDx/nLnBg9r8cA/zlOXjuz0mfRO05W.p6Z1Q5wlWAgyMv04PrSve', 'BSIT', '1', 'undergraduate', '09456789012', 'active'),
    ('STD-2024-005', 'Jose Rizal', 'jose.rizal@spist.edu', '$2b$10$JkDx/nLnBg9r8cA/zlOXjuz0mfRO05W.p6Z1Q5wlWAgyMv04PrSve', 'BSCS', '3', 'transferee', '09567890123', 'active')`);
  console.log('✓ Inserted 5 students');

  // Insert books
  await conn.query(`INSERT INTO books (title, author, isbn, category, quantity, available_quantity, status, added_by) VALUES
    ('Introduction to Python Programming', 'John Developer', '978-0-123456-78-9', 'Programming', 5, 3, 'available', 1),
    ('Database Management Systems', 'Sarah Database', '978-0-234567-89-0', 'Database', 3, 3, 'available', 1),
    ('Web Development with JavaScript', 'Mike Frontend', '978-0-345678-90-1', 'Web Development', 4, 2, 'available', 1),
    ('Data Structures and Algorithms', 'Alice Coder', '978-0-456789-01-2', 'Programming', 3, 1, 'available', 1),
    ('Network Security Fundamentals', 'Bob Security', '978-0-567890-12-3', 'Networking', 2, 2, 'available', 1),
    ('Advanced Java Programming', 'Jane Java', '978-0-678901-23-4', 'Programming', 4, 4, 'available', 1),
    ('Cloud Computing Essentials', 'Cloud Expert', '978-0-789012-34-5', 'Cloud Computing', 3, 3, 'available', 1),
    ('Machine Learning Basics', 'AI Researcher', '978-0-890123-45-6', 'Artificial Intelligence', 2, 1, 'available', 1),
    ('Mobile App Development', 'App Creator', '978-0-901234-56-7', 'Mobile Development', 3, 3, 'available', 1),
    ('Cybersecurity Best Practices', 'Security Pro', '978-0-012345-67-8', 'Security', 2, 2, 'available', 1)`);
  console.log('✓ Inserted 10 books');

  // Insert borrowing records
  await conn.query(`INSERT INTO book_borrowings (book_id, student_id, approved_by, borrow_date, due_date, return_date, status) VALUES
    (1, 'STD-2024-001', 1, '2024-11-01 10:00:00', '2024-11-15 10:00:00', '2024-11-14 09:30:00', 'returned'),
    (2, 'STD-2024-002', 1, '2024-11-05 14:00:00', '2024-11-19 14:00:00', NULL, 'borrowed'),
    (3, 'STD-2024-003', 1, '2024-11-10 11:00:00', '2024-11-24 11:00:00', NULL, 'borrowed'),
    (4, 'STD-2024-004', 1, '2024-11-12 15:30:00', '2024-11-26 15:30:00', NULL, 'borrowed'),
    (8, 'STD-2024-005', 1, '2024-11-15 09:00:00', '2024-11-29 09:00:00', NULL, 'borrowed')`);
  console.log('✓ Inserted 5 borrowing records');

  // Verify
  const [[{count: a}]] = await conn.query('SELECT COUNT(*) as count FROM admins');
  const [[{count: s}]] = await conn.query('SELECT COUNT(*) as count FROM students');
  const [[{count: b}]] = await conn.query('SELECT COUNT(*) as count FROM books');
  console.log(`\n✓ Final counts → Admins: ${a}, Students: ${s}, Books: ${b}`);
  console.log('\n===== DONE! Login should now work =====');
  console.log('Admin: admin@spist.edu / admin123');
  console.log('Student: STD-2024-001 / student123');

  await conn.end();
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
