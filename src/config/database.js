const mysql = require("mysql2");
const util = require('util');
require("dotenv").config();

// Database configuration from environment variables
// Railway auto-injects MYSQL_* variables; fall back gracefully
const dbConfig = {
  host: process.env.DB_HOST || process.env.MYSQL_HOST || "localhost",
  user: process.env.DB_USER || process.env.MYSQL_USER || "root",
  password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || "",
  database: process.env.DB_NAME || process.env.MYSQL_DATABASE || process.env.DB_DATABASE || "spist_library",
  port: parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

console.log("Database config:", {
  host: dbConfig.host,
  user: dbConfig.user,
  database: dbConfig.database,
  port: dbConfig.port,
  hasPassword: !!dbConfig.password,
});

// Use a connection pool instead of a single connection
// Pool auto-reconnects and handles dropped connections
const pool = mysql.createPool(dbConfig);

// Promisify the query method for async/await support
pool.query = util.promisify(pool.query.bind(pool));

// Test initial connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error("Error connecting to the database: " + err.message);
    return;
  }
  console.log(`Successfully connected to database: ${dbConfig.database} (${process.env.NODE_ENV || 'development'})`);
  connection.release();
});

module.exports = pool;
