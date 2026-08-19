import { getPmsPool } from '../config/db.js';
import logger from '../config/logger.js';

export async function createSubmission(data) {
  const pool = getPmsPool();
  const query = `
    INSERT INTO submissions (
      report_key, filename, start_date, end_date, status, response, error
    ) VALUES (
      @report_key, @filename, @start_date, @end_date, @status, @response, @error
    );
    SELECT SCOPE_IDENTITY() AS id;
  `;
  const request = pool.request()
    .input('report_key', data.report_key)
    .input('filename', data.filename || null)
    .input('start_date', data.start_date || null)
    .input('end_date', data.end_date || null)
    .input('status', data.status || 'submitted')
    .input('response', data.response || null)
    .input('error', data.error || null);

  const result = await request.query(query);
  const id = result.recordset[0]?.id || result.recordset[0]?.ID;
  logger.info(`✅ Submission created with ID: ${id}`);
  return id;
}

export async function updateSubmission(id, data) {
  const pool = getPmsPool();
  const fields = [];
  const values = {};

  if (data.filename !== undefined) { fields.push('filename = @filename'); values.filename = data.filename; }
  if (data.status !== undefined) { fields.push('status = @status'); values.status = data.status; }
  if (data.response !== undefined) { fields.push('response = @response'); values.response = data.response; }
  if (data.error !== undefined) { fields.push('error = @error'); values.error = data.error; }
  if (data.bsa_status !== undefined) { fields.push('bsa_status = @bsa_status'); values.bsa_status = data.bsa_status; }
  if (data.bsa_notification !== undefined) { fields.push('bsa_notification = @bsa_notification'); values.bsa_notification = data.bsa_notification; }
  if (data.processing_results !== undefined) { fields.push('processing_results = @processing_results'); values.processing_results = data.processing_results; }
  if (data.status_checked_at !== undefined) { fields.push('status_checked_at = @status_checked_at'); values.status_checked_at = data.status_checked_at; }

  if (fields.length === 0) return;

  const query = `
    UPDATE submissions
    SET ${fields.join(', ')}
    WHERE id = @id
  `;

  const request = pool.request()
    .input('id', id);

  for (const [key, value] of Object.entries(values)) {
    request.input(key, value);
  }

  await request.query(query);
  logger.info(`✅ Submission ${id} updated.`);
}

export async function getSubmissionById(id) {
  const pool = getPmsPool();
  const query = `SELECT * FROM submissions WHERE id = @id`;
  const result = await pool.request()
    .input('id', id)
    .query(query);
  return result.recordset[0] || null;
}

export async function getSubmissions(limit = 50, offset = 0) {
  const pool = getPmsPool();
  const query = `
    SELECT * FROM submissions
    ORDER BY submitted_at DESC
    OFFSET @offset ROWS
    FETCH NEXT @limit ROWS ONLY
  `;
  const result = await pool.request()
    .input('offset', offset)
    .input('limit', limit)
    .query(query);
  return result.recordset || [];
}

export async function getSubmissionByFilename(filename) {
  const pool = getPmsPool();
  const query = `SELECT * FROM submissions WHERE filename = @filename`;
  const result = await pool.request()
    .input('filename', filename)
    .query(query);
  return result.recordset[0] || null;
}