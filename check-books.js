const db = require('./src/config/database');

async function checkAllBooks() {
  try {
    const allBooks = await db.query('SELECT id, title, status, quantity, available_quantity FROM books LIMIT 10');
    
    if (allBooks.length === 0) {
      console.log('❌ NO BOOKS IN DATABASE!');
      console.log('\nYou need to add books first. Options:');
      console.log('1. Go to Admin Books page and click "Add Book"');
      console.log('2. Import books using CSV/Excel');
      console.log('3. Run the sample books SQL script');
    } else {
      console.log(`Found ${allBooks.length} books:\n`);
      allBooks.forEach(b => {
        console.log(`ID: ${b.id} | ${b.title} | Status: ${b.status} | Qty: ${b.quantity}/${b.available_quantity}`);
      });
    }
    
    db.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkAllBooks();
