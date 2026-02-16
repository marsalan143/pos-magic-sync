import axios from 'axios';
import { db } from '@/db';

const api = axios.create({
  baseURL: '', // Will be set after license activation
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Set base URL from stored settings
export async function initializeApiClient() {
  const setting = await db.settings.get('api_base_url');
  if (setting) {
    api.defaults.baseURL = setting.value;
  }
}

// Interceptor to add auth token
api.interceptors.request.use(async (config) => {
  const license = await db.license.toCollection().first();
  if (license?.token) {
    config.headers['X-License-Token'] = license.token;
  }
  const session = await db.sessions.toCollection().last();
  if (session?.token) {
    config.headers['Authorization'] = `Bearer ${session.token}`;
  }
  return config;
});

export default api;
