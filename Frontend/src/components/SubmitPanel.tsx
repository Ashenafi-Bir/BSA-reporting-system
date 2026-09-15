import React, { useState, useMemo, useEffect } from 'react';
import { triggerReport, previewReport } from '../services/api';
import { REPORT_METADATA } from '../constants/reports';
import dictionaryData from '../data/dictionary.json';

interface SubmitPanelProps {
  reports: { key: string; name: string; isWeekly: boolean }[];
  role: string;
  allowedReports: string[];
  selectedReportKey: string; // from parent
  onReportSelect: (key: string) => void;
}

type SortField = 'code' | 'value';
type SortDirection = 'asc' | 'desc';

interface DictionaryItem {
  Code: string;
  Value?: string;
  _description?: string;
  _dataType?: string;
  _required?: boolean;
}

interface PayloadItem {
  Code: string;
  Value: string;
  description?: string;
}

/* ---------- date helpers ---------- */
const pad = (n: number) => String(n).padStart(2, '0');
const toInputDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const todayStr = () => toInputDate(new Date());

const firstOfMonthStr = () => {
  const d = new Date();
  return toInputDate(new Date(d.getFullYear(), d.getMonth(), 1));
};

const lastOfMonthStr = () => {
  const d = new Date();
  return toInputDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};

/** Thu → Wed of the current week (for weekly reports). */
const currentWeekRange = () => {
  const today = new Date();
  const day = today.getDay();               // 0=Sun, 4=Thu
  const daysToThursday = (day - 4 + 7) % 7;
  const start = new Date(today);
  start.setDate(today.getDate() - daysToThursday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toInputDate(start), end: toInputDate(end) };
};

const SubmitPanel: React.FC<SubmitPanelProps> = ({
  reports,
  role,
  allowedReports,
  selectedReportKey,
  onReportSelect,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [payloadPreview, setPayloadPreview] = useState<any>(null);

  // Date states
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());
  const [startDate, setStartDate] = useState<string>(firstOfMonthStr());
  const [endDate, setEndDate] = useState<string>(lastOfMonthStr());

  const [showZeroValues, setShowZeroValues] = useState(true);
  const [sortField, setSortField] = useState<SortField>('code');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmData, setConfirmData] = useState<{
    reportKey: string;
    dateParam: string;
    reportName: string;
    dateDisplay: string;
  } | null>(null);

  const currentReport = reports.find(r => r.key === selectedReportKey);
  const isWeekly = currentReport?.isWeekly || false;
  const isAdmin = role === 'Admin';

  const selectedReportMeta = selectedReportKey
    ? REPORT_METADATA[selectedReportKey]
    : null;

  /** 'single' → one date; 'range' → start + end. Default 'range'. */
  const dateMode: 'single' | 'range' = selectedReportMeta?.dateMode ?? 'range';

  /* ------------------------------------------------------------------ */
  /*  Auto-populate sensible defaults whenever the report changes        */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!selectedReportMeta) return;

    if (selectedReportMeta.dateMode === 'single') {
      setSelectedDate(todayStr());
    } else if (isWeekly) {
      const { start, end } = currentWeekRange();
      setStartDate(start);
      setEndDate(end);
    } else {
      // Monthly / Quarterly → default to current month
      setStartDate(firstOfMonthStr());
      setEndDate(lastOfMonthStr());
    }
    // Clear stale preview/result so nothing looks out of date
    setPayloadPreview(null);
    setResult(null);
    setStatusMessage('');
    setError(null);
  }, [selectedReportKey, selectedReportMeta, isWeekly]);

  /* ------------------------------------------------------------------ */
  /*  Build the date param the backend understands                       */
  /* ------------------------------------------------------------------ */
  const buildDateParam = (): { dateParam: string; dateDisplay: string } | null => {
    if (dateMode === 'single') {
      if (!selectedDate) return null;
      return { dateParam: selectedDate, dateDisplay: `on ${selectedDate}` };
    }
    if (!startDate || !endDate) return null;
    if (startDate > endDate) return null;
    return {
      dateParam: `${startDate}/${endDate}`,
      dateDisplay: `from ${startDate} to ${endDate}`,
    };
  };

  /* ---------- Trigger with confirmation modal ---------- */
  const handleTrigger = async () => {
    if (!isAdmin) {
      setError('You do not have permission to run reports. Only administrators can submit reports.');
      setStatusMessage('❌ Permission denied.');
      return;
    }
    const dateInfo = buildDateParam();
    if (!dateInfo) {
      setError('Please select valid date(s).');
      setStatusMessage('');
      return;
    }
    setConfirmData({
      reportKey: selectedReportKey,
      dateParam: dateInfo.dateParam,
      reportName: currentReport?.name || selectedReportKey,
      dateDisplay: dateInfo.dateDisplay,
    });
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = async () => {
    if (!confirmData) return;
    const { reportKey, dateParam } = confirmData;
    setShowConfirmModal(false);
    setConfirmData(null);
    setSubmitting(true);
    setError(null);
    setStatusMessage('⏳ Submitting report...');
    setResult(null);
    try {
      const res = await triggerReport(reportKey, dateParam);
      setResult(res);
      setStatusMessage(`✅ Report submitted successfully! Submission ID: ${res.submissionId || 'N/A'}`);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
      setStatusMessage(`❌ Submission failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSubmit = () => {
    setShowConfirmModal(false);
    setConfirmData(null);
    setStatusMessage('⏳ Submission cancelled by user.');
  };

  /* ---------- Preview ---------- */
  const handlePreview = async () => {
    const dateInfo = buildDateParam();
    if (!dateInfo) {
      setError('Please select valid date(s).');
      setStatusMessage('');
      return;
    }
    setPreviewLoading(true);
    setError(null);
    setStatusMessage('⏳ Fetching payload preview...');
    setPayloadPreview(null);
    try {
      const data = await previewReport(selectedReportKey, dateInfo.dateParam);
      setPayloadPreview(data);
      setStatusMessage(
        `✅ Payload fetched successfully! ${data.ReturnItemsList?.length || 0} fields loaded.`
      );
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
      setStatusMessage(`❌ Preview failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  /* ---------- Download ---------- */
  const handleDownload = () => {
    if (!payloadPreview) return;
    setDownloadLoading(true);
    try {
      const blob = new Blob(
        [JSON.stringify(payloadPreview, null, 2)],
        { type: 'application/json' }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const suffix =
        dateMode === 'range' ? `${startDate}_to_${endDate}` : selectedDate;
      a.download = `payload_${suffix}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMessage('✅ JSON downloaded successfully!');
    } catch (err: any) {
      setStatusMessage(`❌ Download failed: ${err.message}`);
    } finally {
      setDownloadLoading(false);
    }
  };

  /* ---------- Sorting ---------- */
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  /* ---------- Dictionary lookup ---------- */
  const dictionaryForReport =
    (dictionaryData as any)[selectedReportKey] || { ReturnItemsList: [] };
  const descriptionMap: Record<string, string> = {};
  (dictionaryForReport.ReturnItemsList || []).forEach((item: DictionaryItem) => {
    if (item.Code && item._description) {
      descriptionMap[item.Code] = item._description;
    }
  });

  const previewWithDesc: PayloadItem[] = useMemo(() => {
    if (!payloadPreview?.ReturnItemsList) return [];

    let items: PayloadItem[] = payloadPreview.ReturnItemsList.map((item: any) => ({
      Code: item.Code,
      Value: String(item.Value ?? ''),
      description: descriptionMap[item.Code] || 'No description',
    }));

    if (!showZeroValues) {
      items = items.filter(
        (item: PayloadItem) => item.Value !== '0' && item.Value !== ''
      );
    }

    const compare = (a: PayloadItem, b: PayloadItem) => {
      let valA: string | number;
      let valB: string | number;
      if (sortField === 'code') {
        valA = a.Code;
        valB = b.Code;
      } else {
        const numA = parseFloat(a.Value);
        const numB = parseFloat(b.Value);
        valA = isNaN(numA) ? a.Value : numA;
        valB = isNaN(numB) ? b.Value : numB;
      }
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    };

    items.sort(compare);
    return items;
  }, [payloadPreview, descriptionMap, showZeroValues, sortField, sortDirection]);

  const totalFields = payloadPreview?.ReturnItemsList?.length || 0;

  /* ---------- Render guard ---------- */
  if (!reports.length) {
    return <div className="card">No reports available for your role.</div>;
  }

  const rangeInvalid =
    dateMode === 'range' && startDate && endDate && startDate > endDate;

  return (
    <div className="submit-panel">
      <div className="card controls-card">
        <div className="controls">
          <div className="field">
            <label htmlFor="reportSelect">Report</label>
            <select
              id="reportSelect"
              value={selectedReportKey}
              onChange={(e) => onReportSelect(e.target.value)}
            >
              <option value="">Select a report</option>
              {reports.map(report => (
                <option key={report.key} value={report.key}>{report.name}</option>
              ))}
            </select>
          </div>

          {dateMode === 'single' ? (
            /* ---------- Single day ---------- */
            <div className="field">
              <label htmlFor="reportDate">Report Date</label>
              <input
                id="reportDate"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          ) : (
            /* ---------- Date range ---------- */
            <>
              <div className="field">
                <label htmlFor="startDate">Start Date</label>
                <input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="endDate">End Date</label>
                <input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="actions">
            <button
              className="btn btn-primary"
              onClick={handleTrigger}
              disabled={
                submitting || !isAdmin || !selectedReportKey || rangeInvalid
              }
              title={!isAdmin ? 'Only administrators can run reports' : ''}
            >
              {submitting ? 'Submitting...' : 'Run Report'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handlePreview}
              disabled={previewLoading || !selectedReportKey || rangeInvalid}
            >
              {previewLoading ? 'Loading...' : 'Preview Payload'}
            </button>
            {payloadPreview && (
              <button
                className="btn btn-success"
                onClick={handleDownload}
                disabled={downloadLoading}
              >
                {downloadLoading ? 'Downloading...' : 'Download JSON'}
              </button>
            )}
          </div>
        </div>

        {rangeInvalid && (
          <div className="error">Start date must be before or equal to end date.</div>
        )}

        {statusMessage && (
          <div
            className={`status-message ${
              statusMessage.startsWith('✅')
                ? 'success'
                : statusMessage.startsWith('❌')
                ? 'error'
                : 'info'
            }`}
          >
            {statusMessage}
          </div>
        )}
        {error && <div className="error">{error}</div>}
      </div>

      {result && (
        <div className="card result-card">
          <h3>Submission Result</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}

      {payloadPreview && (
        <div className="card payload-card">
          <div className="payload-header">
            <h3>
              Payload Preview – <span>{previewWithDesc.length}</span> / {totalFields} fields
            </h3>
            <div>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setShowZeroValues(!showZeroValues)}
              >
                {showZeroValues ? 'Hide Zero Values' : 'Show Zero Values'}
              </button>
            </div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th onClick={() => handleSort('code')} style={{ cursor: 'pointer' }}>
                    Code &amp; Description{' '}
                    {sortField === 'code' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => handleSort('value')} style={{ cursor: 'pointer' }}>
                    Value{' '}
                    {sortField === 'value' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {previewWithDesc.map((item: PayloadItem, idx: number) => (
                  <tr key={idx}>
                    <td>
                      <span className="code">{item.Code}</span>
                      <span className="description" title={item.description}>
                        – {item.description}
                      </span>
                    </td>
                    <td className="value">{item.Value}</td>
                  </tr>
                ))}
                {previewWithDesc.length === 0 && (
                  <tr>
                    <td colSpan={2} className="empty-state">
                      No fields match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="table-footer">
            Showing {previewWithDesc.length} of {totalFields} fields.
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && confirmData && (
        <div className="modal-overlay" onClick={handleCancelSubmit}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Report Submission</h3>
            <p>
              You are about to submit the report{' '}
              <strong>"{confirmData.reportName}"</strong> {confirmData.dateDisplay}.
            </p>
            <p className="modal-warning">
              This action will trigger a background job and cannot be undone.
            </p>
            <p>Do you want to continue?</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={handleCancelSubmit}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleConfirmSubmit}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmitPanel;