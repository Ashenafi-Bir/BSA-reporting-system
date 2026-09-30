// services/scheduleRunner.js
import { processReport } from './reportProcessor.js';
import { isHoliday, getLastWorkingDayBefore } from './cbsService.js';
import * as submissionModel from '../models/submissionModel.js';
import * as scheduleModel from '../models/scheduleModel.js';
import logger from '../config/logger.js';

export const DATE_MODES = {
  TODAY: 'today',
  YESTERDAY: 'yesterday',
  LAST_WORKING_DAY_BEFORE_TODAY: 'last_working_day_before_today',
  LAST_WORKING_DAY: 'last_working_day',
  THIS_WEEK_MON_SUN: 'this_week_mon_sun',
  LAST_WEEK_MON_SUN: 'last_week_mon_sun',
  LAST_THU_WED: 'last_thu_wed',
  CURRENT_MONTH: 'current_month',
  PREVIOUS_MONTH: 'previous_month',
  CURRENT_QUARTER: 'current_quarter',
  PREVIOUS_QUARTER: 'previous_quarter',
  CUSTOM: 'custom',
};

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function resolveDateRange(schedule, now = new Date()) {
  const mode = schedule.date_mode || DATE_MODES.TODAY;
  const today = startOfDay(now);

  const getMonday = (d) => {
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const m = new Date(d);
    m.setDate(d.getDate() + diff);
    return startOfDay(m);
  };

  switch (mode) {
    case DATE_MODES.TODAY:
      return { startDate: today, endDate: today };

    case DATE_MODES.YESTERDAY: {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { startDate: y, endDate: y };
    }

    case DATE_MODES.LAST_WORKING_DAY_BEFORE_TODAY:
    case DATE_MODES.LAST_WORKING_DAY: {
      const d = await getLastWorkingDayBefore(today);
      return { startDate: d, endDate: d };
    }

    case DATE_MODES.THIS_WEEK_MON_SUN: {
      const mon = getMonday(today);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { startDate: mon, endDate: sun };
    }

    case DATE_MODES.LAST_WEEK_MON_SUN: {
      const mon = getMonday(today);
      mon.setDate(mon.getDate() - 7);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { startDate: mon, endDate: sun };
    }

    case DATE_MODES.LAST_THU_WED: {
      const dayOfWeek = today.getDay(); // 0=Sun, 4=Thu
      const daysToWednesday = (dayOfWeek - 3 + 7) % 7;
      const end = new Date(today);
      end.setDate(end.getDate() - daysToWednesday);
      end.setHours(0, 0, 0, 0);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      return { startDate: start, endDate: end };
    }

    case DATE_MODES.CURRENT_MONTH: {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { startDate: start, endDate: end };
    }

    case DATE_MODES.PREVIOUS_MONTH: {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { startDate: start, endDate: end };
    }

    case DATE_MODES.CURRENT_QUARTER: {
      // Quarter starts in Jan / Apr / Jul / Oct
      const month = today.getMonth();                        // 0..11
      const qStartMonth = Math.floor(month / 3) * 3;         // 0, 3, 6, 9
      const start = new Date(today.getFullYear(), qStartMonth, 1);
      const end = new Date(today.getFullYear(), qStartMonth + 3, 0);
      return { startDate: start, endDate: end };
    }

    case DATE_MODES.PREVIOUS_QUARTER: {
      const month = today.getMonth();
      const qStartMonth = Math.floor(month / 3) * 3;
      const start = new Date(today.getFullYear(), qStartMonth - 3, 1);
      const end = new Date(today.getFullYear(), qStartMonth, 0);
      return { startDate: start, endDate: end };
    }

    case DATE_MODES.CUSTOM: {
      const params = schedule.params ? JSON.parse(schedule.params) : {};
      const startOffset = parseInt(params.startOffset ?? 0, 10);
      const endOffset = parseInt(params.endOffset ?? 0, 10);
      const start = new Date(today);
      start.setDate(start.getDate() + startOffset);
      const end = new Date(today);
      end.setDate(end.getDate() + endOffset);
      return { startDate: start, endDate: end };
    }

    default:
      return { startDate: today, endDate: today };
  }
}

export async function runSchedule(schedule) {
  const { startDate, endDate } = await resolveDateRange(schedule);
  const dateStr = `${startDate.toISOString().slice(0, 10)} → ${endDate.toISOString().slice(0, 10)}`;

  if (schedule.skip_holidays) {
    const isHol = await isHoliday(startDate);
    if (isHol) {
      const msg = `Skipped: ${dateStr} is a holiday`;
      logger.info(`📅 Schedule ${schedule.id} (${schedule.name}) skipped – holiday.`);
      await scheduleModel.recordRun(schedule.id, 'skipped', msg);
      return { status: 'skipped', message: msg };
    }
  }

  const existing = await submissionModel.getSubmissionsByReportAndDateRange(
    schedule.report_key,
    startDate,
    endDate,
  );
  const alreadySubmitted = existing.some(s => s.status !== 'failed' && s.status !== 'cancelled');
  if (alreadySubmitted) {
    const msg = `Skipped: duplicate submission for ${dateStr}`;
    logger.info(`⏭️  Schedule ${schedule.id} (${schedule.name}) skipped – duplicate.`);
    await scheduleModel.recordRun(schedule.id, 'skipped', msg);
    return { status: 'skipped', message: msg };
  }

  try {
    await processReport(schedule.report_key, startDate, endDate);
    const msg = `Submitted successfully for ${dateStr}`;
    logger.info(`✅ Schedule ${schedule.id} (${schedule.name}) succeeded.`);
    await scheduleModel.recordRun(schedule.id, 'success', msg);
    return { status: 'success', message: msg };
  } catch (error) {
    const msg = `Failed: ${error.message}`;
    logger.error(`❌ Schedule ${schedule.id} (${schedule.name}) failed: ${error.message}`);
    await scheduleModel.recordRun(schedule.id, 'failed', msg);
    return { status: 'failed', message: msg };
  }
}