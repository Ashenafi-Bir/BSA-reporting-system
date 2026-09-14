import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { logout } from '../services/authApi';

interface SidebarProps {
  user: any;
}
const BrandIcon = () => (
  <svg
    viewBox="0 0 32 32"
    width="42"
    height="42"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ color: 'var(--secondary)', flexShrink: 0 }}
  >
    {/* Document background */}
    <path d="M6 4h12l6 6v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
    <polyline points="18 4 18 10 24 10" />
    {/* Chart line */}
    <polyline points="8 20 12 16 16 18 20 14 24 20" stroke="currentColor" strokeWidth="2.5" />
    <circle cx="8" cy="20" r="1.5" fill="var(--secondary)" />
    <circle cx="12" cy="16" r="1.5" fill="var(--secondary)" />
    <circle cx="16" cy="18" r="1.5" fill="var(--secondary)" />
    <circle cx="20" cy="14" r="1.5" fill="var(--secondary)" />
    <circle cx="24" cy="20" r="1.5" fill="var(--secondary)" />
  </svg>
);
// SVG Icons (same as before, but I'll add a Dashboard icon)
const DashboardIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const ReportsIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const HistoryIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const AdminIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <path d="M20 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
    <path d="M4 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
  </svg>
);

const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const Sidebar: React.FC<SidebarProps> = ({ user }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <span className="brand-icon">
            <BrandIcon />
          </span>
          <h3>BSA Report Sys.</h3>
        </div>
        <div className="user-profile">
          <div className="user-avatar">
            {user?.fullName ? getInitials(user.fullName) : 'U'}
          </div>
          <div className="user-details">
            <span className="user-name">{user?.fullName || user?.username}</span>
            <span className="role-badge">{user?.role || 'User'}</span>
          </div>
        </div>
      </div>
      <nav className="sidebar-nav">
        <Link to="/dashboard" className={isActive('/dashboard') ? 'active' : ''}>
          <span className="nav-icon"><DashboardIcon /></span>
          Dashboard
        </Link>
        <Link to="/reports" className={isActive('/reports') ? 'active' : ''}>
          <span className="nav-icon"><ReportsIcon /></span>
          Reports
        </Link>
        <Link to="/history" className={isActive('/history') ? 'active' : ''}>
          <span className="nav-icon"><HistoryIcon /></span>
          History
        </Link>
        {user?.role === 'Admin' && (
          <Link to="/admin" className={isActive('/admin') ? 'active' : ''}>
            <span className="nav-icon"><AdminIcon /></span>
            Admin Panel
          </Link>
        )}
      </nav>
      <button className="logout-btn" onClick={handleLogout}>
        <span className="nav-icon"><LogoutIcon /></span>
        Logout
      </button>
    </div>
  );
};

export default Sidebar;