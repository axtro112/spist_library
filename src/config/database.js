const mysql = require("mysql2");
require("dotenv").config();

// Database configuration from environment variables
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || process.env.DB_DATABASE || "spist_library",
  port: process.env.DB_PORT || 3306,
};

const connection = mysql.createConnection(dbConfig);

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
