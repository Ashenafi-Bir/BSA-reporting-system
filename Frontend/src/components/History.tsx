import React, { useState, useEffect } from 'react';
import { getSubmissions, checkSubmissionStatus } from '../services/api';

const History: React.FC = () => {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<number | null>(null);

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

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const handleCheckStatus = async (id: number) => {
    setCheckingId(id);
    try {
      const res = await checkSubmissionStatus(id);
      await fetchSubmissions();
      // Show a user-friendly notification
      const status = res.data?.status || 'Unknown';
      const notification = res.data?.notification || '';
      alert(`Status: ${status}\n\n${notification ? 'Notification: ' + notification : ''}`);
    } catch (err: any) {
      alert(`Error checking status: ${err.message}`);
    } finally {
      setCheckingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      submitted: 'bg-blue-100 text-blue-800',
      processing: 'bg-yellow-100 text-yellow-800',
      success: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getBsaStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      'Processed': 'bg-green-100 text-green-800',
      'Failed': 'bg-red-100 text-red-800',
      'Not Processed': 'bg-yellow-100 text-yellow-800',
      'Processing': 'bg-blue-100 text-blue-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) return <div className="p-4">Loading history...</div>;

  return (
    <div className="history-panel">
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Submission History</h3>
          <button className="btn btn-secondary text-sm" onClick={fetchSubmissions}>
            Refresh
          </button>
        </div>
        {error && <div className="error">{error}</div>}
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
                  <td className="font-mono text-xs max-w-[200px] truncate" title={sub.filename}>
                    {sub.filename || 'N/A'}
                  </td>
                  <td>{new Date(sub.submitted_at).toLocaleString()}</td>
                  <td>
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(sub.status)}`}>
                      {sub.status}
                    </span>
                  </td>
                  <td>
                    {sub.bsa_status ? (
                      <span className={`px-2 py-1 rounded-full text-xs ${getBsaStatusBadge(sub.bsa_status)}`}>
                        {sub.bsa_status}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">Not checked</span>
                    )}
                  </td>
                  <td>
                    {sub.filename && (
                      <button
                        onClick={() => handleCheckStatus(sub.id)}
                        disabled={checkingId === sub.id}
                        className="btn btn-secondary text-xs px-2 py-1"
                      >
                        {checkingId === sub.id ? 'Checking...' : 'Check Status'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {submissions.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-4 text-gray-500">
                    No submissions yet. Submit a report to see it here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          Showing {submissions.length} submissions.
        </div>
      </div>
    </div>
  );
};

export default History;