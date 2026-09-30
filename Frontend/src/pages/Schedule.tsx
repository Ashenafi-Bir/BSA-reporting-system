// src/pages/Schedule.tsx
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ScheduleHelp from '../components/ScheduleHelp';
import ConfirmModal from '../components/ConfirmModal';
import {
  getSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  toggleSchedule,
  runScheduleNow,
} from '../services/scheduleApi';
import type { Schedule } from '../services/scheduleApi';
import {
  REPORT_OPTIONS,
  DATE_MODES,
  TIMEZONES,
  SCHEDULE_TYPES,
  WEEKDAYS,
  buildCronExpression,
  defaultScheduleTypeForReport,
  defaultDateModeForReport,
  getReportOption,
} from '../constants/scheduleOptions';

interface FormState {
  id?: number;
  name: string;
  report_key: string;
  schedule_type: string;
  hour: string;
  minute: string;
  day_of_week: string;
  day_of_month: string;
  cron_expression: string;
  timezone: string;
  date_mode: string;
  skip_holidays: boolean;
  enabled: boolean;
  description: string;
  startOffset: string;
  endOffset: string;
}

/** Which action the user has triggered and is waiting to confirm. */
type ConfirmAction =
  | { type: 'run'; schedule: Schedule }
  | { type: 'edit'; schedule: Schedule }
  | { type: 'toggle'; schedule: Schedule }
  | { type: 'delete'; schedule: Schedule }
  | null;

const emptyForm: FormState = {
  name: '',
  report_key: REPORT_OPTIONS[0]?.value || '',
  schedule_type: 'daily',
  hour: '9',
  minute: '0',
  day_of_week: '1',
  day_of_month: '1',
  cron_expression: '',
  timezone: 'Africa/Addis_Ababa',
  date_mode: 'today',
  skip_holidays: false,
  enabled: true,
  description: '',
  startOffset: '0',
  endOffset: '0',
};

/** Parse `s.params` safely — accepts null, undefined, "null", "", or a JSON string. */
function safeParseParams(raw: unknown): Record<string, any> {
  if (raw === null || raw === undefined) return {};
  if (typeof raw === 'object') return raw as Record<string, any>;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === 'null') return {};
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** Strip leading zeros: "09" → "9", "00" → "0", "" → fallback. */
function stripZero(v: string | undefined, fallback: string): string {
  const s = (v ?? '').toString().trim();
  if (!s) return fallback;
  const n = parseInt(s, 10);
  return isNaN(n) ? fallback : String(n);
}

const SchedulePage: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const res = await getSchedules();
      const data = Array.isArray(res) ? res : res.data?.data || res.data || [];
      setSchedules(data);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load schedules' });
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    const defaultReport = REPORT_OPTIONS[0]?.value || '';
    setForm({
      ...emptyForm,
      report_key: defaultReport,
      schedule_type: defaultReport ? defaultScheduleTypeForReport(defaultReport) : 'daily',
      date_mode: defaultReport ? defaultDateModeForReport(defaultReport) : 'today',
    });
    setShowModal(true);
  };

  const openEdit = (s: Schedule) => {
    const params = safeParseParams(s.params);
    const parts = s.cron_expression.split(' ');
    setForm({
      id: s.id,
      name: s.name,
      report_key: s.report_key,
      schedule_type: s.schedule_type || 'custom',
      hour: stripZero(parts[1], '9'),
      minute: stripZero(parts[0], '0'),
      day_of_month: stripZero(parts[2], '1'),
      day_of_week: stripZero(parts[4], '1'),
      cron_expression: s.cron_expression,
      timezone: s.timezone || 'Africa/Addis_Ababa',
      date_mode: s.date_mode || 'today',
      skip_holidays: !!s.skip_holidays,
      enabled: !!s.enabled,
      description: s.description || '',
      startOffset: String(params.startOffset ?? 0),
      endOffset: String(params.endOffset ?? 0),
    });
    setShowModal(true);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target as any;
    const checked = (e.target as HTMLInputElement).checked;

    if (name === 'report_key') {
      setForm(prev => ({
        ...prev,
        report_key: value,
        ...(prev.id
          ? {}
          : {
              schedule_type: defaultScheduleTypeForReport(value),
              date_mode: defaultDateModeForReport(value),
            }),
      }));
      return;
    }

    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      let cron = form.cron_expression;
      if (form.schedule_type !== 'custom') {
        cron = buildCronExpression(
          form.schedule_type,
          form.hour,
          form.minute,
          form.day_of_week,
          form.day_of_month,
        );
      }
      if (!cron) throw new Error('Cron expression is required');

      const payload: any = {
        name: form.name,
        report_key: form.report_key,
        cron_expression: cron,
        timezone: form.timezone,
        schedule_type: form.schedule_type,
        date_mode: form.date_mode,
        skip_holidays: form.skip_holidays,
        enabled: form.enabled,
        description: form.description,
        params:
          form.date_mode === 'custom'
            ? {
                startOffset: parseInt(form.startOffset, 10) || 0,
                endOffset: parseInt(form.endOffset, 10) || 0,
              }
            : null,
      };

      if (form.id) {
        await updateSchedule(form.id, payload);
        setMessage({ type: 'success', text: 'Schedule updated' });
      } else {
        await createSchedule(payload);
        setMessage({ type: 'success', text: 'Schedule created' });
      }
      setShowModal(false);
      fetchSchedules();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- ACTIONS (executed only after confirmation) ---------------- */

  const executeDelete = async (id: number) => {
    try {
      await deleteSchedule(id);
      setMessage({ type: 'success', text: 'Schedule deleted' });
      fetchSchedules();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Delete failed' });
    }
  };

  const executeToggle = async (s: Schedule) => {
    try {
      await toggleSchedule(s.id, !s.enabled);
      setMessage({
        type: 'success',
        text: `Schedule ${s.enabled ? 'disabled' : 'enabled'}`,
      });
      fetchSchedules();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Toggle failed' });
    }
  };

  const executeRun = async (id: number) => {
    try {
      const res = await runScheduleNow(id);
      const result = res.data?.data || res.data;
      setMessage({ type: 'success', text: `Run result: ${result.status} – ${result.message}` });
      fetchSchedules();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Run failed' });
    }
  };

  /* ---------------- CONFIRMATION DISPATCHER ---------------- */

  const handleConfirm = async () => {
    if (!confirmAction) return;
    const { type, schedule } = confirmAction;
    setConfirmAction(null);

    switch (type) {
      case 'run':
        return executeRun(schedule.id);
      case 'edit':
        return openEdit(schedule);
      case 'toggle':
        return executeToggle(schedule);
      case 'delete':
        return executeDelete(schedule.id);
    }
  };

  /** Derive the ConfirmModal props from the current action. */
  const getConfirmProps = () => {
    if (!confirmAction) return null;
    const { type, schedule } = confirmAction;

    switch (type) {
      case 'run':
        return {
          title: 'Run schedule now?',
          message: `This will immediately submit "${schedule.name}" (${schedule.report_key}) using its configured date mode. It will be logged in the submission history.`,
          confirmLabel: 'Run Now',
          variant: 'primary' as const,
        };
      case 'edit':
        return {
          title: 'Edit schedule?',
          message: `You are about to modify "${schedule.name}". Any unsaved changes to other forms will be lost.`,
          confirmLabel: 'Edit',
          variant: 'primary' as const,
        };
      case 'toggle':
        return {
          title: schedule.enabled ? 'Disable schedule?' : 'Enable schedule?',
          message: schedule.enabled
            ? `Disabling "${schedule.name}" will stop it from running automatically. You can re-enable it later.`
            : `Enabling "${schedule.name}" will start running it automatically according to its cron schedule.`,
          confirmLabel: schedule.enabled ? 'Disable' : 'Enable',
          variant: 'warning' as const,
        };
      case 'delete':
        return {
          title: 'Delete schedule?',
          message: `This will permanently remove "${schedule.name}". Past submissions remain in history, but the schedule cannot be recovered.`,
          confirmLabel: 'Delete',
          variant: 'danger' as const,
        };
    }
  };

  if (!user) return <div className="loading-spinner">Loading...</div>;

  const selectedMeta = getReportOption(form.report_key);
  const confirmProps = getConfirmProps();

  return (
    <div className="app-layout">
      <Sidebar user={user} />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1>Schedules</h1>
            <p>Manage automated report submissions</p>
          </div>
          <div className="page-header-actions">
            <button
              className="btn btn-secondary help-btn"
              onClick={() => setShowHelp(true)}
              title="How does the scheduler work?"
            >
              ? Help
            </button>
            <button className="btn btn-primary" onClick={openCreate}>
              + New Schedule
            </button>
          </div>
        </div>

        {message && (
          <div className={`alert alert-${message.type}`}>
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)}>×</button>
          </div>
        )}

        {loading ? (
          <p className="empty-state">Loading schedules…</p>
        ) : schedules.length === 0 ? (
          <p className="empty-state">No schedules found. Create one to get started.</p>
        ) : (
          <div className="schedule-list">
            {schedules.map(s => {
              const meta = getReportOption(s.report_key);
              const statusClass =
                s.last_run_status === 'success'
                  ? 'is-success'
                  : s.last_run_status === 'failed'
                  ? 'is-failed'
                  : s.last_run_status === 'skipped'
                  ? 'is-skipped'
                  : '';

              return (
                <div
                  key={s.id}
                  className={`schedule-card ${!s.enabled ? 'disabled' : ''}`}
                >
                  {/* Top row */}
                  <div className="schedule-card-top">
                    <div className="schedule-title-block">
                      <h3>{s.name}</h3>
                      <span className="schedule-report" title={s.report_key}>
                        {meta ? meta.label : s.report_key}
                      </span>
                    </div>
                    <span
                      className={`badge ${s.enabled ? 'badge-approved' : 'badge-rejected'}`}
                    >
                      {s.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>

                  {/* Meta grid */}
                  <div className="schedule-meta">
                    <div className="meta-item">
                      <span className="meta-label">Cron</span>
                      <span className="meta-value mono">{s.cron_expression}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Timezone</span>
                      <span className="meta-value muted">{s.timezone}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Date mode</span>
                      <span className="meta-value">{s.date_mode}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Skip holidays</span>
                      <span className="meta-value">{s.skip_holidays ? 'Yes' : 'No'}</span>
                    </div>
                    {s.next_run && (
                      <div className="meta-item">
                        <span className="meta-label">Next run</span>
                        <span className="meta-value">
                          {new Date(s.next_run).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {s.last_run_at && (
                      <div className="meta-item">
                        <span className="meta-label">Last run</span>
                        <span className="meta-value">
                          {new Date(s.last_run_at).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {s.description && (
                    <div className="schedule-desc-line">
                      <span className="meta-label">Note</span>
                      <span className="schedule-desc-text" title={s.description}>
                        {s.description}
                      </span>
                    </div>
                  )}

                  {/* Last run message */}
                  {s.last_run_message && (
                    <div
                      className={`schedule-last-message ${statusClass}`}
                      title={s.last_run_message}
                    >
                      {s.last_run_status && (
                        <span className={`badge badge-${statusClass.replace('is-', '')}`}>
                          {s.last_run_status}
                        </span>
                      )}
                      <span>{s.last_run_message}</span>
                    </div>
                  )}

                  {/* Actions — every one goes through ConfirmModal */}
                  <div className="schedule-actions">
                    {/* <button
                      onClick={() => setConfirmAction({ type: 'run', schedule: s })}
                      className="btn-run"
                    >
                      Run Now
                    </button> */}
                    <button
                      onClick={() => setConfirmAction({ type: 'edit', schedule: s })}
                      className="btn-edit"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setConfirmAction({ type: 'toggle', schedule: s })}
                      className={s.enabled ? 'btn-disable' : 'btn-enable'}
                    >
                      {s.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() => setConfirmAction({ type: 'delete', schedule: s })}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ---------------- New / Edit Schedule Modal ---------------- */}
        {showModal && (
          <div
            className="modal-overlay"
            onClick={e => {
              if (e.target === e.currentTarget) setShowModal(false);
            }}
          >
            <div className="modal">
              <h2 className="modal-title">{form.id ? 'Edit Schedule' : 'New Schedule'}</h2>

              <div className="form-grid">
                <label className="full-width">
                  Name
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g. Daily Single Currency OP001"
                  />
                </label>

                <label className="full-width">
                  Report
                  <select name="report_key" value={form.report_key} onChange={handleChange}>
                    {REPORT_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>
                        {o.label} — {o.frequency}
                      </option>
                    ))}
                  </select>
                  {selectedMeta && (
                    <small className="hint">
                      {selectedMeta.description} ·{' '}
                      {selectedMeta.dateMode === 'single' ? 'Single date' : 'Date range'}
                    </small>
                  )}
                </label>

                <label>
                  Schedule Type
                  <select
                    name="schedule_type"
                    value={form.schedule_type}
                    onChange={handleChange}
                  >
                    {SCHEDULE_TYPES.map(t => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Timezone
                  <select name="timezone" value={form.timezone} onChange={handleChange}>
                    {TIMEZONES.map(tz => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </label>

                {form.schedule_type === 'daily' && (
                  <>
                    <label>
                      Hour
                      <input
                        name="hour"
                        value={form.hour}
                        onChange={handleChange}
                        placeholder="9"
                      />
                    </label>
                    <label>
                      Minute
                      <input
                        name="minute"
                        value={form.minute}
                        onChange={handleChange}
                        placeholder="0"
                      />
                    </label>
                  </>
                )}

                {form.schedule_type === 'weekly' && (
                  <>
                    <label>
                      Day of Week
                      <select
                        name="day_of_week"
                        value={form.day_of_week}
                        onChange={handleChange}
                      >
                        {WEEKDAYS.map(d => (
                          <option key={d.value} value={d.value}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Hour
                      <input name="hour" value={form.hour} onChange={handleChange} />
                    </label>
                    <label>
                      Minute
                      <input name="minute" value={form.minute} onChange={handleChange} />
                    </label>
                  </>
                )}

                {(form.schedule_type === 'monthly' ||
                  form.schedule_type === 'quarterly') && (
                  <>
                    <label>
                      Day of Month
                      <input
                        name="day_of_month"
                        value={form.day_of_month}
                        onChange={handleChange}
                      />
                    </label>
                    <label>
                      Hour
                      <input name="hour" value={form.hour} onChange={handleChange} />
                    </label>
                    <label>
                      Minute
                      <input name="minute" value={form.minute} onChange={handleChange} />
                    </label>
                  </>
                )}

                {form.schedule_type === 'quarterly' && (
                  <p className="hint full-width">
                    Runs on the chosen day of January, April, July and October.
                  </p>
                )}

                {form.schedule_type === 'custom' && (
                  <label className="full-width">
                    Cron Expression
                    <input
                      name="cron_expression"
                      value={form.cron_expression}
                      onChange={handleChange}
                      placeholder="* * * * *"
                    />
                  </label>
                )}

                <label className="full-width">
                  Date Mode
                  <select name="date_mode" value={form.date_mode} onChange={handleChange}>
                    {DATE_MODES.map(m => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  {selectedMeta && !form.id && (
                    <small className="hint">
                      Suggested for {selectedMeta.frequency} report:{' '}
                      <strong>{defaultDateModeForReport(form.report_key)}</strong>
                    </small>
                  )}
                </label>

                {form.date_mode === 'custom' && (
                  <>
                    <label>
                      Start Offset (days)
                      <input
                        name="startOffset"
                        value={form.startOffset}
                        onChange={handleChange}
                      />
                    </label>
                    <label>
                      End Offset (days)
                      <input
                        name="endOffset"
                        value={form.endOffset}
                        onChange={handleChange}
                      />
                    </label>
                  </>
                )}

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="skip_holidays"
                    checked={form.skip_holidays}
                    onChange={handleChange}
                  />
                  Skip Holidays
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="enabled"
                    checked={form.enabled}
                    onChange={handleChange}
                  />
                  Enabled
                </label>

                <label className="full-width">
                  Description
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows={2}
                  />
                </label>
              </div>

              <div className="modal-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- Confirm Action Modal ---------------- */}
        {confirmProps && (
          <ConfirmModal
            isOpen={true}
            title={confirmProps.title}
            message={confirmProps.message}
            confirmLabel={confirmProps.confirmLabel}
            variant={confirmProps.variant}
            onConfirm={handleConfirm}
            onCancel={() => setConfirmAction(null)}
          />
        )}

        {/* ---------------- Help Modal ---------------- */}
        {showHelp && <ScheduleHelp onClose={() => setShowHelp(false)} />}
      </main>
    </div>
  );
};

export default SchedulePage;