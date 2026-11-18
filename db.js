
"use strict";

require("dotenv").config();

const mysql = require("mysql2/promise");

const pool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "Mart",
    password: process.env.DB_PASSWORD || "VMart@123",
    database: process.env.DB_NAME || "VMart",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000
});

async function testConnection() {
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.ping();

        console.log("MySQL connected successfully.");
        console.log("Database:", process.env.DB_NAME || "VMart");

        return true;
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

module.exports = {
    pool,
    testConnection
};
