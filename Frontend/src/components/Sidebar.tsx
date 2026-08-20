import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { logout } from '../services/authApi';

interface SidebarProps {
  user: any;
}

const Sidebar: React.FC<SidebarProps> = ({ user }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>BSA Reports</h2>
        <div className="user-info">
          <span>{user?.fullName || user?.username}</span>
          <span className="role-badge">{user?.role || 'User'}</span>
        </div>
      </div>
      <nav className="sidebar-nav">
        <Link to="/dashboard" className={isActive('/dashboard') ? 'active' : ''}>
          Dashboard
        </Link>
        <Link to="/history" className={isActive('/history') ? 'active' : ''}>
          History
        </Link>
        {user?.role === 'Admin' && (
          <Link to="/admin" className={isActive('/admin') ? 'active' : ''}>
            Admin Panel
          </Link>
        )}
      </nav>
      <button className="logout-btn" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
};

export default Sidebar;