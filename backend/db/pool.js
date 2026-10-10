const mysql = require('mysql2/promise');

module.exports = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 5,
  dateStrings: true,     // DATE/TIMESTAMP come back as text, e.g. '2026-10-04'
  decimalNumbers: true   // DECIMAL comes back as a number (otherwise it's text: a classic bug)
});
