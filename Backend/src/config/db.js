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
      poolMax: 5,
      poolIncrement: 1,
    });
    logger.info('✅ Oracle DB connection pool created.');
  } catch (error) {
    if (error.message.includes('ORA-28000')) {
      logger.error(`❌ Oracle account "${user}" is locked. Please ask your DBA to unlock it.`);
    } else {
      logger.error(`❌ Failed to create Oracle pool: ${error.message}`);
    }
    throw error;
  }
}

export async function executeOracleQuery(sqlText, binds = [], options = {}) {
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
      logger.error(`❌ Oracle account is locked. Cannot execute query.`);
    } else {
      logger.error(`❌ Oracle query failed: ${error.message}`);
    }
    throw error;
  } finally {
    if (connection) await connection.close();
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
    },
  };

  if (!config.user) throw new Error('PMS_DB_USER is not defined');
  if (!config.password) throw new Error('PMS_DB_PASSWORD is not defined');
  if (!config.server) throw new Error('PMS_DB_HOST is not defined');
  if (!config.database) throw new Error('PMS_DB_NAME is not defined');

  try {
    pmsPool = await sql.connect(config);
    logger.info('✅ PMS SQL Server connection pool created.');
    await initializeDatabase(); // <-- Run init after connection
    return pmsPool;
  } catch (error) {
    logger.error(`❌ Failed to create PMS pool: ${error.message}`);
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

// ============ DATABASE INITIALIZATION ============
async function initializeDatabase() {
  const pool = getPmsPool();
  if (!pool) throw new Error('PMS pool not available for initialization');

  logger.info('🚀 Running database initialization...');

  try {
    // 1. Create tables if they don't exist
    await createTables(pool);

    // 2. Insert default roles
    await insertDefaultRoles(pool);

    // 3. Insert default role-report mappings
    await insertDefaultRoleReports(pool);

    // 4. Create admin user if not exists
    await createAdminUser(pool);

    logger.info('✅ Database initialization complete.');
  } catch (error) {
    logger.error(`❌ Database initialization failed: ${error.message}`);
    throw error;
  }
}

async function createTables(pool) {
  // Roles table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='roles' AND xtype='U')
    CREATE TABLE roles (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(50) NOT NULL UNIQUE,
      created_at DATETIME DEFAULT GETDATE()
    )
  `);

  // Role-Reports mapping table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='role_reports' AND xtype='U')
    CREATE TABLE role_reports (
      id INT IDENTITY(1,1) PRIMARY KEY,
      role_id INT NOT NULL,
      report_key NVARCHAR(100) NOT NULL,
      created_at DATETIME DEFAULT GETDATE(),
      FOREIGN KEY (role_id) REFERENCES roles(id),
      UNIQUE (role_id, report_key)
    )
  `);

  // Users table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
    CREATE TABLE users (
      id INT IDENTITY(1,1) PRIMARY KEY,
      username NVARCHAR(100) NOT NULL UNIQUE,
      full_name NVARCHAR(255) NOT NULL,
      role_id INT NOT NULL,
      is_active BIT DEFAULT 1,
      created_at DATETIME DEFAULT GETDATE(),
      updated_at DATETIME DEFAULT GETDATE(),
      FOREIGN KEY (role_id) REFERENCES roles(id)
    )
  `);

  // Submissions table (if not created elsewhere)
  await pool.request().query(`
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
    )
  `);

  logger.info('✅ Tables checked/created.');
}

async function insertDefaultRoles(pool) {
  const roles = ['Admin', 'ITMaker', 'IBD', 'Finance', 'Credit'];
  for (const role of roles) {
    await pool.request()
      .input('name', role)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM roles WHERE name = @name)
        INSERT INTO roles (name) VALUES (@name)
      `);
  }
  logger.info('✅ Default roles inserted.');
}

async function insertDefaultRoleReports(pool) {
  // IBD -> SINGLE_CURRENCYOP001
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM role_reports rr
      JOIN roles r ON rr.role_id = r.id
      WHERE r.name = 'IBD' AND rr.report_key = 'SINGLE_CURRENCYOP001'
    )
    INSERT INTO role_reports (role_id, report_key)
    SELECT id, 'SINGLE_CURRENCYOP001' FROM roles WHERE name = 'IBD'
  `);

  // Finance -> LSR-Statutory ZS001
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM role_reports rr
      JOIN roles r ON rr.role_id = r.id
      WHERE r.name = 'Finance' AND rr.report_key = 'LSR-Statutory ZS001'
    )
    INSERT INTO role_reports (role_id, report_key)
    SELECT id, 'LSR-Statutory ZS001' FROM roles WHERE name = 'Finance'
  `);

  // ITMaker -> both reports
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM role_reports rr
      JOIN roles r ON rr.role_id = r.id
      WHERE r.name = 'ITMaker' AND rr.report_key = 'SINGLE_CURRENCYOP001'
    )
    INSERT INTO role_reports (role_id, report_key)
    SELECT id, 'SINGLE_CURRENCYOP001' FROM roles WHERE name = 'ITMaker'
  `);
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM role_reports rr
      JOIN roles r ON rr.role_id = r.id
      WHERE r.name = 'ITMaker' AND rr.report_key = 'LSR-Statutory ZS001'
    )
    INSERT INTO role_reports (role_id, report_key)
    SELECT id, 'LSR-Statutory ZS001' FROM roles WHERE name = 'ITMaker'
  `);

  logger.info('✅ Default role-report mappings inserted.');
}

async function createAdminUser(pool) {
  const adminUsername = 'Ashenafi.birhanu';
  const adminFullName = 'Ashenafi Birhanu';

  // Check if user already exists
  const check = await pool.request()
    .input('username', adminUsername)
    .query('SELECT id FROM users WHERE username = @username');

  if (check.recordset.length > 0) {
    logger.info(`✅ Admin user '${adminUsername}' already exists.`);
    return;
  }

  // Get Admin role ID
  const roleResult = await pool.request()
    .query("SELECT id FROM roles WHERE name = 'Admin'");
  if (roleResult.recordset.length === 0) {
    throw new Error("Admin role not found. Please ensure roles table is populated.");
  }
  const adminRoleId = roleResult.recordset[0].id;

  // Insert user
  await pool.request()
    .input('username', adminUsername)
    .input('fullName', adminFullName)
    .input('roleId', adminRoleId)
    .query(`
      INSERT INTO users (username, full_name, role_id, is_active)
      VALUES (@username, @fullName, @roleId, 1)
    `);

  logger.info(`✅ Admin user '${adminUsername}' created with Admin role.`);
}