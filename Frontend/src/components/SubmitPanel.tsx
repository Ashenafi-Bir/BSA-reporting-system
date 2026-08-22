import React, { useState, useMemo, useEffect } from 'react';
import { triggerReport, previewReport } from '../services/api';
import dictionaryData from '../data/dictionary.json';
import { type Report } from '../types/index';

interface SubmitPanelProps {
  reports: Report[];
  role: string;
  allowedReports: string[];
}

type SortField = 'code' | 'value';
type SortDirection = 'asc' | 'desc';

const SubmitPanel: React.FC<SubmitPanelProps> = ({ reports, role, allowedReports }) => {
  const [submitting, setSubmitting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [payloadPreview, setPayloadPreview] = useState<any>(null);
  const [selectedReport, setSelectedReport] = useState<string>(reports[0]?.key || '');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [showZeroValues, setShowZeroValues] = useState(true);
  const [sortField, setSortField] = useState<SortField>('code');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const currentReport = reports.find(r => r.key === selectedReport);
  const isWeekly = currentReport?.isWeekly || false;
  const isAdmin = role === 'Admin'; // adjust if your admin role has a different string

  // Auto-populate weekly date range
  const setWeeklyRange = () => {
    const today = new Date();
    const day = today.getDay();
    let daysToThursday = (day - 4 + 7) % 7;
    const start = new Date(today);
    start.setDate(today.getDate() - daysToThursday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
  };

  useEffect(() => {
    if (isWeekly) {
      setWeeklyRange();
    }
  }, [isWeekly]);

  // Build description map
  const dictionaryForReport = (dictionaryData as any)[selectedReport] || { ReturnItemsList: [] };
  const descriptionMap: Record<string, string> = {};
  (dictionaryForReport.ReturnItemsList || []).forEach((item: any) => {
    if (item.Code && item._description) {
      descriptionMap[item.Code] = item._description;
    }
  });

  const handleTrigger = async () => {
    // 1. Check if user is admin
    if (!isAdmin) {
      setError('You do not have permission to run reports. Only administrators can submit reports.');
      setStatusMessage('❌ Permission denied.');
      return;
    }

    // 2. Build date parameter for confirmation message
    let dateParam;
    let dateDisplay;
    if (isWeekly) {
      if (!startDate || !endDate) {
        setError('Please select both start and end dates.');
        setStatusMessage('');
        return;
      }
      dateParam = `${startDate}/${endDate}`;
      dateDisplay = `from ${startDate} to ${endDate}`;
    } else {
      dateParam = selectedDate;
      dateDisplay = `on ${selectedDate}`;
    }

    // 3. Show confirmation dialog
    const reportName = currentReport?.name || selectedReport;
    const confirmMessage = `You are about to submit the report "${reportName}" ${dateDisplay}.\n\nThis action will trigger a background job and cannot be undone.\n\nDo you want to continue?`;
    if (!window.confirm(confirmMessage)) {
      setStatusMessage('⏳ Submission cancelled by user.');
      return;
    }

    // 4. Proceed with submission
    setSubmitting(true);
    setError(null);
    setStatusMessage('⏳ Submitting report...');
    setResult(null);
    try {
      const res = await triggerReport(selectedReport, dateParam);
      setResult(res);
      setStatusMessage(`✅ Report submitted successfully! Submission ID: ${res.submissionId || 'N/A'}`);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
      setStatusMessage(`❌ Submission failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    setError(null);
    setStatusMessage('⏳ Fetching payload preview...');
    setPayloadPreview(null);
    try {
      let dateParam;
      if (isWeekly) {
        if (!startDate || !endDate) {
          setError('Please select both start and end dates.');
          setStatusMessage('');
          setPreviewLoading(false);
          return;
        }
        dateParam = `${startDate}/${endDate}`;
      } else {
        dateParam = selectedDate;
      }
      const data = await previewReport(selectedReport, dateParam);
      setPayloadPreview(data);
      setStatusMessage(`✅ Payload fetched successfully! ${data.ReturnItemsList?.length || 0} fields loaded.`);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
      setStatusMessage(`❌ Preview failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownload = () => {
    if (!payloadPreview) return;
    setDownloadLoading(true);
    try {
      const blob = new Blob([JSON.stringify(payloadPreview, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payload_${isWeekly ? `${startDate}_to_${endDate}` : selectedDate}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMessage('✅ JSON downloaded successfully!');
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

  const previewWithDesc = useMemo(() => {
    if (!payloadPreview?.ReturnItemsList) return [];

    let items = payloadPreview.ReturnItemsList.map((item: any) => ({
      ...item,
      description: descriptionMap[item.Code] || 'No description'
    }));

    if (!showZeroValues) {
      items = items.filter(item => item.Value !== '0');
    }

    const compare = (a: any, b: any) => {
      let valA, valB;
      switch (sortField) {
        case 'code':
          valA = a.Code;
          valB = b.Code;
          break;
        case 'value':
          valA = parseFloat(a.Value);
          valB = parseFloat(b.Value);
          if (isNaN(valA)) valA = a.Value;
          if (isNaN(valB)) valB = b.Value;
          break;
        default:
          valA = a.Code;
          valB = b.Code;
      }
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    };

    items.sort(compare);
    return items;
  }, [payloadPreview, descriptionMap, showZeroValues, sortField, sortDirection]);

  const totalFields = payloadPreview?.ReturnItemsList?.length || 0;

  if (!reports.length) {
    return <div className="card">No reports available for your role.</div>;
  }

  return (
    <div className="submit-panel">
      <div className="card controls-card">
        <div className="controls">
          <div className="field">
            <label htmlFor="reportSelect">Report</label>
            <select
              id="reportSelect"
              value={selectedReport}
              onChange={(e) => setSelectedReport(e.target.value)}
            >
              {reports.map(report => (
                <option key={report.key} value={report.key}>{report.name}</option>
              ))}
            </select>
          </div>
          {isWeekly ? (
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
          ) : (
            <div className="field">
              <label htmlFor="reportDate">Report Date</label>
              <input
                id="reportDate"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          )}
          <div className="actions">
            <button
              className="btn btn-primary"
              onClick={handleTrigger}
              disabled={submitting || !isAdmin}
              title={!isAdmin ? 'Only administrators can run reports' : ''}
            >
              {submitting ? 'Submitting...' : 'Run Report'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handlePreview}
              disabled={previewLoading}
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
        {statusMessage && (
          <div className={`status-message ${statusMessage.startsWith('✅') ? 'success' : statusMessage.startsWith('❌') ? 'error' : 'info'}`}>
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
                    Code &amp; Description {sortField === 'code' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => handleSort('value')} style={{ cursor: 'pointer' }}>
                    Value {sortField === 'value' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {previewWithDesc.map((item: any, idx: number) => (
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
    </div>
  );
};

export default SubmitPanel;