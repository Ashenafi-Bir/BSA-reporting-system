import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import SubmitPanel from '../components/SubmitPanel';


// Remove the import { Report } and replace with:
interface Report {
  key: string;
  name: string;
  isWeekly: boolean;
}

// ✅ Reports array matches the Report interface
const REPORTS: Report[] = [
  { key: 'SINGLE_CURRENCYOP001', name: 'Single Currency OP001', isWeekly: false },
  { key: 'LSR-Statutory ZS001', name: 'Liquidity Requirement Report', isWeekly: true },
  { key: 'CD by S and RegMD001', name: 'Deposit by Sector and Region', isWeekly: false },
  { key: 'NBE_20_DEP_MR001', name: 'Quarterly Top 20 Depositors', isWeekly: false },
  { key: 'CDby Range and RegCM002', name: 'Deposit by Range and Region', isWeekly: false },
  { key: 'CDby Sector and RegMD002', name: 'Deposit by Sector and Region MD002', isWeekly: false }
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

  const allowedReports = user?.allowedReports || [];
  const filteredReports = REPORTS.filter((r) =>
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