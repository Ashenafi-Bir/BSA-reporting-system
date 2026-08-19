import React, { useState, useMemo, useEffect } from 'react';
import { triggerReport, previewReport } from '../services/api';
import dictionaryData from '../data/dictionary.json';

type SortField = 'code' | 'value';
type SortDirection = 'asc' | 'desc';

const REPORTS = [
  { key: 'SINGLE_CURRENCYOP001', name: 'Single Currency OP001', isWeekly: false },
  { key: 'LSR-Statutory ZS001', name: 'Liquidity Requirement Report', isWeekly: true },
];

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [payloadPreview, setPayloadPreview] = useState<any>(null);
  const [selectedReport, setSelectedReport] = useState<string>(REPORTS[0].key);
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

  const currentReport = REPORTS.find(r => r.key === selectedReport);
  const isWeekly = currentReport?.isWeekly || false;

  // Auto-populate weekly date range when report changes to liquidity
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

  // Build description map from dictionary
  const dictionaryForReport = (dictionaryData as any)[selectedReport] || { ReturnItemsList: [] };
  const descriptionMap: Record<string, string> = {};
  (dictionaryForReport.ReturnItemsList || []).forEach((item: any) => {
    if (item.Code && item._description) {
      descriptionMap[item.Code] = item._description;
    }
  });

  const handleTrigger = async () => {
    setLoading(true);
    setError(null);
    try {
      let dateParam;
      if (isWeekly) {
        if (!startDate || !endDate) {
          setError('Please select both start and end dates.');
          setLoading(false);
          return;
        }
        dateParam = `${startDate}/${endDate}`;
      } else {
        dateParam = selectedDate;
      }
      console.log('📤 Triggering with dateParam:', dateParam);
      const res = await triggerReport(selectedReport, dateParam);
      setResult(res);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    setError(null);
    try {
      let dateParam;
      if (isWeekly) {
        if (!startDate || !endDate) {
          setError('Please select both start and end dates.');
          return;
        }
        dateParam = `${startDate}/${endDate}`;
      } else {
        dateParam = selectedDate;
      }
      console.log('📤 Previewing with dateParam:', dateParam);
      const data = await previewReport(selectedReport, dateParam);
      setPayloadPreview(data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleDownload = () => {
    if (!payloadPreview) return;
    const blob = new Blob([JSON.stringify(payloadPreview, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payload_${isWeekly ? `${startDate}_to_${endDate}` : selectedDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
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

  const reportDisplayName = currentReport?.name || selectedReport;

  return (
    <div className="container">
      <header className="report-header">
        <h1>{reportDisplayName}</h1>
        <div className="report-selector">
          <label htmlFor="reportSelect">Report:</label>
          <select
            id="reportSelect"
            value={selectedReport}
            onChange={(e) => setSelectedReport(e.target.value)}
          >
            {REPORTS.map(report => (
              <option key={report.key} value={report.key}>{report.name}</option>
            ))}
          </select>
        </div>
      </header>

      <div className="card controls-card">
        <div className="controls">
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
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Run Report'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handlePreview}
            >
              Preview Payload
            </button>
            {payloadPreview && (
              <button
                className="btn btn-success"
                onClick={handleDownload}
              >
                Download JSON
              </button>
            )}
          </div>
        </div>
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
                className="btn btn-secondary"
                onClick={() => setShowZeroValues(!showZeroValues)}
                style={{ marginRight: '0.5rem' }}
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
                    <td colSpan={2} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
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

export default Dashboard;