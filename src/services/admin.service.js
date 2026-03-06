const db = require('../utils/db');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');

/**
 * Create a new admin account.
 * @throws {Error} err.statusCode = 409 if the email is already in use.
 */
async function createAdmin({ fullname, email, password, role }) {
  const normalizedEmail = email.toLowerCase();

  const existing = await db.query(
    'SELECT id FROM admins WHERE email = ?',
    [normalizedEmail]
  );

  if (existing.length > 0) {
    const err = new Error('An account with this email already exists');
    err.statusCode = 409;
    throw err;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await db.query(
    'INSERT INTO admins (fullname, email, password, role, created_at) VALUES (?, ?, ?, ?, NOW())',
    [fullname.trim(), normalizedEmail, hashedPassword, role]
  );

  logger.info('Admin created', { adminId: result.insertId, email: normalizedEmail, role });

  return {
    id: result.insertId,
    fullname: fullname.trim(),
    email: normalizedEmail,
    role,
    created_at: new Date().toISOString(),
  };
}

module.exports = { createAdmin };
