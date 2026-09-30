// models/scheduleModel.js
import { getPmsPool } from '../config/db.js';
import logger from '../config/logger.js';

export async function getAllSchedules() {
  const pool = getPmsPool();
  const result = await pool.request().query(`
    SELECT * FROM schedules ORDER BY created_at DESC
  `);
  return result.recordset || [];
}

export async function getScheduleById(id) {
  const pool = getPmsPool();
  const result = await pool.request()
    .input('id', id)
    .query('SELECT * FROM schedules WHERE id = @id');
  return result.recordset[0] || null;
}

export async function getEnabledSchedules() {
  const pool = getPmsPool();
  const result = await pool.request().query(`
    SELECT * FROM schedules WHERE enabled = 1 ORDER BY id
  `);
  return result.recordset || [];
}

export async function createSchedule(data) {
  const pool = getPmsPool();
  const query = `
    INSERT INTO schedules (
      name, report_key, cron_expression, timezone, schedule_type,
      date_mode, skip_holidays, enabled, description, params, created_by
    ) VALUES (
      @name, @report_key, @cron_expression, @timezone, @schedule_type,
      @date_mode, @skip_holidays, @enabled, @description, @params, @created_by
    );
    SELECT SCOPE_IDENTITY() AS id;
  `;
  const request = pool.request()
    .input('name', data.name)
    .input('report_key', data.report_key)
    .input('cron_expression', data.cron_expression)
    .input('timezone', data.timezone || 'Africa/Addis_Ababa')
    .input('schedule_type', data.schedule_type || 'daily')
    .input('date_mode', data.date_mode || 'today')
    .input('skip_holidays', data.skip_holidays ? 1 : 0)
    .input('enabled', data.enabled !== false ? 1 : 0)
    .input('description', data.description || null)
    .input('params', data.params ? JSON.stringify(data.params) : null)
    .input('created_by', data.created_by || null);

  const result = await request.query(query);
  const id = result.recordset[0]?.id || result.recordset[0]?.ID;
  logger.info(`✅ Schedule created with ID: ${id}`);
  return getScheduleById(id);
}

export async function updateSchedule(id, data) {
  const pool = getPmsPool();
  const fields = [];
  const values = {};

  const allowed = [
    'name', 'report_key', 'cron_expression', 'timezone', 'schedule_type',
    'date_mode', 'skip_holidays', 'enabled', 'description', 'params'
  ];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = @${key}`);
      values[key] = key === 'params' ? JSON.stringify(data[key]) : data[key];
    }
  }

  if (fields.length === 0) return getScheduleById(id);

  fields.push('updated_at = SYSDATETIME()');

  const query = `
    UPDATE schedules
    SET ${fields.join(', ')}
    WHERE id = @id
  `;

  const request = pool.request().input('id', id);
  for (const [key, value] of Object.entries(values)) {
    request.input(key, value);
  }

  await request.query(query);
  logger.info(`✅ Schedule ${id} updated.`);
  return getScheduleById(id);
}

export async function deleteSchedule(id) {
  const pool = getPmsPool();
  await pool.request()
    .input('id', id)
    .query('DELETE FROM schedules WHERE id = @id');
  logger.info(`🗑️ Schedule ${id} deleted.`);
}

export async function toggleSchedule(id, enabled) {
  const pool = getPmsPool();
  await pool.request()
    .input('id', id)
    .input('enabled', enabled ? 1 : 0)
    .query('UPDATE schedules SET enabled = @enabled, updated_at = SYSDATETIME() WHERE id = @id');
  logger.info(`🔄 Schedule ${id} enabled = ${enabled}`);
  return getScheduleById(id);
}

export async function recordRun(id, status, message) {
  const pool = getPmsPool();
  await pool.request()
    .input('id', id)
    .input('status', status)
    .input('message', message || null)
    .query(`
      UPDATE schedules
      SET last_run_at = SYSDATETIME(),
          last_run_status = @status,
          last_run_message = @message,
          updated_at = SYSDATETIME()
      WHERE id = @id
    `);
}