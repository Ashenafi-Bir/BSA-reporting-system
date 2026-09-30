import axios from 'axios';
import { type LoginResponse } from '../types/index';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

/* ------------------------------------------------------------------ */
/*  Shared axios instance with global 401 handling                     */
/* ------------------------------------------------------------------ */
export const api = axios.create({
  baseURL: API_BASE,
});

/* Attach the bearer token to every outgoing request (if present). */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* Global 401 handler: clear session and bounce to /login. */
let isRedirecting = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401) {
      // Clear local session
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Avoid redirect loops and multiple simultaneous redirects
      if (!isRedirecting && window.location.pathname !== '/login') {
        isRedirecting = true;
        // Use a replace so the user can't go "back" into a protected page
        window.location.replace('/login');
      }
    }

    return Promise.reject(error);
  }
);

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */
export const login = async (
  username: string,
  password: string
): Promise<LoginResponse> => {
  const response = await api.post('/auth/login', { username, password });
  return response.data;
};

export const getMe = async (token?: string) => {
  // Allow overriding the token (e.g. right after login)
  const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  const response = await api.get('/auth/me', config);
  return response.data;
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.replace('/login');
};