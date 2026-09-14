import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';
import {
  getUsers,
  getRoles,
  createUser,
  updateUserRole,
  deactivateUser,
  getRoleReports,
  assignRoleReports,
  searchLdapUsers,
} from '../services/api';
import { REPORT_METADATA, REPORT_KEYS } from '../constants/reports';

const Admin: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [roleReports, setRoleReports] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLdapUser, setSelectedLdapUser] = useState<any>(null);
  const [newUser, setNewUser] = useState({ username: '', fullName: '', roleId: '' });
  const [userSearchFilter, setUserSearchFilter] = useState('');

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  // Modal state (for confirmations)
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'primary';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger',
  });

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([getUsers(), getRoles()]);
      setUsers(usersRes.data || []);
      setRoles(rolesRes.data || []);
    } catch (error) {
      console.error(error);
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({ message, type });
  };

  const fetchRoleReports = async (roleId: number) => {
    try {
      const res = await getRoleReports(roleId);
      setRoleReports(res.data || []);
      setSelectedRoleId(roleId);
    } catch (error) {
      console.error(error);
      showToast('Failed to load role reports', 'error');
    }
  };

  const handleSearchLdap = async () => {
    if (!searchTerm.trim()) return;
    setIsSearching(true);
    try {
      const res = await searchLdapUsers(searchTerm);
      setSearchResults(res.data || []);
    } catch (error) {
      console.error(error);
      showToast('Failed to search LDAP users', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectLdapUser = (ldapUser: any) => {
    setSelectedLdapUser(ldapUser);
    setNewUser({
      username: ldapUser.username || ldapUser.sAMAccountName || '',
      fullName: ldapUser.fullName || ldapUser.displayName || ldapUser.name || '',
      roleId: ''
    });
    setSearchResults([]);
    setSearchTerm('');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.fullName || !newUser.roleId) {
      showToast('Please fill all fields and select a role', 'warning');
      return;
    }
    try {
      await createUser({
        username: newUser.username,
        fullName: newUser.fullName,
        roleId: Number(newUser.roleId)
      });
      setNewUser({ username: '', fullName: '', roleId: '' });
      setSelectedLdapUser(null);
      await fetchData();
      showToast('User created successfully', 'success');
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to create user', 'error');
    }
  };

  const handleRoleChange = async (userId: number, roleId: number) => {
    try {
      await updateUserRole(userId, roleId);
      await fetchData();
      showToast('Role updated successfully', 'success');
    } catch (error) {
      showToast('Failed to update role', 'error');
    }
  };

  const handleDeactivate = async (userId: number) => {
    setModal({
      isOpen: true,
      title: 'Deactivate User',
      message: 'Are you sure you want to deactivate this user? They will lose access to the system.',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deactivateUser(userId);
          await fetchData();
          showToast('User deactivated', 'success');
        } catch (error) {
          showToast('Failed to deactivate user', 'error');
        } finally {
          setModal(prev => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleAssignReports = async () => {
    if (!selectedRoleId) return;
    try {
      await assignRoleReports(selectedRoleId, roleReports);
      showToast('Reports assigned successfully', 'success');
    } catch (error) {
      showToast('Failed to assign reports', 'error');
    }
  };

  const toggleReport = (reportKey: string) => {
    setRoleReports(prev =>
      prev.includes(reportKey) ? prev.filter(r => r !== reportKey) : [...prev, reportKey]
    );
  };

  const toggleAllReports = (checked: boolean) => {
    if (checked) {
      setRoleReports(REPORT_KEYS);
    } else {
      setRoleReports([]);
    }
  };

  // Filter users based on search input
  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(userSearchFilter.toLowerCase()) ||
    u.full_name.toLowerCase().includes(userSearchFilter.toLowerCase())
  );

  if (loading) return <div className="loading-spinner">Loading...</div>;

  return (
    <div className="app-layout">
      <Sidebar user={user} />
      <main className="main-content">
        <div className="page-header">
          <h1>Admin Panel</h1>
          <p className="page-subtitle">Manage users, roles, and report permissions</p>
        </div>

        {/* Create User Card */}
        <div className="card">
          <h3>Create User from LDAP</h3>
          <div className="ldap-search">
            <input
              type="text"
              placeholder="Search by username or full name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchLdap()}
            />
            <button className="btn btn-secondary" onClick={handleSearchLdap} disabled={isSearching}>
              {isSearching ? 'Searching...' : 'Search LDAP'}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="ldap-results">
              <p>Select a user:</p>
              <ul>
                {searchResults.map((ldapUser, idx) => (
                  <li key={idx} onClick={() => handleSelectLdapUser(ldapUser)}>
                    <strong>{ldapUser.fullName || ldapUser.displayName || ldapUser.name}</strong> ({ldapUser.username || ldapUser.sAMAccountName})
                  </li>
                ))}
              </ul>
            </div>
          )}
          {selectedLdapUser && (
            <div className="selected-user">
              <p>Selected: <strong>{selectedLdapUser.fullName || selectedLdapUser.displayName}</strong> ({selectedLdapUser.username})</p>
            </div>
          )}
          <form onSubmit={handleCreateUser} className="admin-form">
            <div className="form-row">
              <div className="form-field">
                <label>Username</label>
                <input
                  type="text"
                  placeholder="Username"
                  value={newUser.username}
                  onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-field">
                <label>Full Name</label>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={newUser.fullName}
                  onChange={e => setNewUser({ ...newUser, fullName: e.target.value })}
                  required
                />
              </div>
              <div className="form-field">
                <label>Role</label>
                <select
                  value={newUser.roleId}
                  onChange={e => setNewUser({ ...newUser, roleId: e.target.value })}
                  required
                >
                  <option value="">Select Role</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end' }}>
                Create User
              </button>
            </div>
          </form>
          <p className="hint">Or manually enter username and full name if LDAP search is unavailable.</p>
        </div>

        {/* Users Table Card */}
        <div className="card">
          <div className="card-header-actions">
            <h3>Users ({filteredUsers.length})</h3>
            <div className="search-field" style={{ minWidth: '200px' }}>
              <input
                type="text"
                placeholder="Search users..."
                value={userSearchFilter}
                onChange={(e) => setUserSearchFilter(e.target.value)}
              />
            </div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Full Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id}>
                    <td><strong>{u.username}</strong></td>
                    <td>{u.full_name}</td>
                    <td>
                      <select
                        value={u.role_id}
                        onChange={e => handleRoleChange(u.id, Number(e.target.value))}
                        className="role-select"
                      >
                        {roles.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => fetchRoleReports(u.role_id)}
                      >
                        View Reports
                      </button>
                      {u.is_active && (
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeactivate(u.id)}
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Role Reports Assignment Card */}
        {selectedRoleId && (
          <div className="card">
            <div className="card-header-actions">
              <h3>Assign Reports to Role: {roles.find(r => r.id === selectedRoleId)?.name}</h3>
              <label className="select-all-label">
                <input
                  type="checkbox"
                  checked={roleReports.length === REPORT_KEYS.length}
                  onChange={(e) => toggleAllReports(e.target.checked)}
                />
                Select All
              </label>
            </div>
            <div className="checkbox-grid">
              {REPORT_KEYS.map(key => (
                <label key={key} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={roleReports.includes(key)}
                    onChange={() => toggleReport(key)}
                  />
                  {REPORT_METADATA[key].name}
                </label>
              ))}
            </div>
            <button className="btn btn-primary" onClick={handleAssignReports}>
              Save Assignments
            </button>
          </div>
        )}
      </main>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        onConfirm={modal.onConfirm}
        onCancel={() => setModal(prev => ({ ...prev, isOpen: false }))}
        variant={modal.variant}
      />

      {/* Toast Notification */}
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

export default Admin;