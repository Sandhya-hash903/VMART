
"use strict";

require("dotenv").config();

const { testConnection, pool } = require("./db");

async function main() {
    try {
        await testConnection();
        console.log("V MART database test passed.");
    } catch (error) {
        console.error("MySQL connection failed:");
        console.error("Error code:", error.code || "Unknown");
        console.error("Message:", error.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

main();
