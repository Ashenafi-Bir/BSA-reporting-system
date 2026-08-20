import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

export const triggerReport = async (reportKey: string, date?: string) => {
  const response = await axios.post(
    `${API_BASE}/reports/${reportKey}/trigger`,
    {},
    { 
      params: { date },
      headers: getAuthHeader()
    }
  );
  return response.data;
};

export const previewReport = async (reportKey: string, date?: string) => {
  const response = await axios.get(
    `${API_BASE}/reports/${reportKey}/preview`,
    { 
      params: { date },
      headers: getAuthHeader()
    }
  );
  return response.data;
};

export const getSubmissions = async (limit = 50, offset = 0) => {
  const response = await axios.get(`${API_BASE}/submissions`, {
    params: { limit, offset },
    headers: getAuthHeader()
  });
  return response.data;
};

export const getSubmission = async (id: number) => {
  const response = await axios.get(`${API_BASE}/submissions/${id}`, {
    headers: getAuthHeader()
  });
  return response.data;
};

export const checkSubmissionStatus = async (id: number) => {
  const response = await axios.post(
    `${API_BASE}/submissions/${id}/check-status`,
    {},
    { headers: getAuthHeader() }
  );
  return response.data;
};

// Admin APIs
export const getUsers = async () => {
  const response = await axios.get(`${API_BASE}/users`, {
    headers: getAuthHeader()
  });
  return response.data;
};

export const createUser = async (data: { username: string; fullName: string; roleId: number }) => {
  const response = await axios.post(`${API_BASE}/users`, data, {
    headers: getAuthHeader()
  });
  return response.data;
};

export const updateUserRole = async (userId: number, roleId: number) => {
  const response = await axios.put(
    `${API_BASE}/users/${userId}/role`,
    { userId, roleId },
    { headers: getAuthHeader() }
  );
  return response.data;
};

export const deactivateUser = async (userId: number) => {
  const response = await axios.delete(`${API_BASE}/users/${userId}`, {
    headers: getAuthHeader()
  });
  return response.data;
};

export const getRoles = async () => {
  const response = await axios.get(`${API_BASE}/users/roles`, {
    headers: getAuthHeader()
  });
  return response.data;
};

export const getRoleReports = async (roleId: number) => {
  const response = await axios.get(`${API_BASE}/users/roles/${roleId}/reports`, {
    headers: getAuthHeader()
  });
  return response.data;
};

export const assignRoleReports = async (roleId: number, reportKeys: string[]) => {
  const response = await axios.put(
    `${API_BASE}/users/roles/${roleId}/reports`,
    { reportKeys },
    { headers: getAuthHeader() }
  );
  return response.data;
};// Add this to api.ts
export const searchLdapUsers = async (searchTerm: string) => {
  const token = localStorage.getItem('token');
  const response = await axios.get(`${API_BASE}/users/ldap/search`, {
    params: { searchTerm },
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};