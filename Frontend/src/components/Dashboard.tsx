import React, { useState, useMemo } from 'react';
import { triggerReport, previewReport } from '../services/api';
import dictionaryData from '../data/dictionary.json';

type SortField = 'code' | 'description' | 'value';
type SortDirection = 'asc' | 'desc';

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [payloadPreview, setPayloadPreview] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [showZeroValues, setShowZeroValues] = useState(true);
  const [sortField, setSortField] = useState<SortField>('code');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Build description map from dictionary
  const descriptionMap: Record<string, string> = {};
  (dictionaryData.ReturnItemsList || []).forEach(item => {
    if (item.Code && item._description) {
      descriptionMap[item.Code] = item._description;
    }
  });

  const handleTrigger = async (reportKey: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await triggerReport(reportKey, selectedDate);
      setResult(res);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async (reportKey: string) => {
    setError(null);
    try {
      const data = await previewReport(reportKey, selectedDate);
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
    a.download = `payload_${selectedDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Toggle sort on a field
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Compute filtered and sorted list
  const previewWithDesc = useMemo(() => {
    if (!payloadPreview?.ReturnItemsList) return [];

    let items = payloadPreview.ReturnItemsList.map((item: any) => ({
      ...item,
      description: descriptionMap[item.Code] || 'No description'
    }));

    // Filter zero values if toggle is off
    if (!showZeroValues) {
      items = items.filter(item => item.Value !== '0');
    }

    // Sort
    const compare = (a: any, b: any) => {
      let valA, valB;
      switch (sortField) {
        case 'code':
          valA = a.Code;
          valB = b.Code;
          break;
        case 'description':
          valA = a.description.toLowerCase();
          valB = b.description.toLowerCase();
          break;
        case 'value':
          // Convert to number for numeric sorting, fallback to string
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

  return (
    <div className="container">
      <h1>NBE BSA Report Submitter</h1>

      <div className="card">
        <div className="controls">
          <div className="field">
            <label htmlFor="reportDate">Report Date</label>
            <input
              id="reportDate"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <div className="actions">
            <button
              className="btn btn-primary"
              onClick={() => handleTrigger('SINGLE_CURRENCYOP001')}
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Run Report'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => handlePreview('SINGLE_CURRENCYOP001')}
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
        <div className="card">
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Submission Result
          </h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}

      {payloadPreview && (
        <div className="card">
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>
              Payload Preview – <span id="fieldCount">{previewWithDesc.length}</span> / {totalFields} fields
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
                    Code {sortField === 'code' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => handleSort('description')} style={{ cursor: 'pointer' }}>
                    Description {sortField === 'description' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => handleSort('value')} style={{ cursor: 'pointer' }}>
                    Value {sortField === 'value' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {previewWithDesc.map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td className="code">{item.Code}</td>
                    <td className="description" title={item.description}>{item.description}</td>
                    <td className="value">{item.Value}</td>
                  </tr>
                ))}
                {previewWithDesc.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
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