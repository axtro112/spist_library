const db = require('./src/config/database');
const fs = require('fs');
const path = require('path');

const sqlFile = path.join(__dirname, 'database', 'migrations', 'RUN_THIS_FIRST_FIXED.sql');
const sql = fs.readFileSync(sqlFile, 'utf8');

// Remove comments and split by semicolons
const statements = sql
  .split('\n')
  .filter(line => !line.trim().startsWith('--')) // Remove comment lines
  .join('\n')
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0);

let completed = 0;
let failed = 0;

console.log(`\nRunning ${statements.length} SQL statements...\n`);

const runNext = (index) => {
  if (index >= statements.length) {
    console.log(`\n\n✓ Migration completed!`);
    console.log(`  Success: ${completed}`);
    console.log(`  Failed: ${failed}`);
    db.end();
    return;
  }

  const statement = statements[index];
  if (statement) {
    db.query(statement, (err) => {
      if (err) {
        console.error(`\n✗ Error on statement ${index + 1}:`, err.message);
        failed++;
      } else {
        completed++;
        process.stdout.write(`\r✓ Progress: ${completed}/${statements.length} statements`);
      }
      runNext(index + 1);
    });
  } else {
    runNext(index + 1);
  }
};

runNext(0);
