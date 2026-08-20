import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { getSubmission, previewReport } from '../services/api';

const SubmissionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<any>(null);
  const [showPayload, setShowPayload] = useState(false);
  const [payloadLoading, setPayloadLoading] = useState(false);

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
      const start = submission.start_date?.split('T')[0];
      const end = submission.end_date?.split('T')[0];
      if (start && end) {
        const dateParam = `${start}/${end}`;
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
              <h4>Payload</h4>
              <pre>{JSON.stringify(payload, null, 2)}</pre>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowPayload(false)}>Close</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SubmissionDetail;