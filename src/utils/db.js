const pool = require('../config/database');
const util = require('util');

/**
 * Execute database query using the pool
 * @param {string} sql - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
const query = async (sql, params = []) => {
  try {
    const results = await pool.query(sql, params);
    return results;
  } catch (err) {
    console.error('[DB ERROR]', err.message);
    throw err;
  }
};

/**
 * Get a dedicated connection from the pool (for transactions)
 * @returns {Promise<Connection>}
 */
const getConnection = () => {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, conn) => {
      if (err) return reject(err);
      // Promisify query on this connection
      conn.queryAsync = util.promisify(conn.query.bind(conn));
      conn.beginTransactionAsync = util.promisify(conn.beginTransaction.bind(conn));
      conn.commitAsync = util.promisify(conn.commit.bind(conn));
      conn.rollbackAsync = util.promisify(conn.rollback.bind(conn));
      resolve(conn);
    });
  });
};

/**
 * Execute a function inside a transaction.
 * @param {Function} fn - async fn(conn) that does all queries using conn.queryAsync()
 * @returns {Promise<any>} - result returned by fn
 */
const withTransaction = async (fn) => {
  const conn = await getConnection();
  try {
    await conn.beginTransactionAsync();
    const result = await fn(conn);
    await conn.commitAsync();
    return result;
  } catch (err) {
    await conn.rollbackAsync();
    throw err;
  } finally {
    conn.release();
  }
};

// Legacy stubs kept so existing callers don't throw — they now just log a warning
const beginTransaction = async () => { console.warn('[DB] beginTransaction() stub called - use withTransaction() instead'); };
const commit = async () => {};
const rollback = async () => {};

module.exports = {
  query,
  getConnection,
  withTransaction,
  beginTransaction,
  commit,
  rollback,
  connection: pool
};
