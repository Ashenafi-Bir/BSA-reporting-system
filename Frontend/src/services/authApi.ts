import axios from 'axios';
import { type LoginResponse } from '../types/index';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

export const login = async (username: string, password: string): Promise<LoginResponse> => {
  const response = await axios.post(`${API_BASE}/auth/login`, { username, password });
  return response.data;
};

export const getMe = async (token: string) => {
  const response = await axios.get(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};