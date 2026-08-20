import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import SubmitPanel from '../components/SubmitPanel';
import {  type report } from '../types/index';

const REPORTS: Report[] = [
  { key: 'SINGLE_CURRENCYOP001', name: 'Single Currency OP001', isWeekly: false },
  { key: 'LSR-Statutory ZS001', name: 'Liquidity Requirement Report', isWeekly: true },
];

const Dashboard: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) {
      navigate('/login');
      return;
    }
    setUser(JSON.parse(stored));
  }, [navigate]);

  // Filter reports based on user's allowed reports
  const allowedReports = user?.allowedReports || [];
  const filteredReports = REPORTS.filter(r => 
    user?.role === 'Admin' || user?.role === 'ITMaker' || allowedReports.includes(r.key)
  );

  if (!user) return <div>Loading...</div>;

  return (
    <div className="app-layout">
      <Sidebar user={user} />
      <main className="main-content">
        <div className="page-header">
          <h1>Dashboard</h1>
          <p>Welcome, {user.fullName}</p>
        </div>
        <SubmitPanel 
          reports={filteredReports} 
          role={user.role}
          allowedReports={allowedReports}
        />
      </main>
    </div>
  );
};

export default Dashboard;