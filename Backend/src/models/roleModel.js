import { getPmsPool } from '../config/db.js';

export async function getAllRoles() {
  const pool = getPmsPool();
  const result = await pool.request().query('SELECT id, name FROM roles ORDER BY name');
  return result.recordset || [];
}

export async function getReportsForRole(roleId) {
  const pool = getPmsPool();
  const query = `
    SELECT report_key FROM role_reports WHERE role_id = @roleId
  `;
  const result = await pool.request().input('roleId', roleId).query(query);
  return result.recordset.map(row => row.report_key) || [];
}

export async function assignReportsToRole(roleId, reportKeys) {
  const pool = getPmsPool();
  // Clear existing
  await pool.request().input('roleId', roleId).query('DELETE FROM role_reports WHERE role_id = @roleId');
  // Insert new
  for (const key of reportKeys) {
    await pool.request()
      .input('roleId', roleId)
      .input('reportKey', key)
      .query('INSERT INTO role_reports (role_id, report_key) VALUES (@roleId, @reportKey)');
  }
}