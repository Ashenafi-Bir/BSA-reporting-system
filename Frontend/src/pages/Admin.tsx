import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
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

const Admin: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [roleReports, setRoleReports] = useState<string[]>([]);
  const [allReportKeys, setAllReportKeys] = useState<string[]>(['SINGLE_CURRENCYOP001', 'LSR-Statutory ZS001']);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLdapUser, setSelectedLdapUser] = useState<any>(null);
  const [newUser, setNewUser] = useState({ username: '', fullName: '', roleId: '' });

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
    } finally {
      setLoading(false);
    }
  };

  const fetchRoleReports = async (roleId: number) => {
    try {
      const res = await getRoleReports(roleId);
      setRoleReports(res.data || []);
      setSelectedRoleId(roleId);
    } catch (error) {
      console.error(error);
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
      alert('Failed to search LDAP users');
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
      alert('Please fill all fields and select a role');
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
      alert('User created successfully');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create user');
    }
  };

  const handleRoleChange = async (userId: number, roleId: number) => {
    try {
      await updateUserRole(userId, roleId);
      await fetchData();
      alert('Role updated');
    } catch (error) {
      alert('Failed to update role');
    }
  };

  const handleDeactivate = async (userId: number) => {
    if (confirm('Deactivate this user?')) {
      try {
        await deactivateUser(userId);
        await fetchData();
        alert('User deactivated');
      } catch (error) {
        alert('Failed to deactivate user');
      }
    }
  };

  const handleAssignReports = async () => {
    if (!selectedRoleId) return;
    try {
      await assignRoleReports(selectedRoleId, roleReports);
      alert('Reports assigned successfully');
    } catch (error) {
      alert('Failed to assign reports');
    }
  };

  const toggleReport = (reportKey: string) => {
    setRoleReports(prev =>
      prev.includes(reportKey) ? prev.filter(r => r !== reportKey) : [...prev, reportKey]
    );
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="app-layout">
      <Sidebar user={user} />
      <main className="main-content">
        <div className="page-header">
          <h1>Admin Panel</h1>
        </div>

        {/* Search & Create User */}
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
            <input
              type="text"
              placeholder="Username"
              value={newUser.username}
              onChange={e => setNewUser({ ...newUser, username: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Full Name"
              value={newUser.fullName}
              onChange={e => setNewUser({ ...newUser, fullName: e.target.value })}
              required
            />
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
            <button type="submit" className="btn btn-primary">Create User</button>
          </form>
          <p className="hint">Or manually enter username and full name if LDAP search is unavailable.</p>
        </div>

        {/* Users List */}
        <div className="card">
          <h3>Users ({users.length})</h3>
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
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.username}</td>
                    <td>{u.full_name}</td>
                    <td>
                      <select
                        value={u.role_id}
                        onChange={e => handleRoleChange(u.id, Number(e.target.value))}
                      >
                        {roles.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>{u.is_active ? 'Active' : 'Inactive'}</td>
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

        {/* Role Reports Assignment */}
        {selectedRoleId && (
          <div className="card">
            <h3>Assign Reports to Role: {roles.find(r => r.id === selectedRoleId)?.name}</h3>
            <div className="checkbox-group">
              {allReportKeys.map(key => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={roleReports.includes(key)}
                    onChange={() => toggleReport(key)}
                  />
                  {key}
                </label>
              ))}
            </div>
            <button className="btn btn-primary" onClick={handleAssignReports}>Save Assignments</button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Admin;