-- Sample Books for SPIST Library System
-- Insert sample books across different categories

INSERT INTO books (isbn, title, author, publisher, publication_year, category, copies_available, total_copies, description) VALUES
('978-0134685991', 'Effective Java', 'Joshua Bloch', 'Addison-Wesley', 2018, 'Programming', 5, 5, 'Best practices guide for Java programming language'),
('978-0596517748', 'JavaScript: The Good Parts', 'Douglas Crockford', 'O\'Reilly Media', 2008, 'Programming', 4, 4, 'A deep dive into JavaScript language essentials'),
('978-0132350884', 'Clean Code', 'Robert C. Martin', 'Prentice Hall', 2008, 'Programming', 6, 6, 'A handbook of agile software craftsmanship'),
('978-0201633610', 'Design Patterns', 'Erich Gamma', 'Addison-Wesley', 1994, 'Programming', 3, 3, 'Elements of reusable object-oriented software'),
('978-0735619678', 'Code Complete', 'Steve McConnell', 'Microsoft Press', 2004, 'Programming', 4, 4, 'A practical handbook of software construction'),

('978-0073523323', 'Database System Concepts', 'Abraham Silberschatz', 'McGraw-Hill', 2019, 'Database', 5, 5, 'Comprehensive database management systems textbook'),
('978-0134757599', 'Database Management Systems', 'Raghu Ramakrishnan', 'McGraw-Hill', 2014, 'Database', 4, 4, 'A comprehensive introduction to database systems'),
('978-1449373320', 'Designing Data-Intensive Applications', 'Martin Kleppmann', 'O\'Reilly Media', 2017, 'Database', 3, 3, 'The big ideas behind reliable, scalable systems'),

('978-0262033848', 'Introduction to Algorithms', 'Thomas H. Cormen', 'MIT Press', 2009, 'Computer Science', 5, 5, 'Comprehensive algorithms textbook'),
('978-0133594140', 'Computer Networking', 'James Kurose', 'Pearson', 2016, 'Computer Science', 4, 4, 'A top-down approach to computer networking'),
('978-0136091813', 'Computer Organization and Design', 'David A. Patterson', 'Morgan Kaufmann', 2013, 'Computer Science', 3, 3, 'The hardware/software interface'),

('978-0071809252', 'Fundamentals of Corporate Finance', 'Stephen Ross', 'McGraw-Hill', 2018, 'Business', 5, 5, 'Essential corporate finance principles'),
('978-0134741116', 'Marketing Management', 'Philip Kotler', 'Pearson', 2015, 'Business', 4, 4, 'The definitive marketing management textbook'),
('978-0133506297', 'Operations Management', 'Jay Heizer', 'Pearson', 2016, 'Business', 3, 3, 'Sustainability and supply chain management'),

('978-0134477473', 'Starting Out with Python', 'Tony Gaddis', 'Pearson', 2018, 'Programming', 6, 6, 'Beginner-friendly Python programming book'),
('978-1491946008', 'Fluent Python', 'Luciano Ramalho', 'O\'Reilly Media', 2015, 'Programming', 3, 3, 'Clear, concise, and effective programming'),
('978-1593279288', 'Python Crash Course', 'Eric Matthes', 'No Starch Press', 2019, 'Programming', 5, 5, 'A hands-on, project-based introduction'),

('978-1449355739', 'Learning React', 'Alex Banks', 'O\'Reilly Media', 2020, 'Web Development', 4, 4, 'Modern patterns for developing React apps'),
('978-1491952023', 'Node.js Design Patterns', 'Mario Casciaro', 'Packt Publishing', 2020, 'Web Development', 3, 3, 'Design and implement production-grade Node.js'),
('978-0596805524', 'HTML5: The Missing Manual', 'Matthew MacDonald', 'O\'Reilly Media', 2013, 'Web Development', 4, 4, 'Comprehensive HTML5 guide'),

('978-0134757711', 'Introduction to Hospitality', 'John Walker', 'Pearson', 2016, 'Hospitality Management', 5, 5, 'Comprehensive hospitality industry overview'),
('978-1118988695', 'Restaurant Management', 'Dennis Reynolds', 'Wiley', 2018, 'Hospitality Management', 3, 3, 'Customers, operations, and employees'),
('978-0134105925', 'Tourism Management', 'Stephen Page', 'Routledge', 2019, 'Hospitality Management', 4, 4, 'An introduction to tourism concepts'),

('978-0134819662', 'Educational Psychology', 'Anita Woolfolk', 'Pearson', 2018, 'Education', 5, 5, 'Theory and practice in teaching'),
('978-1506351544', 'Curriculum Development', 'Allan Glatthorn', 'SAGE Publications', 2018, 'Education', 3, 3, 'A guide to practice and theory'),
('978-1452217352', 'Classroom Assessment', 'James Popham', 'Pearson', 2016, 'Education', 4, 4, 'What teachers need to know');
