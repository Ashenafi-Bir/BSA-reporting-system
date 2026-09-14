import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import SubmitPanel from '../components/SubmitPanel';
import { REPORT_METADATA, REPORT_KEYS } from '../constants/reports';
import { getSubmissions } from '../services/api';

interface Report {
  key: string;
  name: string;
  isWeekly: boolean;
}

const REPORTS: Report[] = REPORT_KEYS.map(key => ({
  key,
  name: REPORT_METADATA[key].name,
  isWeekly: REPORT_METADATA[key].isWeekly,
}));

const Reports: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [selectedReportKey, setSelectedReportKey] = useState<string>('');
  const [recentSubmissions, setRecentSubmissions] = useState<any[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) {
      navigate('/login');
      return;
    }
    setUser(JSON.parse(stored));
  }, [navigate]);

  useEffect(() => {
    if (!selectedReportKey) {
      setRecentSubmissions([]);
      return;
    }
    const fetchRecent = async () => {
      setLoadingRecent(true);
      try {
        const res = await getSubmissions(5, 0);
        const data = res.data || [];
        const filtered = data.filter((s: any) => s.report_key === selectedReportKey);
        setRecentSubmissions(filtered);
      } catch (error) {
        console.error('Failed to fetch recent submissions', error);
      } finally {
        setLoadingRecent(false);
      }
    };
    fetchRecent();
  }, [selectedReportKey]);

  if (!user) return <div className="loading-spinner">Loading...</div>;

  const allowedReports = user?.allowedReports || [];
  const filteredReports = REPORTS.filter((r) =>
    user?.role === 'Admin' || user?.role === 'ITMaker' || allowedReports.includes(r.key)
  );

  const selectedReport = selectedReportKey ? REPORT_METADATA[selectedReportKey] : null;
  const isSelectedAllowed = filteredReports.some(r => r.key === selectedReportKey);

  const handleReportSelect = (key: string) => {
    setSelectedReportKey(key);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      submitted: 'badge-blue',
      processing: 'badge-yellow',
      success: 'badge-green',
      failed: 'badge-red',
      Pending: 'badge-yellow',
      Approved: 'badge-green',
      Rejected: 'badge-red',
    };
    return colors[status] || 'badge-gray';
  };

  return (
    <div className="app-layout">
      <Sidebar user={user} />
      <main className="main-content">
        {/* Dynamic Header */}
        <div className="page-header report-header">
          <div>
            <h1>{selectedReport ? selectedReport.name : 'Submit Reports'}</h1>
            {selectedReport && (
              <p className="report-description">
                {selectedReport.description} · <span className="report-frequency">{selectedReport.frequency}</span>
              </p>
            )}
            {!selectedReport && <p>Select a report from the dropdown </p>}
          </div>
          <div className="report-select-wrapper">
            <select
              value={selectedReportKey}
              onChange={(e) => handleReportSelect(e.target.value)}
              className="report-select-dropdown"
            >
              <option value="">Choose a report...</option>
              {filteredReports.map((r) => (
                <option key={r.key} value={r.key}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Main Submit Panel */}
        {selectedReport && isSelectedAllowed && (
          <SubmitPanel
            reports={filteredReports}
            role={user.role}
            allowedReports={allowedReports}
            selectedReportKey={selectedReportKey}
            onReportSelect={handleReportSelect}
          />
        )}

        {/* Recent Submissions for selected report */}
        {selectedReport && isSelectedAllowed && (
          <div className="card recent-submissions">
            <h3>Recent Submissions for {selectedReport.name}</h3>
            {loadingRecent ? (
              <p>Loading...</p>
            ) : recentSubmissions.length === 0 ? (
              <p className="empty-state">No recent submissions for this report.</p>
            ) : (
              <div className="recent-list">
                {recentSubmissions.map((sub) => (
                  <div key={sub.id} className="recent-item">
                    <span className="recent-filename">{sub.filename || 'N/A'}</span>
                    <span className={`badge ${getStatusBadge(sub.status)}`}>{sub.status}</span>
                    <span className="recent-date">{new Date(sub.submitted_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!selectedReport && (
          <div className="card">
            <p className="empty-state">Please select a report from the dropdown above to start submitting.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Reports;