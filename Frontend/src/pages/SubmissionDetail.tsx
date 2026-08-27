import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { getSubmission, previewReport } from '../services/api';
import dictionaryData from '../data/dictionary.json';

type SortField = 'code' | 'value';
type SortDirection = 'asc' | 'desc';

interface DynamicItem {
  Code: string;
  Value: string;
  _description?: string;
}

interface DynamicGroup {
  Area: number;
  _areaName: string;
  DynamicItems: DynamicItem[];
}

// Row data: maps column code (e.g., "1.1") to its value
type RowData = Record<string, string>;

interface DynamicGroupWithRows {
  area: number;
  areaName: string;
  rows: RowData[];
  columnCodes: string[]; // sorted list of column codes
}

const SubmissionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<any>(null);
  const [showPayload, setShowPayload] = useState(false);
  const [payloadLoading, setPayloadLoading] = useState(false);
  const [showZeroValues, setShowZeroValues] = useState(true);
  const [sortField, setSortField] = useState<SortField>('code');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [activeTab, setActiveTab] = useState<'summary' | 'dynamic'>('summary');

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
    fetchSubmission();
  }, [id]);

  const fetchSubmission = async () => {
    try {
      const res = await getSubmission(Number(id));
      setSubmission(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewPayload = async () => {
    if (!submission) return;
    setPayloadLoading(true);
    try {
      if (submission.start_date && submission.end_date) {
        const start = new Date(submission.start_date).toLocaleDateString('en-CA');
        const end = new Date(submission.end_date).toLocaleDateString('en-CA');
        const dateParam = `${start}/${end}`;
        const response = await previewReport(submission.report_key, dateParam);

        // Extract payload – handle both direct and nested responses
        let payloadData = response.data || response;
        if (payloadData.data && typeof payloadData.data === 'object' && payloadData.data.ReturnItemsList) {
          payloadData = payloadData.data;
        }

        setPayload(payloadData);
        setShowPayload(true);
        setActiveTab('summary');
      } else {
        alert('No date range available for this submission');
      }
    } catch (error) {
      console.error('Error fetching payload:', error);
      alert('Could not fetch payload');
    } finally {
      setPayloadLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Build description map from dictionary
  const descriptionMap = useMemo(() => {
    const dict = (dictionaryData as any)[submission?.report_key] || { ReturnItemsList: [] };
    const map: Record<string, string> = {};
    (dict.ReturnItemsList || []).forEach((item: any) => {
      if (item.Code && item._description) {
        map[item.Code] = item._description;
      }
    });
    return map;
  }, [submission?.report_key]);

  // Summary static items
  const staticItems = useMemo(() => {
    if (!payload?.ReturnItemsList) return [];
    let items = payload.ReturnItemsList.map((item: any) => ({
      ...item,
      description: descriptionMap[item.Code] || 'No description'
    }));
    if (!showZeroValues) {
      items = items.filter((item: any) => item.Value !== '0' && item.Value !== '');
    }
    const compare = (a: any, b: any) => {
      let valA, valB;
      switch (sortField) {
        case 'code':
          valA = a.Code;
          valB = b.Code;
          break;
        case 'value':
          valA = parseFloat(a.Value);
          valB = parseFloat(b.Value);
          if (isNaN(valA)) valA = a.Value;
          if (isNaN(valB)) valB = b.Value;
          break;
        default:
          valA = a.Code;
          valB = b.Code;
      }
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    };
    items.sort(compare);
    return items;
  }, [payload, descriptionMap, showZeroValues, sortField, sortDirection]);

  // --- Generic dynamic table builder ---
  const dynamicGroups: DynamicGroupWithRows[] = useMemo(() => {
    if (!payload?.DynamicItemsList || payload.DynamicItemsList.length === 0) {
      return [];
    }

    const result: DynamicGroupWithRows[] = [];

    payload.DynamicItemsList.forEach((group: DynamicGroup) => {
      const area = group.Area;
      let areaName = group._areaName || `Area ${area}`;
      // If areaName is empty or generic, we can leave it.

      const items = group.DynamicItems || [];
      if (items.length === 0) {
        result.push({ area, areaName, rows: [], columnCodes: [] });
        return;
      }

      // 1. Group items by row prefix (e.g., "1" from "1.1")
      const rowsMap: Record<string, RowData> = {};
      const allCodes: string[] = [];

      items.forEach((item: DynamicItem) => {
        const code = item.Code;
        allCodes.push(code);
        // Try to extract prefix – assume code format like "X.Y" or "X.Y.Z"
        let prefix = code;
        if (code.includes('.')) {
          prefix = code.split('.')[0]; // take first part as row index
        } else {
          // If no dot, treat each code as its own column in a single row? 
          // But that would create many rows. Instead, we'll treat the whole code as prefix.
          // In practice, this case is unlikely for tabular dynamic data.
        }
        if (!rowsMap[prefix]) {
          rowsMap[prefix] = {};
        }
        rowsMap[prefix][code] = item.Value;
      });

      // Sort prefixes numerically if possible
      const prefixes = Object.keys(rowsMap);
      prefixes.sort((a, b) => {
        const aNum = parseFloat(a);
        const bNum = parseFloat(b);
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
        return a.localeCompare(b);
      });

      const rows: RowData[] = prefixes.map(p => rowsMap[p]);

      // Determine column codes: use all unique codes, sorted in the order they appear in the first row
      const firstRowKeys = rows.length > 0 ? Object.keys(rows[0]) : [];
      const allRowKeys = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
      // Sort: first row keys first, then others alphabetically
      const orderedKeys = allRowKeys.sort((a, b) => {
        const idxA = firstRowKeys.indexOf(a);
        const idxB = firstRowKeys.indexOf(b);
        if (idxA === -1 && idxB === -1) return a.localeCompare(b);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });

      result.push({
        area,
        areaName,
        rows,
        columnCodes: orderedKeys,
      });
    });

    return result;
  }, [payload]);

  const totalFields = payload?.ReturnItemsList?.length || 0;
  const totalDynamicRows = dynamicGroups.reduce((acc, g) => acc + g.rows.length, 0);

  // Determine dynamic tab name: use the first group's area name if available, else "Dynamic Data"
  const dynamicTabName = useMemo(() => {
    if (dynamicGroups.length > 0 && dynamicGroups[0].areaName) {
      // If the first area name is something like "Top 10 Depositors", we can shorten it
      const name = dynamicGroups[0].areaName;
      // Remove "Top 10" or similar to just "Depositors" if present
      if (name.includes('Depositors')) return 'Depositors';
      if (name.includes('Details')) return 'Details';
      return name;
    }
    return 'Dynamic Data';
  }, [dynamicGroups]);

  if (loading) return <div>Loading...</div>;
  if (!submission) return <div>Submission not found</div>;

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      submitted: 'badge-blue',
      processing: 'badge-yellow',
      success: 'badge-green',
      failed: 'badge-red',
    };
    return colors[status] || 'badge-gray';
  };

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '0.5rem 1rem',
    background: 'none',
    border: 'none',
    borderBottom: isActive ? '3px solid #007bff' : '3px solid transparent',
    cursor: 'pointer',
    fontWeight: isActive ? '600' : '400',
    color: isActive ? '#007bff' : '#333',
    fontSize: '0.9rem',
  });

  return (
    <div className="app-layout">
      <Sidebar user={user} />
      <main className="main-content">
        <div className="page-header">
          <h1>Submission Detail</h1>
          <button className="btn btn-secondary" onClick={() => navigate(-1)}>Back</button>
        </div>
        <div className="card detail-card">
          <div className="detail-grid">
            <div><label>Report</label><p>{submission.report_key}</p></div>
            <div><label>Filename</label><p className="filename">{submission.filename || 'N/A'}</p></div>
            <div><label>Submitted At</label><p>{new Date(submission.submitted_at).toLocaleString()}</p></div>
            <div><label>Status</label><p><span className={`badge ${getStatusBadge(submission.status)}`}>{submission.status}</span></p></div>
            <div><label>BSA Status</label><p>{submission.bsa_status || 'N/A'}</p></div>
            <div><label>Start Date</label><p>{submission.start_date ? new Date(submission.start_date).toLocaleDateString() : 'N/A'}</p></div>
            <div><label>End Date</label><p>{submission.end_date ? new Date(submission.end_date).toLocaleDateString() : 'N/A'}</p></div>
            <div><label>Response</label><p className="truncate">{submission.response ? 'Yes' : 'No'}</p></div>
          </div>
          {submission.error && (
            <div className="error-box">
              <label>Error</label>
              <pre>{submission.error}</pre>
            </div>
          )}
          <div className="detail-actions">
            <button className="btn btn-primary" onClick={handleViewPayload} disabled={payloadLoading}>
              {payloadLoading ? 'Loading...' : 'View Payload'}
            </button>
          </div>

          {showPayload && payload && (
            <div className="payload-view" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '2px solid #e2e8f0' }}>
              <div className="payload-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h4 style={{ margin: 0 }}>Payload Preview</h4>
                <div>
                  {activeTab === 'summary' && (
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => setShowZeroValues(!showZeroValues)}
                    >
                      {showZeroValues ? 'Hide Zero Values' : 'Show Zero Values'}
                    </button>
                  )}
                  <button className="btn btn-sm btn-secondary" onClick={() => setShowPayload(false)} style={{ marginLeft: '0.5rem' }}>
                    Close
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #ddd', marginBottom: '1rem' }}>
                <button onClick={() => setActiveTab('summary')} style={tabStyle(activeTab === 'summary')}>
                  Summary ({staticItems.length} fields)
                </button>
                <button onClick={() => setActiveTab('dynamic')} style={tabStyle(activeTab === 'dynamic')}>
                  {dynamicGroups.length > 0 ? `${dynamicTabName} (${totalDynamicRows} rows)` : 'No Dynamic Data'}
                </button>
                <div style={{ background: '#ff6b6b', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem' }}>
                  TABS RENDERED
                </div>
              </div>

              {/* Summary Tab */}
              {activeTab === 'summary' && (
                <div>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th onClick={() => handleSort('code')} style={{ cursor: 'pointer' }}>
                            Code &amp; Description {sortField === 'code' && (sortDirection === 'asc' ? '▲' : '▼')}
                          </th>
                          <th onClick={() => handleSort('value')} style={{ cursor: 'pointer' }}>
                            Value {sortField === 'value' && (sortDirection === 'asc' ? '▲' : '▼')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {staticItems.map((item: any, idx: number) => (
                          <tr key={idx}>
                            <td>
                              <span className="code">{item.Code}</span>
                              <span className="description" title={item.description}>
                                – {item.description}
                              </span>
                            </td>
                            <td className="value">{item.Value}</td>
                          </tr>
                        ))}
                        {staticItems.length === 0 && (
                          <tr>
                            <td colSpan={2} className="empty-state">No static fields match the current filters.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="table-footer">Showing {staticItems.length} of {totalFields} static fields.</div>
                </div>
              )}

              {/* Dynamic Tab */}
              {activeTab === 'dynamic' && (
                <div>
                  {payload.DynamicItemsList && payload.DynamicItemsList.length > 0 ? (
                    <>
                      <div style={{ background: '#d4edda', padding: '8px 12px', borderRadius: '4px', marginBottom: '1rem', color: '#155724' }}>
                        ✅ Dynamic data found ({payload.DynamicItemsList.length} areas)
                      </div>
                      {dynamicGroups.length > 0 ? (
                        <div className="dynamic-tables">
                          {dynamicGroups.map((group, idx) => (
                            <div key={idx} style={{ marginBottom: '2rem' }}>
                              <h5>{group.areaName}</h5>
                              {group.rows.length > 0 && group.columnCodes.length > 0 ? (
                                <div className="table-wrapper">
                                  <table>
                                    <thead>
                                      <tr>
                                        {group.columnCodes.map((code) => (
                                          <th key={code}>
                                            {descriptionMap[code] || code}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {group.rows.map((row, rowIdx) => (
                                        <tr key={rowIdx}>
                                          {group.columnCodes.map((code) => (
                                            <td key={code}>{row[code] || ''}</td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="empty-state">No data rows for this area.</p>
                              )}
                            </div>
                          ))}
                          <div className="table-footer">Total rows: {totalDynamicRows}</div>
                        </div>
                      ) : (
                        <p className="empty-state">Could not parse dynamic data into tables.</p>
                      )}
                    </>
                  ) : (
                    <div style={{ background: '#f8d7da', padding: '8px 12px', borderRadius: '4px', color: '#721c24' }}>
                      ❌ No dynamic items in this report.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SubmissionDetail;