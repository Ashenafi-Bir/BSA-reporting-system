import oracledb from 'oracledb';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let oraclePool = null;

export async function initOraclePool() {
  // Validate environment variables
  const user = process.env.ORACLE_USER;
  const password = process.env.ORACLE_PASSWORD;
  const connectString = process.env.ORACLE_CONNECT_STRING;

  if (!user) throw new Error('ORACLE_USER is not defined in environment');
  if (!password) throw new Error('ORACLE_PASSWORD is not defined in environment');
  if (!connectString) throw new Error('ORACLE_CONNECT_STRING is not defined in environment');

  try {
    oraclePool = await oracledb.createPool({
      user,
      password,
      connectString,
      poolMin: 1,
      poolMax: 5,
      poolIncrement: 1,
    });
    console.log('✅ Oracle DB connection pool created.');
  } catch (error) {
    console.error('❌ Failed to create Oracle pool:', error.message);
    throw error;
  }
}

export async function executeOracleQuery(sql, binds = [], options = {}) {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      ...options,
    });
    return result;
  } catch (error) {
    console.error('❌ Oracle query failed:', error.message);
    throw error;
  } finally {
    if (connection) await connection.close();
  }
}

export async function closeOraclePool() {
  if (oraclePool) {
    await oraclePool.close(10);
    console.log('Oracle pool closed.');
  }
}

// SQLite for logging submissions
let sqliteDb = null;

export async function initSqliteDb() {
  try {
    const dbPath = path.join(__dirname, '../../data', 'submissions.db');
    // Ensure directory exists
    const fs = await import('fs');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    sqliteDb = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    await sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_key TEXT,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT,
        response TEXT,
        error TEXT
      );
    `);
    console.log('✅ SQLite DB initialized.');
    return sqliteDb;
  } catch (error) {
    console.error('❌ Failed to initialize SQLite:', error.message);
    throw error;
  }
}

export function getSqliteDb() {
  return sqliteDb;
}