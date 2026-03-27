/**
 * Database Migration Utility
 * Automatically detects and runs pending migrations
 */

const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const logger = require('./logger');

const migrationsDir = path.join(__dirname, '../../database/migrations');

// Track which migrations should run on startup
const AUTO_RUN_MIGRATIONS = [
  'add_qr_token_system.sql' // QR code pickup system
];

/**
 * Execute a single SQL migration file
 * @param {string} migrationFile - Migration filename
 * @returns {Promise<{success: boolean, message: string, skipped: number, executed: number}>}
 */
async function executeMigration(migrationFile) {
  return new Promise((resolve) => {
    const filePath = path.join(migrationsDir, migrationFile);

    if (!fs.existsSync(filePath)) {
      resolve({
        success: false,
        message: `Migration file not found: ${migrationFile}`,
        skipped: 0,
        executed: 0
      });
      return;
    }

    fs.readFile(filePath, 'utf8', async (err, sql) => {
      if (err) {
        resolve({
          success: false,
          message: `Error reading migration: ${err.message}`,
          skipped: 0,
          executed: 0
        });
        return;
      }

      try {
        // Parse SQL statements
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => {
            return (
              s.length > 0 &&
              !/^\s*--/.test(s) &&
              /\b(ALTER|CREATE|UPDATE|INSERT|DELETE|DROP|SELECT)\b/i.test(s)
            );
          });

        let executed = 0;
        let skipped = 0;

        for (const statement of statements) {
          try {
            await db.query(statement);
            executed++;
          } catch (err) {
            // Idempotent errors are OK (column exists, index exists, etc)
            if (
              err.message.includes('already exists') ||
              err.message.includes('Duplicate') ||
              err.message.includes('FOREIGN KEY constraint fails') ||
              err.message.includes("can't DROP") ||
              err.message.includes('Unknown column')
            ) {
              skipped++;
            } else {
              throw err;
            }
          }
        }

        resolve({
          success: true,
          message: `Executed: ${executed}, Skipped (idempotent): ${skipped}`,
          executed,
          skipped
        });
      } catch (err) {
        resolve({
          success: false,
          message: `Migration error: ${err.message}`,
          skipped: 0,
          executed: 0
        });
      }
    });
  });
}

/**
 * Run auto-enabled migrations on startup
 * This is non-blocking and logs results
 */
async function runPendingMigrations() {
  // Can be enabled via FORCE_MIGRATE=true for manual testing
  const forceMigrate = process.env.FORCE_MIGRATE === 'true';
  const skipAutoMigrate = process.env.SKIP_AUTO_MIGRATE === 'true';
  const env = process.env.NODE_ENV || 'development';

  if (skipAutoMigrate) {
    logger.info('Auto-migration skipped (SKIP_AUTO_MIGRATE=true)');
    return;
  }

  // Auto-run in production, or when FORCE_MIGRATE=true in development
  const shouldMigrate = env === 'production' || forceMigrate;

  if (!shouldMigrate) {
    logger.debug('Skipping auto-migration in development mode (use FORCE_MIGRATE=true to override)');
    return;
  }

  try {
    logger.info('🔄 Running database migrations...');

    for (const migrationFile of AUTO_RUN_MIGRATIONS) {
      logger.info(`  → Checking migration: ${migrationFile}`);
      const result = await executeMigration(migrationFile);

      if (result.success) {
        logger.info(`  ✅ ${migrationFile}: ${result.message}`);
      } else {
        logger.warn(`  ⚠️  ${migrationFile}: ${result.message}`);
      }
    }

    logger.info('✅ Migrations completed');
  } catch (err) {
    logger.error('Migration runner error:', { error: err.message });
  }
}

module.exports = {
  executeMigration,
  runPendingMigrations
};
