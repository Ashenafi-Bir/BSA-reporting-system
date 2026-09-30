// src/constants/scheduleOptions.ts
import { REPORT_METADATA, REPORT_KEYS } from './reports';
import type { ReportMeta } from './reports';

export interface ReportOption {
  value: string;
  label: string;
  frequency: ReportMeta['frequency'];
  dateMode: ReportMeta['dateMode'];
  description: string;
}

export const REPORT_OPTIONS: ReportOption[] = REPORT_KEYS.map((key) => {
  const meta = REPORT_METADATA[key];
  return {
    value: key,
    label: meta.name,
    frequency: meta.frequency,
    dateMode: meta.dateMode,
    description: meta.description,
  };
});

export function getReportOption(reportKey: string): ReportOption | undefined {
  return REPORT_OPTIONS.find((o) => o.value === reportKey);
}

/* ---------- Smart defaults ---------- */

export type ScheduleType =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'custom';

export function defaultScheduleTypeForReport(reportKey: string): ScheduleType {
  const meta = REPORT_METADATA[reportKey];
  if (!meta) return 'daily';
  switch (meta.frequency) {
    case 'Daily':     return 'daily';
    case 'Weekly':    return 'weekly';
    case 'Monthly':   return 'monthly';
    case 'Quarterly': return 'quarterly';
    default:          return 'daily';
  }
}

export function defaultDateModeForReport(reportKey: string): string {
  const meta = REPORT_METADATA[reportKey];
  if (!meta) return 'today';

  if (meta.dateMode === 'single') return 'last_working_day_before_today';

  switch (meta.frequency) {
    case 'Daily':     return 'yesterday';
    case 'Weekly':    return 'last_thu_wed';
    case 'Monthly':   return 'previous_month';
    case 'Quarterly': return 'previous_quarter';
    default:          return 'today';
  }
}

/* ---------- Static option lists ---------- */

export const DATE_MODES = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_working_day_before_today', label: 'Last working day before today' },
  { value: 'last_working_day', label: 'Last working day' },
  { value: 'this_week_mon_sun', label: 'This week (Mon–Sun)' },
  { value: 'last_week_mon_sun', label: 'Last week (Mon–Sun)' },
  { value: 'last_thu_wed', label: 'Last Thu–Wed' },
  { value: 'current_month', label: 'Current month' },
  { value: 'previous_month', label: 'Previous month' },
  { value: 'current_quarter', label: 'Current quarter' },
  { value: 'previous_quarter', label: 'Previous quarter' },
  { value: 'custom', label: 'Custom (day offsets)' },
];

export const TIMEZONES = [
  'Africa/Addis_Ababa',
  'Africa/Nairobi',
  'Africa/Cairo',
  'UTC',
];

export const SCHEDULE_TYPES: { value: ScheduleType; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly (every 3 months)' },
  { value: 'custom', label: 'Custom (cron expression)' },
];

export const WEEKDAYS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

/* ---------- Cron builder ---------- */

export function buildCronExpression(
  type: string,
  hour: string,
  minute: string,
  dayOfWeek?: string,
  dayOfMonth?: string,
): string {
  const h = hour.padStart(2, '0');
  const m = minute.padStart(2, '0');

  switch (type) {
    case 'daily':
      return `${m} ${h} * * *`;
    case 'weekly':
      return `${m} ${h} * * ${dayOfWeek ?? '1'}`;
    case 'monthly':
      return `${m} ${h} ${dayOfMonth ?? '1'} * *`;
    case 'quarterly':
      // Day-of-month in Jan / Apr / Jul / Oct
      return `${m} ${h} ${dayOfMonth ?? '1'} 1,4,7,10 *`;
    default:
      return '';
  }
}