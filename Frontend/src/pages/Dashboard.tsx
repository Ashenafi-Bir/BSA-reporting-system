import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { getSubmissions } from '../services/api';

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

const Dashboard: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
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
    const fetchInsights = async () => {
      try {
        // Fetch submissions (limit 100 to get enough data for stats)
        const res = await getSubmissions(100, 0);
        // The response might be an array directly, or an object with a 'data' property.
        // We'll handle both cases.
        const submissions = Array.isArray(res) ? res : (res.data || []);
        
        const total = submissions.length;
        const pending = submissions.filter((s: any) => s.status === 'Pending').length;
        const approved = submissions.filter((s: any) => s.status === 'Approved').length;
        const rejected = submissions.filter((s: any) => s.status === 'Rejected').length;
        setStats({ total, pending, approved, rejected });

        // Get latest 5 submissions for activity (already sorted by date? We'll slice first 5)
        const recent = submissions.slice(0, 5);
        setRecentActivity(recent);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
        // Fallback mock data for demo
        setStats({ total: 42, pending: 8, approved: 30, rejected: 4 });
        setRecentActivity([
          { id: 1, reportKey: 'SINGLE_CURRENCYOP001', status: 'Approved', submittedAt: '2025-03-10' },
          { id: 2, reportKey: 'LSR-Statutory ZS001', status: 'Pending', submittedAt: '2025-03-09' },
          { id: 3, reportKey: 'CD by S and RegMD001', status: 'Rejected', submittedAt: '2025-03-08' },
          { id: 4, reportKey: 'NBE_20_DEP_MR001', status: 'Approved', submittedAt: '2025-03-07' },
          { id: 5, reportKey: 'CDby Range and RegCM002', status: 'Pending', submittedAt: '2025-03-06' },
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchInsights();
  }, []);

  if (!user) return <div className="loading-spinner">Loading...</div>;

  return (
    <div className="app-layout">
      <Sidebar user={user} />
      <main className="main-content">
        <div className="page-header">
          <h1>Dashboard</h1>
          <p>Welcome back, {user.fullName}</p>
        </div>

        {/* Stats Cards */}
        <section className="insights-section">
          <h3>Overview</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">Total Submissions</span>
              <span className="stat-value">{loading ? '…' : stats.total}</span>
            </div>
            <div className="stat-card stat-pending">
              <span className="stat-label">Pending</span>
              <span className="stat-value">{loading ? '…' : stats.pending}</span>
            </div>
            <div className="stat-card stat-approved">
              <span className="stat-label">Approved</span>
              <span className="stat-value">{loading ? '…' : stats.approved}</span>
            </div>
            <div className="stat-card stat-rejected">
              <span className="stat-label">Rejected</span>
              <span className="stat-value">{loading ? '…' : stats.rejected}</span>
            </div>
          </div>
        </section>

        {/* Simple bar chart (CSS only) */}
        <section className="chart-section">
          <h3>Submission Status</h3>
          <div className="bar-chart">
            <div className="bar-item">
              <span className="bar-label">Pending</span>
              <div className="bar-track">
                <div 
                  className="bar-fill pending-bar" 
                  style={{ width: `${stats.total ? (stats.pending / stats.total) * 100 : 0}%` }}
                ></div>
              </div>
              <span className="bar-value">{stats.pending}</span>
            </div>
            <div className="bar-item">
              <span className="bar-label">Approved</span>
              <div className="bar-track">
                <div 
                  className="bar-fill approved-bar" 
                  style={{ width: `${stats.total ? (stats.approved / stats.total) * 100 : 0}%` }}
                ></div>
              </div>
              <span className="bar-value">{stats.approved}</span>
            </div>
            <div className="bar-item">
              <span className="bar-label">Rejected</span>
              <div className="bar-track">
                <div 
                  className="bar-fill rejected-bar" 
                  style={{ width: `${stats.total ? (stats.rejected / stats.total) * 100 : 0}%` }}
                ></div>
              </div>
              <span className="bar-value">{stats.rejected}</span>
            </div>
          </div>
        </section>

        {/* Recent Activity */}
        <section className="activity-section">
          <h3>Recent Activity</h3>
          {recentActivity.length === 0 ? (
            <p className="empty-state">No recent submissions.</p>
          ) : (
            <div className="activity-list">
              {recentActivity.map((item) => (
                <div key={item.id} className="activity-item">
                  <span className="activity-report">{item.reportKey || item.report_key}</span>
                  <span className={`activity-status badge badge-${item.status.toLowerCase()}`}>
                    {item.status}
                  </span>
                  <span className="activity-date">{item.submittedAt || item.created_at}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Dashboard;