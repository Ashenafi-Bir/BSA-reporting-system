// src/services/scheduleApi.ts
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
};

export interface Schedule {
  id: number;
  name: string;
  report_key: string;
  cron_expression: string;
  timezone: string;
  schedule_type: string;
  date_mode: string;
  skip_holidays: boolean;
  enabled: boolean;
  description?: string;
  params?: string;
  last_run_at?: string;
  last_run_status?: string;
  last_run_message?: string;
  next_run?: string;
  created_at: string;
  updated_at: string;
}

/* ============================================================
 * SCHEDULES
 * ============================================================ */

export const getSchedules = async () => {
  const response = await axios.get(`${API_BASE}/schedules`, {
    headers: getAuthHeader(),
  });
  return response.data;
};

export const getSchedule = async (id: number) => {
  const response = await axios.get(`${API_BASE}/schedules/${id}`, {
    headers: getAuthHeader(),
  });
  return response.data;
};

export const createSchedule = async (data: Partial<Schedule>) => {
  const response = await axios.post(`${API_BASE}/schedules`, data, {
    headers: getAuthHeader(),
  });
  return response.data;
};

export const updateSchedule = async (id: number, data: Partial<Schedule>) => {
  const response = await axios.put(`${API_BASE}/schedules/${id}`, data, {
    headers: getAuthHeader(),
  });
  return response.data;
};

export const deleteSchedule = async (id: number) => {
  const response = await axios.delete(`${API_BASE}/schedules/${id}`, {
    headers: getAuthHeader(),
  });
  return response.data;
};

export const toggleSchedule = async (id: number, enabled: boolean) => {
  const response = await axios.patch(
    `${API_BASE}/schedules/${id}/toggle`,
    { enabled },
    { headers: getAuthHeader() }
  );
  return response.data;
};

export const runScheduleNow = async (id: number) => {
  const response = await axios.post(
    `${API_BASE}/schedules/${id}/run`,
    {},
    { headers: getAuthHeader() }
  );
  return response.data;
};