import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { getSubmissions, checkSubmissionStatus } from '../services/api';

const History: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      const res = await getSubmissions(100);
      setSubmissions(res.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async (id: number) => {
    setCheckingId(id);
    try {
      const res = await checkSubmissionStatus(id);
      await fetchSubmissions();
      alert(`Status: ${res.data?.status || 'Unknown'}\nNotification: ${res.data?.notification || ''}`);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setCheckingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      submitted: 'badge-blue',
      processing: 'badge-yellow',
      success: 'badge-green',
      failed: 'badge-red',
    };
    return colors[status] || 'badge-gray';
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="app-layout">
      <Sidebar user={user} />
      <main className="main-content">
        <div className="page-header">
          <h1>Submission History</h1>
          <button className="btn btn-secondary" onClick={fetchSubmissions}>Refresh</button>
        </div>
        {error && <div className="error">{error}</div>}
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Report</th>
                  <th>Filename</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>BSA Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map(sub => (
                  <tr key={sub.id}>
                    <td>{sub.id}</td>
                    <td>{sub.report_key}</td>
                    <td className="filename" title={sub.filename}>
                      {sub.filename || 'N/A'}
                    </td>
                    <td>{new Date(sub.submitted_at).toLocaleString()}</td>
                    <td><span className={`badge ${getStatusBadge(sub.status)}`}>{sub.status}</span></td>
                    <td>
                      {sub.bsa_status ? (
                        <span className={`badge ${getStatusBadge(sub.bsa_status)}`}>{sub.bsa_status}</span>
                      ) : (
                        <span className="text-muted">Not checked</span>
                      )}
                    </td>
                    <td>
                      <Link to={`/submission/${sub.id}`} className="btn btn-sm btn-secondary">Detail</Link>
                      {sub.filename && (
                        <button
                          onClick={() => handleCheckStatus(sub.id)}
                          disabled={checkingId === sub.id}
                          className="btn btn-sm btn-secondary"
                        >
                          {checkingId === sub.id ? 'Checking...' : 'Check Status'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {submissions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-state">No submissions found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="table-footer">
            Showing {submissions.length} submissions.
          </div>
        </div>
      </main>
    </div>
  );
};

export default History;