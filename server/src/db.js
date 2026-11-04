'use strict';

const sql = require('mssql');

function config(database = process.env.DB_DATABASE) {
  for (const name of ['DB_SERVER', 'DB_USER', 'DB_PASSWORD']) {
    if (!process.env[name]) throw new Error(`Missing environment variable: ${name}`);
  }
  if (!database) throw new Error('Missing DB_DATABASE');
  return {
    server: process.env.DB_SERVER,
    port: Number(process.env.DB_PORT || 1433),
    database,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionTimeout: 10000,
    requestTimeout: 15000,
    pool: { min: 0, max: 5, idleTimeoutMillis: 30000 },
    options: {
      encrypt: process.env.DB_ENCRYPT !== 'false',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
    }
  };
}

let poolPromise;
function getPool() {
  if (!poolPromise) {
    const pool = new sql.ConnectionPool(config());
    pool.on('error', () => console.error('SQL pool connection error'));
    poolPromise = pool.connect().catch(error => {
      poolPromise = undefined;
      throw error;
    });
  }
  return poolPromise;
}

async function closePool() {
  if (poolPromise) await (await poolPromise).close();
}

module.exports = { sql, config, getPool, closePool };
