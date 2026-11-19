
"use strict";

require("dotenv").config();

const mysql = require("mysql2/promise");
const { Client } = require("ssh2");
const net = require("net");

// =====================================================
// CONFIGURATION
// =====================================================

const SSH_HOST = process.env.SSH_HOST;
const SSH_PORT = Number(process.env.SSH_PORT || 519);
const SSH_USERNAME = process.env.SSH_USERNAME;
const SSH_PASSWORD = process.env.SSH_PASSWORD;

const DB_HOST = process.env.DB_HOST || "127.0.0.1";
const DB_PORT = Number(process.env.DB_PORT || 3307);
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME;

// Remote MariaDB address as seen from the VPS
const REMOTE_DB_HOST = "127.0.0.1";
const REMOTE_DB_PORT = 3306;

// =====================================================
// VALIDATE ENVIRONMENT VARIABLES
// =====================================================

const requiredVariables = [
    "SSH_HOST",
    "SSH_USERNAME",
    "SSH_PASSWORD",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME"
];

for (const key of requiredVariables) {
    if (!process.env[key]) {
        throw new Error(`Missing environment variable: ${key}`);
    }
}

// =====================================================
// MYSQL POOL
// =====================================================

const pool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,

    connectTimeout: 20000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});

// =====================================================
// AUTOMATIC SSH TUNNEL
// =====================================================

let sshClient = null;
let tunnelServer = null;
let tunnelPromise = null;

function startSSHTunnel() {
    if (tunnelPromise) {
        return tunnelPromise;
    }

    tunnelPromise = new Promise((resolve, reject) => {
        sshClient = new Client();

        sshClient.on("ready", () => {
            console.log("SSH connection established.");

            tunnelServer = net.createServer((localSocket) => {
                sshClient.forwardOut(
                    "127.0.0.1",
                    0,
                    REMOTE_DB_HOST,
                    REMOTE_DB_PORT,
                    (error, remoteSocket) => {
                        if (error) {
                            console.error(
                                "SSH forwarding failed:",
                                error.message
                            );

                            localSocket.destroy();
                            return;
                        }

                        localSocket.pipe(remoteSocket);
                        remoteSocket.pipe(localSocket);

                        remoteSocket.on("error", () => {
                            localSocket.destroy();
                        });

                        localSocket.on("error", () => {
                            remoteSocket.destroy();
                        });
                    }
                );
            });

            tunnelServer.on("error", (error) => {
                console.error("Tunnel server error:", error.message);
            });

            tunnelServer.listen(DB_PORT, DB_HOST, () => {
                console.log("-----------------------------------");
                console.log("AUTOMATIC SSH TUNNEL ACTIVE");
                console.log("-----------------------------------");
                console.log(
                    `Local MySQL: ${DB_HOST}:${DB_PORT}`
                );
                console.log(
                    `Remote MySQL: ${REMOTE_DB_HOST}:${REMOTE_DB_PORT}`
                );
                console.log("-----------------------------------");

                resolve();
            });
        });

        sshClient.on("error", (error) => {
            console.error("SSH connection failed:", error.message);
            tunnelPromise = null;
            reject(error);
        });

        sshClient.on("close", () => {
            console.log("SSH connection closed.");
        });

        sshClient.connect({
            host: SSH_HOST,
            port: SSH_PORT,
            username: SSH_USERNAME,
            password: SSH_PASSWORD,
            readyTimeout: 20000,
            keepaliveInterval: 10000,
            keepaliveCountMax: 3
        });
    });

    return tunnelPromise;
}

// =====================================================
// TEST MYSQL CONNECTION
// =====================================================

async function testConnection() {
    let connection;

    try {
        console.log("Starting automatic SSH tunnel...");

        await startSSHTunnel();

        console.log("Connecting to VMart database...");

        connection = await pool.getConnection();

        await connection.ping();

        const [rows] = await connection.query(`
            SELECT
                DATABASE() AS databaseName,
                CURRENT_USER() AS databaseUser,
                @@hostname AS serverHost,
                @@port AS mysqlPort
        `);

        console.log("-----------------------------------");
        console.log("MYSQL CONNECTION SUCCESSFUL");
        console.log("-----------------------------------");

        console.log("Database:", rows[0].databaseName);
        console.log("User:", rows[0].databaseUser);
        console.log("Server:", rows[0].serverHost);
        console.log("MySQL Port:", rows[0].mysqlPort);
        console.log("Connection: AUTOMATIC SSH TUNNEL");

        console.log("-----------------------------------");

        return true;

    } catch (error) {
        console.error("-----------------------------------");
        console.error("MYSQL CONNECTION FAILED");
        console.error("-----------------------------------");
        console.error("Error Code:", error.code);
        console.error("Error Message:", error.message);

        throw error;

    } finally {
        if (connection) {
            connection.release();
        }
    }
}

// =====================================================
// EXPORT
// =====================================================

module.exports = {
    pool,
    testConnection
};
