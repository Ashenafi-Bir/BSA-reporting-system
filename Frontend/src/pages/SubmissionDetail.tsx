import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { getSubmission, previewReport } from '../services/api';
import dictionaryData from '../data/dictionary.json';

type SortField = 'code' | 'value';
type SortDirection = 'asc' | 'desc';

const SubmissionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<any>(null);
  const [showPayload, setShowPayload] = useState(false);
  const [payloadLoading, setPayloadLoading] = useState(false);
  const [showZeroValues, setShowZeroValues] = useState(true);
  const [sortField, setSortField] = useState<SortField>('code');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
    fetchSubmission();
  }, [id]);

  const fetchSubmission = async () => {
    try {
      const res = await getSubmission(Number(id));
      setSubmission(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewPayload = async () => {
    if (!submission) return;
    setPayloadLoading(true);
    try {
      if (submission.start_date && submission.end_date) {
        // Use local timezone to extract the date part, ensuring it matches the user's selected date
        const start = new Date(submission.start_date).toLocaleDateString('en-CA');
        const end = new Date(submission.end_date).toLocaleDateString('en-CA');
        const dateParam = `${start}/${end}`;
        console.log('Fetching payload with dateParam:', dateParam); // for debugging
        const response = await previewReport(submission.report_key, dateParam);
        setPayload(response);
        setShowPayload(true);
      } else {
        alert('No date range available for this submission');
      }
    } catch (error) {
      alert('Could not fetch payload');
    } finally {
      setPayloadLoading(false);
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

  // Build description map from dictionary for the current report
  const descriptionMap = useMemo(() => {
    const dict = (dictionaryData as any)[submission?.report_key] || { ReturnItemsList: [] };
    const map: Record<string, string> = {};
    (dict.ReturnItemsList || []).forEach((item: any) => {
      if (item.Code && item._description) {
        map[item.Code] = item._description;
      }
    });
    return map;
  }, [submission?.report_key]);

  const previewWithDesc = useMemo(() => {
    if (!payload?.ReturnItemsList) return [];

    let items = payload.ReturnItemsList.map((item: any) => ({
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
  }, [payload, descriptionMap, showZeroValues, sortField, sortDirection]);

  const totalFields = payload?.ReturnItemsList?.length || 0;

  if (loading) return <div>Loading...</div>;
  if (!submission) return <div>Submission not found</div>;

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      submitted: 'badge-blue',
      processing: 'badge-yellow',
      success: 'badge-green',
      failed: 'badge-red',
    };
    return colors[status] || 'badge-gray';
  };

  return (
    <div className="app-layout">
      <Sidebar user={user} />
      <main className="main-content">
        <div className="page-header">
          <h1>Submission Detail</h1>
          <button className="btn btn-secondary" onClick={() => navigate(-1)}>Back</button>
        </div>
        <div className="card detail-card">
          <div className="detail-grid">
            <div>
              <label>Report</label>
              <p>{submission.report_key}</p>
            </div>
            <div>
              <label>Filename</label>
              <p className="filename">{submission.filename || 'N/A'}</p>
            </div>
            <div>
              <label>Submitted At</label>
              <p>{new Date(submission.submitted_at).toLocaleString()}</p>
            </div>
            <div>
              <label>Status</label>
              <p><span className={`badge ${getStatusBadge(submission.status)}`}>{submission.status}</span></p>
            </div>
            <div>
              <label>BSA Status</label>
              <p>{submission.bsa_status || 'N/A'}</p>
            </div>
            <div>
              <label>Start Date</label>
              <p>{submission.start_date ? new Date(submission.start_date).toLocaleDateString() : 'N/A'}</p>
            </div>
            <div>
              <label>End Date</label>
              <p>{submission.end_date ? new Date(submission.end_date).toLocaleDateString() : 'N/A'}</p>
            </div>
            <div>
              <label>Response</label>
              <p className="truncate">{submission.response ? 'Yes' : 'No'}</p>
            </div>
          </div>
          {submission.error && (
            <div className="error-box">
              <label>Error</label>
              <pre>{submission.error}</pre>
            </div>
          )}
          <div className="detail-actions">
            <button className="btn btn-primary" onClick={handleViewPayload} disabled={payloadLoading}>
              {payloadLoading ? 'Loading...' : 'View Payload'}
            </button>
            {submission.filename && (
              <button className="btn btn-secondary" onClick={() => alert('Check status from history page')}>
                Check Status
              </button>
            )}
          </div>

          {showPayload && payload && (
            <div className="payload-view">
              <div className="payload-header">
                <h4>
                  Payload Preview – <span>{previewWithDesc.length}</span> / {totalFields} fields
                </h4>
                <div className="payload-controls">
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => setShowZeroValues(!showZeroValues)}
                  >
                    {showZeroValues ? 'Hide Zero Values' : 'Show Zero Values'}
                  </button>
                  <button className="btn btn-sm btn-secondary" onClick={() => setShowPayload(false)}>
                    Close
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
      </main>
    </div>
  );
};

export default SubmissionDetail;