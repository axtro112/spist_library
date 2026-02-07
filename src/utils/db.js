const db = require('../config/database');

/**
 * Execute database query with promise wrapper
 * @param {string} sql - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
const query = async (sql, params = []) => {
  try {
    // db.query is already promisified in database.js
    const results = await db.query(sql, params);
    return results;
  } catch (err) {
    console.error('[DB ERROR]', err.message);
    throw err;
  }
};

/**
 * Begin database transaction
 * @returns {Promise<void>}
 */
const beginTransaction = () => {
  return new Promise((resolve, reject) => {
    db.beginTransaction((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

/**
 * Commit database transaction
 * @returns {Promise<void>}
 */
const commit = () => {
  return new Promise((resolve, reject) => {
    db.commit((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

/**
 * Rollback database transaction
 * @returns {Promise<void>}
 */
const rollback = () => {
  return new Promise((resolve, reject) => {
    db.rollback((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

module.exports = {
  query,
  beginTransaction,
  commit,
  rollback,
  connection: db
};
