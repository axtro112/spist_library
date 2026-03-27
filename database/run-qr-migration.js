#!/usr/bin/env node
/**
 * Migration Runner: QR Token System
 * Adds QR token columns, status enums, and indexes for book pickup system
 * 
 * Usage: node database/run-qr-migration.js
 */

const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');

const migrationFile = path.join(__dirname, 'migrations', 'add_qr_token_system.sql');

console.log('🔄 Starting QR Token System Migration...');
console.log('📂 Migration file:', migrationFile);
console.log('');

if (!fs.existsSync(migrationFile)) {
  console.error('❌ Migration file not found:', migrationFile);
  process.exit(1);
}

fs.readFile(migrationFile, 'utf8', async (err, sql) => {
  if (err) {
    console.error('❌ Error reading migration file:', err.message);
    process.exit(1);
  }

  try {
    // Split SQL file by semicolons to execute each statement separately
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        // Keep only non-empty statements
        return (
          s.length > 0 &&
          !/^\s*--/.test(s) && // Skip comment-only lines
          /\b(ALTER|CREATE|UPDATE|INSERT|DELETE|DROP|SELECT)\b/i.test(s)
        );
      });

    console.log(`📋 Found ${statements.length} SQL statement(s) to execute`);
    console.log('');

    let completed = 0;
    let errors = [];

    for (const statement of statements) {
      try {
        console.log('⏳ Executing:', statement.substring(0, 60) + '...');
        await db.query(statement);
        completed++;
        console.log('✅ Success');
      } catch (err) {
        // Some errors are expected (e.g., column already exists)
        // Check if it's an idempotent error
        if (
          err.message.includes('already exists') ||
          err.message.includes('Duplicate column') ||
          err.message.includes('already has an index') ||
          err.message.includes("can't DROP")
        ) {
          console.log('⚠️  Skipped (already exists):', err.message.split('\n')[0]);
          completed++;
        } else {
          console.error('❌ Error:', err.message);
          errors.push({ statement: statement.substring(0, 50), error: err.message });
        }
      }
    }

    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log(`Migration Summary: ${completed}/${statements.length} completed`);

    if (errors.length === 0) {
      console.log('✅ QR Token System Migration completed successfully!');
      console.log('');
      console.log('Changes applied:');
      console.log('  • Added qr_token column (UNIQUE JWT token)');
      console.log('  • Added qr_generated_at column (token generation timestamp)');
      console.log('  • Added qr_scanned_at column (pickup scan timestamp)');
      console.log('  • Updated status ENUM: added "pending_pickup", "expired"');
      console.log('  • Created index on (status, claim_expires_at) for scheduling');
      console.log('');
      console.log('System is ready for QR-based contactless pickups!');
      process.exit(0);
    } else {
      console.log(`⚠️  ${errors.length} error(s) encountered (may be non-critical)`);
      errors.forEach(({ statement, error }) => {
        console.log('  - ' + statement + ': ' + error);
      });
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  } finally {
    if (db && typeof db.end === 'function') {
      db.end();
    }
  }
});
