import oracledb from 'oracledb';
import sql from 'mssql';
import logger from './logger.js';

// ---------- Oracle Pool (CBS) ----------
let oraclePool = null;

export async function initOraclePool() {
  const user = process.env.ORACLE_USER;
  const password = process.env.ORACLE_PASSWORD;
  const connectString = process.env.ORACLE_CONNECT_STRING;

  if (!user) throw new Error('ORACLE_USER is not defined');
  if (!password) throw new Error('ORACLE_PASSWORD is not defined');
  if (!connectString) throw new Error('ORACLE_CONNECT_STRING is not defined');

  try {
    oraclePool = await oracledb.createPool({
      user,
      password,
      connectString,
      poolMin: 1,
      poolMax: 1,  // reduce to 3 to avoid too many connections
      poolIncrement: 1,
      poolTimeout: 60, // release idle connections after 60 seconds
      queueTimeout: 60000, // wait for connection for 60 seconds
    });
    logger.info('✅ Oracle DB connection pool created.');
  } catch (error) {
    if (error.message.includes('ORA-28000')) {
      logger.error(`❌ Oracle account "${user}" is locked. Please ask your DBA to unlock it using: ALTER USER ${user} ACCOUNT UNLOCK;`);
    } else {
      logger.error(`❌ Failed to create Oracle pool: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Execute an Oracle query with automatic retry for ORA-28000 (account locked).
 */
export async function executeOracleQuery(sqlText, binds = [], options = {}, retryCount = 0) {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(sqlText, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      ...options,
    });
    return result;
  } catch (error) {
    if (error.message.includes('ORA-28000')) {
      logger.error(`❌ Oracle account is locked. Attempt ${retryCount + 1} of 3.`);
      if (retryCount < 2) {
        // Wait 2 seconds then retry (account might be unlocked by DBA)
        await new Promise(resolve => setTimeout(resolve, 2000));
        return executeOracleQuery(sqlText, binds, options, retryCount + 1);
      } else {
        logger.error(`❌ Oracle account remains locked after 3 attempts. Please unlock the account.`);
        throw error;
      }
    } else {
      logger.error(`❌ Oracle query failed: ${error.message}`);
      throw error;
    }
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeError) {
        logger.error(`Failed to close Oracle connection: ${closeError.message}`);
      }
    }
  }
}

export async function closeOraclePool() {
  if (oraclePool) {
    await oraclePool.close(10);
    logger.info('Oracle pool closed.');
  }
}

// ---------- PMS SQL Server Pool (Submissions history) ----------
let pmsPool = null;

export async function initPmsPool() {
  const config = {
    user: process.env.PMS_DB_USER,
    password: process.env.PMS_DB_PASSWORD,
    server: process.env.PMS_DB_HOST,
    database: process.env.PMS_DB_NAME,
    options: {
      instanceName: process.env.PMS_DB_INSTANCE,
      encrypt: false,
      trustServerCertificate: true,
      connectTimeout: 30000,
      requestTimeout: 30000,
    },
  };

  if (!config.user) throw new Error('PMS_DB_USER is not defined');
  if (!config.password) throw new Error('PMS_DB_PASSWORD is not defined');
  if (!config.server) throw new Error('PMS_DB_HOST is not defined');
  if (!config.database) throw new Error('PMS_DB_NAME is not defined');

  try {
    pmsPool = await sql.connect(config);
    logger.info('✅ PMS SQL Server connection pool created.');
    await createSubmissionsTable();
    return pmsPool;
  } catch (error) {
    logger.error(`❌ Failed to create PMS pool: ${error.message}`);
    throw error;
  }
}

async function createSubmissionsTable() {
  const query = `
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='submissions' AND xtype='U')
    CREATE TABLE submissions (
      id INT IDENTITY(1,1) PRIMARY KEY,
      report_key NVARCHAR(100) NOT NULL,
      filename NVARCHAR(255) NULL,
      start_date DATETIME NULL,
      end_date DATETIME NULL,
      submitted_at DATETIME DEFAULT GETDATE(),
      status NVARCHAR(50) DEFAULT 'submitted',
      response NVARCHAR(MAX) NULL,
      error NVARCHAR(MAX) NULL,
      bsa_status NVARCHAR(50) NULL,
      bsa_notification NVARCHAR(MAX) NULL,
      processing_results NVARCHAR(MAX) NULL,
      status_checked_at DATETIME NULL
    );
  `;
  try {
    await pmsPool.request().query(query);
    logger.info('✅ Submissions table ready.');
  } catch (error) {
    logger.error(`❌ Failed to create submissions table: ${error.message}`);
    throw error;
  }
}

export function getPmsPool() {
  return pmsPool;
}

export async function closePmsPool() {
  if (pmsPool) {
    await pmsPool.close();
    logger.info('PMS pool closed.');
  }
}