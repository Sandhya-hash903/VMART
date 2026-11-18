
"use strict";

require("dotenv").config();

const mysql = require("mysql2/promise");

const pool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USER || "Mart",
    password: process.env.DB_PASSWORD || "vmart@123",
    database: process.env.DB_NAME || "VMart",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
 
async function testConnection() {
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.ping();

        const [rows] = await connection.query(
            "SELECT DATABASE() AS databaseName, CURRENT_USER() AS databaseUser"
        );

        console.log("MySQL connected successfully!");
        console.log("Database:", rows[0].databaseName);
        console.log("Authenticated user:", rows[0].databaseUser);

        return true;
    } catch (error) {
        console.error("MySQL connection failed!");
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);

        throw error;
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
