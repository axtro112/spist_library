/**
 * Runner for normalize_3nf.sql
 * Executes each SQL statement individually and gracefully skips
 * statements that fail because the schema change already exists.
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const db   = require('../src/config/database');

const MIGRATION_FILE = path.join(__dirname, 'migrations', 'normalize_3nf.sql');

// Errors that mean "already done" — safe to skip
const IGNORABLE = new Set([
  'ER_DUP_FIELDNAME',       // ADD COLUMN on existing column
  'ER_DUP_KEYNAME',         // ADD INDEX / ADD CONSTRAINT duplicate name
  'ER_TABLE_EXISTS_ERROR',  // CREATE TABLE on existing table
  'ER_FK_DUP_NAME',         // duplicate FK name
]);

async function run() {
  console.log('\n=== 3NF / BCNF Normalization Migration ===');
  console.log('File:', MIGRATION_FILE, '\n');

  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');

  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && /\b(ALTER|CREATE|UPDATE|INSERT|DELETE|DROP|SELECT|SET)\b/i.test(s));

  console.log(`Found ${statements.length} statements to execute.\n`);

  let ok = 0, skipped = 0, failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.replace(/\s+/g, ' ').substring(0, 80);
    try {
      await db.query(stmt);
      console.log(`  [${i + 1}/${statements.length}] ✓  ${preview}`);
      ok++;
    } catch (err) {
      if (IGNORABLE.has(err.code)) {
        console.log(`  [${i + 1}/${statements.length}] –  SKIPPED (already exists): ${preview}`);
        skipped++;
      } else {
        console.error(`  [${i + 1}/${statements.length}] ✗  FAILED: ${err.message}`);
        console.error(`       Statement: ${preview}`);
        failed++;
      }
    }
  }

  console.log(`\n=== Done — ${ok} succeeded, ${skipped} skipped, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
