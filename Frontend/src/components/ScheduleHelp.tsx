// src/components/ScheduleHelp.tsx
import React, { useState } from 'react';

interface ScheduleHelpProps {
  onClose: () => void;
}

const ScheduleHelp: React.FC<ScheduleHelpProps> = ({ onClose }) => {
  const [tab, setTab] = useState<'user' | 'developer'>('user');

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal help-modal">
        <div className="help-header">
          <h2 className="modal-title">📘 Scheduler Help</h2>
          <button className="help-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="help-tabs">
          <button
            className={`help-tab ${tab === 'user' ? 'active' : ''}`}
            onClick={() => setTab('user')}
          >
            👤 User Guide
          </button>
          <button
            className={`help-tab ${tab === 'developer' ? 'active' : ''}`}
            onClick={() => setTab('developer')}
          >
            🛠️ Developer Guide
          </button>
        </div>

        <div className="help-content">
          {tab === 'user' ? <UserGuide /> : <DeveloperGuide />}
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
 * USER GUIDE — plain-language explanation of schedulers
 * ============================================================ */
const UserGuide: React.FC = () => (
  <>
    <section className="help-section">
      <h3>What is a "schedule"?</h3>
      <p>
        A schedule automatically submits a report to the National Bank at a
        set time — without you having to click anything. Think of it as an
        alarm clock for reports.
      </p>
    </section>

    <section className="help-section">
      <h3>What do the fields mean?</h3>
      <ul>
        <li>
          <strong>Name</strong> — A friendly label so you can recognise it.
          Choose anything, e.g. "Weekly Liquidity Report".
        </li>
        <li>
          <strong>Report</strong> — Which report gets submitted (chosen from
          the list of reports you're allowed to send).
        </li>
        <li>
          <strong>Schedule Type</strong> — How often it runs:
          <em> Daily, Weekly, Monthly, Quarterly,</em> or <em>Custom</em> for
          advanced cron expressions.
        </li>
        <li>
          <strong>Hour / Minute</strong> — The exact time of day the report
          is submitted. Uses 24-hour format.
        </li>
        <li>
          <strong>Timezone</strong> — Which clock to use. Default is Addis
          Ababa (UTC+3).
        </li>
        <li>
          <strong>Date Mode</strong> — <em>Which dates the report covers.</em>{' '}
          For example, "Previous month" means the report will contain data
          from last month when it runs. See the section below.
        </li>
        <li>
          <strong>Skip Holidays</strong> — If ticked, the report won't be
          submitted on public holidays. It will automatically look for the
          last working day instead.
        </li>
        <li>
          <strong>Enabled</strong> — Pause a schedule without deleting it.
          Disabled schedules won't run.
        </li>
      </ul>
    </section>

    <section className="help-section">
      <h3>Date modes explained</h3>
      <table className="help-table">
        <thead>
          <tr>
            <th>Mode</th>
            <th>What it submits</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Today</td><td>Data for today only.</td></tr>
          <tr><td>Yesterday</td><td>Data for yesterday only.</td></tr>
          <tr><td>Last working day</td><td>The most recent non-holiday date.</td></tr>
          <tr><td>This week (Mon–Sun)</td><td>Full current Monday-to-Sunday range.</td></tr>
          <tr><td>Last week (Mon–Sun)</td><td>Full previous Monday-to-Sunday range.</td></tr>
          <tr><td>Last Thu–Wed</td><td>The most recent Thursday-through-Wednesday week (used by weekly NBE reports).</td></tr>
          <tr><td>Current month</td><td>1st of this month → last day of this month.</td></tr>
          <tr><td>Previous month</td><td>All of last month.</td></tr>
          <tr><td>Current quarter</td><td>The three months of the current quarter.</td></tr>
          <tr><td>Previous quarter</td><td>The three months of the last completed quarter (used by quarterly reports).</td></tr>
          <tr><td>Custom</td><td>Offset in days — e.g. start = −5, end = −1 means the 5 days ending yesterday.</td></tr>
        </tbody>
      </table>
    </section>

    <section className="help-section">
      <h3>Reading a schedule card</h3>
      <ul>
        <li>
          <strong>Badge (Enabled / Disabled)</strong> — Whether it will run.
        </li>
        <li>
          <strong>Next run</strong> — The next date and time it will fire.
        </li>
        <li>
          <strong>Last run</strong> — The most recent run, its result
          (<em>success</em>, <em>failed</em>, or <em>skipped</em>) and a short
          note about what happened.
        </li>
      </ul>
    </section>

    <section className="help-section">
      <h3>What "skipped" means</h3>
      <p>
        The scheduler checked and decided <em>not</em> to submit. This usually
        means either today is a holiday, or the report for those dates was
        already submitted — so submitting again would just create duplicates.
      </p>
    </section>

    <section className="help-section">
      <h3>Buttons on each card</h3>
      <ul>
        <li><strong>Run Now</strong> — Manually trigger the schedule right now (great for testing).</li>
        <li><strong>Edit</strong> — Change any setting.</li>
        <li><strong>Enable / Disable</strong> — Pause or resume without deleting.</li>
        <li><strong>Delete</strong> — Permanently remove the schedule.</li>
      </ul>
    </section>

    <section className="help-section">
      <h3>Common questions</h3>
      <dl className="help-faq">
        <dt>Can I have two schedules for the same report?</dt>
        <dd>Yes — one daily, one weekly, etc. Each runs independently.</dd>

        <dt>What if the server is off during a scheduled time?</dt>
        <dd>
          The run is missed. Once the server starts, next-run times are
          recalculated from that moment onward.
        </dd>

        <dt>How do I stop all schedules at once?</dt>
        <dd>
          Set <code>ENABLE_SCHEDULERS=false</code> in the backend
          <code> .env</code> and restart the server.
        </dd>
      </dl>
    </section>
  </>
);

/* ============================================================
 * DEVELOPER GUIDE — what to do when adding a new report
 * ============================================================ */
const DeveloperGuide: React.FC = () => (
  <>
    <section className="help-section">
      <h3>Adding a new report — checklist</h3>
      <p>
        Follow these steps in order. Every new report must be registered in
        three places; skipping any of them means the schedule will silently
        fail.
      </p>

      <h4>1. Frontend metadata — <code>src/constants/reports.tsx</code></h4>
      <p>Add a new entry to <code>REPORT_METADATA</code>:</p>
      <pre className="help-code">{`MY_NEW_REPORT_KEY: {
  key: 'MY_NEW_REPORT_KEY',
  name: 'Human-friendly report name',
  description: 'What this report contains',
  frequency: 'Monthly',        // Daily | Weekly | Monthly | Quarterly
  isWeekly: false,
  dateMode: 'range',           // 'single' for one date, 'range' for two
},`}</pre>
      <p className="hint">
        The <code>REPORT_OPTIONS</code> dropdown, default schedule type and
        default date mode are all derived from this — so they update
        automatically.
      </p>

      <h4>2. Backend report processor — <code>services/reportProcessor.js</code></h4>
      <p>
        Your <code>processReport(reportKey, start, end)</code> must handle the
        new key. Usually this means:
      </p>
      <ul>
        <li>Add a payload builder that runs the correct SQL query.</li>
        <li>Add the BSA mapping (filename pattern, endpoint, XML/CSV shape).</li>
        <li>Register it in the <code>REPORT_HANDLERS</code> map.</li>
      </ul>

      <h4>3. Verify the key spelling everywhere</h4>
      <p>
        The frontend key and the backend key must match <em>exactly</em>.
        A stray space or case difference will cause a "no handler" error at
        runtime. Existing keys in the database are stored as
        <code> report_key</code> on the <code>schedules</code> table.
      </p>

      <h4>4. Create a schedule</h4>
      <p>
        Either use the <strong>+ New Schedule</strong> button on the
        Schedules page, or seed it in
        <code> config/seedLegacySchedules.js</code> if it must exist on
        every fresh install.
      </p>
    </section>

    <section className="help-section">
      <h3>Cron expression cheat sheet</h3>
      <p>
        Cron format: <code>minute hour dayOfMonth month dayOfWeek</code>.
      </p>
      <table className="help-table">
        <thead>
          <tr><th>Expression</th><th>Meaning</th></tr>
        </thead>
        <tbody>
          <tr><td><code>0 11 * * *</code></td><td>Every day at 11:00</td></tr>
          <tr><td><code>30 9 * * 4</code></td><td>Every Thursday at 09:30</td></tr>
          <tr><td><code>0 9 1 * *</code></td><td>1st of every month at 09:00</td></tr>
          <tr><td><code>0 9 1 1,4,7,10 *</code></td><td>Quarterly — 1st of Jan/Apr/Jul/Oct at 09:00</td></tr>
          <tr><td><code>0 0 1 1 *</code></td><td>Once a year on 1 Jan at 00:00</td></tr>
          <tr><td><code>*/15 * * * *</code></td><td>Every 15 minutes</td></tr>
        </tbody>
      </table>
      <p className="hint">
        Always set the timezone explicitly on the schedule (Addis Ababa by
        default) — never rely on the server's local time.
      </p>
    </section>

    <section className="help-section">
      <h3>Available date modes (backend)</h3>
      <p>Defined in <code>services/scheduleRunner.js</code>:</p>
      <pre className="help-code">{`today
yesterday
last_working_day_before_today
last_working_day
this_week_mon_sun
last_week_mon_sun
last_thu_wed
current_month
previous_month
current_quarter
previous_quarter
custom  (uses params.startOffset / params.endOffset)`}</pre>
      <p>
        <strong>Adding a new one:</strong> edit the <code>DATE_MODES</code>{' '}
        constant, add a <code>case</code> in <code>resolveDateRange()</code>{' '}
        and a matching entry in <code>DATE_MODES</code> in
        <code> src/constants/scheduleOptions.ts</code>. Restart the backend so
        the enum is picked up.
      </p>
    </section>

    <section className="help-section">
      <h3>Where things live</h3>
      <ul>
        <li><code>schedules</code> table → all schedule rows (PMS database).</li>
        <li><code>schedulers/cronJobs.js</code> → loads enabled rows and registers cron tasks.</li>
        <li><code>services/scheduleRunner.js</code> → executes a schedule (date resolution, holiday/dup checks, calls <code>processReport</code>).</li>
        <li><code>controllers/scheduleController.js</code> → REST handlers.</li>
        <li><code>routes/schedules.js</code> → HTTP routes.</li>
        <li><code>config/seedLegacySchedules.js</code> → auto-seeds the two legacy schedules on every boot.</li>
      </ul>
    </section>

    <section className="help-section">
      <h3>Debugging a failed run</h3>
      <ol>
        <li>Look at <strong>Last run</strong> on the card — the message tells you why (holiday, duplicate, error).</li>
        <li>Check backend logs for the schedule's ID (e.g. <code>Schedule 4 (…)</code>).</li>
        <li>
          Confirm the report key on the schedule exists in both
          <code> REPORT_METADATA</code> and in the backend's{' '}
          <code>processReport</code> handlers.
        </li>
        <li>
          Use <strong>Run Now</strong> to trigger it on demand without waiting
          for the cron.
        </li>
      </ol>
    </section>
  </>
);

export default ScheduleHelp;