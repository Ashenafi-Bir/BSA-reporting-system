import React, { useState } from 'react';
import SubmitPanel from './SubmitPanel';
import History from './History';

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'submit' | 'history'>('submit');

  return (
    <div className="container">
      <h1 className="page-title">NBE BSA Report Submitter</h1>
      <div className="tab-bar">
        <button
          className={`tab-btn ${activeTab === 'submit' ? 'active' : ''}`}
          onClick={() => setActiveTab('submit')}
        >
          Submit Report
        </button>
        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
      </div>
      <div className="tab-content">
        {activeTab === 'submit' ? <SubmitPanel /> : <History />}
      </div>
    </div>
  );
};

export default Dashboard;