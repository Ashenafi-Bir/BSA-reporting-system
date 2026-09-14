import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Toast from '../components/Toast';
import { getSubmissions, checkSubmissionStatus } from '../services/api';
import { REPORT_METADATA, REPORT_KEYS } from '../constants/reports';

const History: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [allSubmissions, setAllSubmissions] = useState<any[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<number | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [reportFilter, setReportFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({ message, type });
  };

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      const res = await getSubmissions(1000);
      const data = res.data || [];
      setAllSubmissions(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      showToast('Failed to load history', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let result = [...allSubmissions];

    if (statusFilter !== 'all') {
      result = result.filter(s => s.status === statusFilter);
    }
    if (reportFilter !== 'all') {
      result = result.filter(s => s.report_key === reportFilter);
    }
    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter(s => new Date(s.submitted_at) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter(s => new Date(s.submitted_at) <= to);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(s =>
        s.filename?.toLowerCase().includes(q) ||
        s.report_key?.toLowerCase().includes(q) ||
        (REPORT_METADATA[s.report_key]?.name || '').toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());

    setFilteredSubmissions(result);
    setCurrentPage(1);
  }, [allSubmissions, statusFilter, reportFilter, dateFrom, dateTo, searchQuery]);

  const handleCheckStatus = async (id: number) => {
    setCheckingId(id);
    try {
      const res = await checkSubmissionStatus(id);
      await fetchSubmissions();
      showToast(`Status: ${res.data?.status || 'Unknown'}`, 'info');
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
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
      Pending: 'badge-yellow',
      Approved: 'badge-green',
      Rejected: 'badge-red',
    };
    return colors[status] || 'badge-gray';
  };

  const totalItems = filteredSubmissions.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const currentItems = filteredSubmissions.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const getReportName = (key: string) => REPORT_METADATA[key]?.name || key;

  if (loading) return <div className="loading-spinner">Loading...</div>;

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
          <div className="filter-bar">
            <div className="filter-row">
              <div className="filter-group">
                <label>Status</label>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                  <option value="all">All Statuses</option>
                  <option value="submitted">Submitted</option>
                  <option value="processing">Processing</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Report</label>
                <select value={reportFilter} onChange={e => setReportFilter(e.target.value)}>
                  <option value="all">All Reports</option>
                  {REPORT_KEYS.map(key => (
                    <option key={key} value={key}>{REPORT_METADATA[key].name}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>From</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>

              <div className="filter-group">
                <label>To</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>

              <div className="filter-group search-group">
                <label>Search</label>
                <input
                  type="text"
                  placeholder="Filename or report..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="filter-actions">
              <button className="btn btn-sm btn-secondary" onClick={() => {
                setStatusFilter('all');
                setReportFilter('all');
                setDateFrom('');
                setDateTo('');
                setSearchQuery('');
              }}>
                Clear Filters
              </button>
              <span className="filter-count">{totalItems} records</span>
            </div>
          </div>

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
                {currentItems.map(sub => (
                  <tr key={sub.id}>
                    <td>{sub.id}</td>
                    <td>{getReportName(sub.report_key)}</td>
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
                      {/* <button
                        onClick={() => handleCheckStatus(sub.id)}
                        disabled={checkingId === sub.id}
                        className="btn btn-sm btn-secondary"
                      >
                        {checkingId === sub.id ? 'Checking...' : 'Check Status'}
                      </button> */}
                    </td>
                  </tr>
                ))}
                {currentItems.length === 0 && (
                  <tr>
                    <td colSpan={8} className="empty-state">No submissions found matching filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalItems > 0 && (
            <div className="pagination-bar">
              <div className="pagination-info">
                Showing {startIndex + 1}–{endIndex} of {totalItems}
              </div>
              <div className="pagination-controls">
                <button
                  className="btn btn-sm btn-secondary"
                  disabled={currentPage === 1}
                  onClick={() => goToPage(currentPage - 1)}
                >
                  Previous
                </button>
                <span className="pagination-page">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className="btn btn-sm btn-secondary"
                  disabled={currentPage === totalPages}
                  onClick={() => goToPage(currentPage + 1)}
                >
                  Next
                </button>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="page-size-select"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </main>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default History;