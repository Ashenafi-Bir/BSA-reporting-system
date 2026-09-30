// config/seedLegacySchedules.js
import { getPmsPool } from './db.js';
import logger from './logger.js';

/**
 * Seeds the legacy hardcoded schedules (SINGLE_CURRENCYOP001 daily and
 * LSR-Statutory ZS001 weekly) into the `schedules` table.
 *
 * Safe to call on every startup — uses IF NOT EXISTS logic by name.
 */
export async function seedLegacySchedules() {
  const pool = getPmsPool();

  const seeds = [
    {
      name: 'Daily Single Currency OP001',
      report_key: 'SINGLE_CURRENCYOP001',
      cron_expression: '0 9 * * *',                     // 11:00 AM daily
      timezone: 'Africa/Addis_Ababa',
      schedule_type: 'daily',
      date_mode: 'last_working_day_before_today',
      skip_holidays: 1,
      enabled: 1,
      description:
        'Legacy daily foreign currency exposure report. Skips holidays and submits the last working day before today.',
      created_by: 'system-init',
    },
    {
      name: 'Weekly LSR-Statutory ZS001',
      report_key: 'LSR-Statutory ZS001',
      cron_expression: '30 9 * * 4',                      // Thu 09:30 AM
      timezone: 'Africa/Addis_Ababa',
      schedule_type: 'weekly',
      date_mode: 'last_thu_wed',
      skip_holidays: 0,
      enabled: 1,
      description:
        'Legacy weekly BSD liquidity requirement report. Submits previous Thu–Wed week.',
      created_by: 'system-init',
    },
  ];

  try {
    // Make sure the table exists first (defensive)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name = 'schedules' AND xtype = 'U')
      BEGIN
        CREATE TABLE schedules (
          id                INT IDENTITY(1,1) PRIMARY KEY,
          name              NVARCHAR(200)  NOT NULL,
          report_key        NVARCHAR(200)  NOT NULL,
          cron_expression   NVARCHAR(100)  NOT NULL,
          timezone          NVARCHAR(100)  NOT NULL DEFAULT 'Africa/Addis_Ababa',
          schedule_type     NVARCHAR(50)   NOT NULL DEFAULT 'daily',
          date_mode         NVARCHAR(60)   NOT NULL DEFAULT 'today',
          skip_holidays     BIT            NOT NULL DEFAULT 0,
          enabled           BIT            NOT NULL DEFAULT 1,
          description       NVARCHAR(500)  NULL,
          params            NVARCHAR(MAX)  NULL,
          last_run_at       DATETIME2      NULL,
          last_run_status   NVARCHAR(50)   NULL,
          last_run_message  NVARCHAR(1000) NULL,
          created_by        NVARCHAR(100)  NULL,
          created_at        DATETIME2      NOT NULL DEFAULT SYSDATETIME(),
          updated_at        DATETIME2      NOT NULL DEFAULT SYSDATETIME()
        );
        CREATE INDEX IX_schedules_enabled ON schedules (enabled);
      END
    `);

    for (const seed of seeds) {
      const exists = await pool
        .request()
        .input('name', seed.name)
        .query('SELECT 1 AS x FROM schedules WHERE name = @name');

      if (exists.recordset.length > 0) {
        logger.info(`↩️  Legacy schedule already present: ${seed.name}`);
        continue;
      }

      await pool
        .request()
        .input('name', seed.name)
        .input('report_key', seed.report_key)
        .input('cron_expression', seed.cron_expression)
        .input('timezone', seed.timezone)
        .input('schedule_type', seed.schedule_type)
        .input('date_mode', seed.date_mode)
        .input('skip_holidays', seed.skip_holidays)
        .input('enabled', seed.enabled)
        .input('description', seed.description)
        .input('created_by', seed.created_by)
        .query(`
          INSERT INTO schedules (
            name, report_key, cron_expression, timezone, schedule_type,
            date_mode, skip_holidays, enabled, description, created_by
          ) VALUES (
            @name, @report_key, @cron_expression, @timezone, @schedule_type,
            @date_mode, @skip_holidays, @enabled, @description, @created_by
          )
        `);

      logger.info(`🌱 Seeded legacy schedule: ${seed.name}`);
    }

    logger.info('✅ Legacy schedule seeding complete.');
  } catch (err) {
    logger.error(`❌ seedLegacySchedules failed: ${err.message}`);
  }
}