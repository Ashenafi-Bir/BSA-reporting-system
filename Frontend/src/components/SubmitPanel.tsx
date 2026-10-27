import React, { useState, useMemo, useEffect } from 'react';
import { triggerReport, previewReport } from '../services/api';
import { REPORT_METADATA } from '../constants/reports';
import dictionaryData from '../data/dictionary.json';
import DynamicItemsView from './DynamicItemsView';

interface SubmitPanelProps {
  reports: { key: string; name: string; isWeekly: boolean }[];
  role: string;
  allowedReports: string[];
  selectedReportKey: string;
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
const currentWeekRange = () => {
  const today = new Date();
  const day = today.getDay();
  const daysToThursday = (day - 4 + 7) % 7;
  const start = new Date(today);
  start.setDate(today.getDate() - daysToThursday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toInputDate(start), end: toInputDate(end) };
};

/* ---------- Return-Items-only enrichment ---------- */
/**
 * Returns a shallow-copied payload where ONLY `ReturnItemsList` is
 * transformed according to `withDescription`.
 *
 * `DynamicItemsList` is passed through **byte-for-byte unchanged**.
 */
const buildDownloadPayload = (
  payload: any,
  returnDictMap: Record<string, DictionaryItem>,
  withDescription: boolean
) => {
  const processedReturnItems = (payload?.ReturnItemsList || []).map(
    (item: any) => {
      if (!withDescription) {
        // strip _description, keep everything else as-is
        const { _description, ...rest } = item;
        return rest;
      }
      const dictEntry = returnDictMap[item.Code];
      const desc = dictEntry?._description || item._description;
      const dataType = dictEntry?._dataType || item._dataType;

      const result: any = { ...item };
      if (desc) result._description = desc;
      else delete result._description;
      if (dataType) result._dataType = dataType;
      return result;
    }
  );

  return {
    ...payload,
    ReturnItemsList: processedReturnItems,
    // 👇 untouched — same reference, same structure, same values
    DynamicItemsList: payload?.DynamicItemsList,
  };
};

const SubmitPanel: React.FC<SubmitPanelProps> = ({
  reports,
  role,
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

  const [selectedDate, setSelectedDate] = useState<string>(todayStr());
  const [startDate, setStartDate] = useState<string>(firstOfMonthStr());
  const [endDate, setEndDate] = useState<string>(lastOfMonthStr());

  const [showZeroValues, setShowZeroValues] = useState(true);
  const [sortField, setSortField] = useState<SortField>('code');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmData, setConfirmData] = useState<{
    reportKey: string;
    dateParam: string;
    reportName: string;
    dateDisplay: string;
  } | null>(null);

  /* NEW: JSON download options modal */
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);

  const currentReport = reports.find(r => r.key === selectedReportKey);
  const isWeekly = currentReport?.isWeekly || false;
  const isAdmin = role === 'Admin';

  const selectedReportMeta = selectedReportKey
    ? REPORT_METADATA[selectedReportKey]
    : null;

  const dateMode: 'single' | 'range' = selectedReportMeta?.dateMode ?? 'range';

  /* Auto-populate defaults */
  useEffect(() => {
    if (!selectedReportMeta) return;
    if (selectedReportMeta.dateMode === 'single') {
      setSelectedDate(todayStr());
    } else if (isWeekly) {
      const { start, end } = currentWeekRange();
      setStartDate(start);
      setEndDate(end);
    } else {
      setStartDate(firstOfMonthStr());
      setEndDate(lastOfMonthStr());
    }
    setPayloadPreview(null);
    setResult(null);
    setStatusMessage('');
    setError(null);
  }, [selectedReportKey, selectedReportMeta, isWeekly]);

  const buildDateParam = () => {
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

  const handleTrigger = async () => {
    if (!isAdmin) {
      setError('You do not have permission to run reports.');
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
      const returnCount = data.ReturnItemsList?.length || 0;
      const dynamicCount = data.DynamicItemsList?.length || 0;
      setStatusMessage(
        `✅ Payload fetched — ${returnCount} return item(s), ${dynamicCount} dynamic area(s).`
      );
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
      setStatusMessage(`❌ Preview failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  /* ---------- Download: opens the options modal ---------- */
  const handleDownload = () => {
    if (!payloadPreview) return;
    setShowDownloadOptions(true);
  };

  /* ---------- Download: performs the actual file creation ---------- */
  const performDownload = (withDescription: boolean) => {
    setShowDownloadOptions(false);
    if (!payloadPreview) return;

    setDownloadLoading(true);
    try {
      /* Build a code → dictionary-entry lookup for ReturnItems only */
      const returnDictMap: Record<string, DictionaryItem> = {};
      ((dictionaryData as any)[selectedReportKey]?.ReturnItemsList || []).forEach(
        (item: DictionaryItem) => {
          if (item.Code) returnDictMap[item.Code] = item;
        }
      );

      /* Only ReturnItemsList is transformed; DynamicItemsList untouched */
      const downloadPayload = buildDownloadPayload(
        payloadPreview,
        returnDictMap,
        withDescription
      );

      const blob = new Blob([JSON.stringify(downloadPayload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const suffix =
        dateMode === 'range' ? `${startDate}_to_${endDate}` : selectedDate;
      const label = withDescription ? 'with-desc' : 'without-desc';
      a.download = `payload_${selectedReportKey}_${suffix}_${label}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setStatusMessage(
        `✅ JSON downloaded (Return Items ${withDescription ? 'with' : 'without'} descriptions).`
      );
    } catch (err: any) {
      setStatusMessage(`❌ Download failed: ${err.message}`);
    } finally {
      setDownloadLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  /* ---------- Dictionary lookup (ReturnItems) ---------- */
  const dictionaryForReport =
    (dictionaryData as any)[selectedReportKey] || { ReturnItemsList: [] };
  const descriptionMap: Record<string, string> = {};
  (dictionaryForReport.ReturnItemsList || []).forEach((item: DictionaryItem) => {
    if (item.Code && item._description) {
      descriptionMap[item.Code] = item._description;
    }
  });

  /* ---------- Dictionary (DynamicItems schema) ---------- */
  const dictionaryDynamicAreas =
    (dictionaryData as any)[selectedReportKey]?.DynamicItemsList;

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
        valA = a.Code; valB = b.Code;
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

  const totalReturnFields = payloadPreview?.ReturnItemsList?.length || 0;
  const hasDynamic =
    !!payloadPreview?.DynamicItemsList &&
    payloadPreview.DynamicItemsList.length > 0;

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
              onClick={handlePreview}
              disabled={
                previewLoading ||
                !Boolean(selectedReportKey) ||
                Boolean(rangeInvalid)
              }
            >
              {previewLoading ? 'Loading...' : 'Preview Payload'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleTrigger}
              disabled={
                submitting ||
                !isAdmin ||
                !Boolean(selectedReportKey) ||
                Boolean(rangeInvalid)
              }
              title={!isAdmin ? 'Only administrators can run reports' : ''}
            >
              {submitting ? 'Submitting...' : 'Send Report'}
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
        <>
          {/* ---------- Return Items ---------- */}
          <div className="card payload-card">
            <div className="payload-header">
              <h3>
                Return Items — <span>{previewWithDesc.length}</span> / {totalReturnFields} fields
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
              Showing {previewWithDesc.length} of {totalReturnFields} fields.
            </div>
          </div>

          {/* ---------- Dynamic Items ---------- */}
          {hasDynamic && (
            <div className="card dynamic-card">
              <div className="payload-header">
                <h3>
                  Dynamic Items —{' '}
                  <span>{payloadPreview.DynamicItemsList.length}</span> area
                  {payloadPreview.DynamicItemsList.length !== 1 ? 's' : ''}
                </h3>
              </div>
              <DynamicItemsView
                items={payloadPreview.DynamicItemsList}
                dictionary={dictionaryDynamicAreas}
                showZeroValues={showZeroValues}
              />
            </div>
          )}
        </>
      )}

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

      {/* ---------- JSON download options modal (Return Items only) ---------- */}
      {showDownloadOptions && (
        <div
          className="modal-overlay"
          onClick={() => setShowDownloadOptions(false)}
        >
          <div
            className="modal-content download-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Download JSON</h3>
            <p className="modal-message">
              Choose whether the <strong>Return Items</strong> entries in the
              downloaded file should include their human-readable{' '}
              <code>_description</code>.
              <br />
              <span className="download-modal-note">
                Dynamic items are always downloaded exactly as received.
              </span>
            </p>

            <div className="download-options">
              <button
                type="button"
                className="download-option"
                onClick={() => performDownload(true)}
              >
                <div className="download-option-icon with-desc">Aa</div>
                <div className="download-option-content">
                  <div className="download-option-title">
                    With Descriptions
                    <span className="download-option-tag">Recommended</span>
                  </div>
                  <div className="download-option-desc">
                    Each Return Item is matched to its dictionary description
                    by <code>Code</code> — good for reading and review.
                  </div>
                </div>
              </button>

              <button
                type="button"
                className="download-option"
                onClick={() => performDownload(false)}
              >
                <div className="download-option-icon without-desc">{'{ }'}</div>
                <div className="download-option-content">
                  <div className="download-option-title">
                    Without Descriptions
                  </div>
                  <div className="download-option-desc">
                    Return Items are stripped of <code>_description</code> —
                    ideal for automated downstream ingestion.
                  </div>
                </div>
              </button>
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowDownloadOptions(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmitPanel;