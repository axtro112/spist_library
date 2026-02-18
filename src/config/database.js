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
  port: process.env.DB_PORT || process.env.MYSQL_PORT || 3306,
};

const connection = mysql.createConnection(dbConfig);

// Promisify the query method for async/await support
connection.query = util.promisify(connection.query);

connection.connect((err) => {
  if (err) {
    console.error("Error connecting to the database: " + err.stack);
    console.error("Database config:", {
      host: dbConfig.host,
      user: dbConfig.user,
      database: dbConfig.database,
      port: dbConfig.port,
    });
    return;
  }
  console.log(`Successfully connected to database: ${dbConfig.database} (${process.env.NODE_ENV || 'development'})`);
});

module.exports = connection;
