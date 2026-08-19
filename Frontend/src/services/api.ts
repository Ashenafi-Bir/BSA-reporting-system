import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

export const triggerReport = async (reportKey: string, date?: string) => {
  const response = await axios.post(
    `${API_BASE}/reports/${reportKey}/trigger`,
    {},
    { params: { date } }
  );
  return response.data;
};

export const previewReport = async (reportKey: string, date?: string) => {
  const response = await axios.get(
    `${API_BASE}/reports/${reportKey}/preview`,
    { params: { date } }
  );
  return response.data;
};

export const getReportStatus = async (reportKey: string) => {
  const response = await axios.get(`${API_BASE}/reports/${reportKey}/status`);
  return response.data;
};