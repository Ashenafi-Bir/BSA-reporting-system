import { getPmsPool } from '../config/db.js';
import logger from '../config/logger.js';

export async function findUserByUsername(username) {
  const pool = getPmsPool();
  const query = `
    SELECT u.*, r.name as role_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.username = @username AND u.is_active = 1
  `;
  const result = await pool.request()
    .input('username', username)
    .query(query);
  return result.recordset[0] || null;
}

export async function createUser(username, fullName, roleId) {
  const pool = getPmsPool();
  const query = `
    INSERT INTO users (username, full_name, role_id)
    VALUES (@username, @fullName, @roleId);
    SELECT SCOPE_IDENTITY() AS id;
  `;
  const result = await pool.request()
    .input('username', username)
    .input('fullName', fullName)
    .input('roleId', roleId)
    .query(query);
  return result.recordset[0]?.id;
}

export async function updateUserRole(userId, roleId) {
  const pool = getPmsPool();
  const query = `
    UPDATE users SET role_id = @roleId, updated_at = GETDATE()
    WHERE id = @userId
  `;
  await pool.request()
    .input('userId', userId)
    .input('roleId', roleId)
    .query(query);
}

export async function deactivateUser(userId) {
  const pool = getPmsPool();
  const query = `UPDATE users SET is_active = 0, updated_at = GETDATE() WHERE id = @userId`;
  await pool.request().input('userId', userId).query(query);
}

export async function getAllUsers() {
  const pool = getPmsPool();
  const query = `
    SELECT u.id, u.username, u.full_name, u.is_active, u.created_at, r.name as role_name, r.id as role_id
    FROM users u
    JOIN roles r ON u.role_id = r.id
    ORDER BY u.created_at DESC
  `;
  const result = await pool.request().query(query);
  return result.recordset || [];
}