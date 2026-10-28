import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

import { config } from './config';
import { ACCESS_TOKEN_KEY, clearSession } from './session';

const api = axios.create({
  baseURL: config.apiUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (requestConfig) => {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (token) {
    requestConfig.headers.Authorization = `Bearer ${token}`;
  }
  return requestConfig;
});

// A rejected token is unrecoverable for the current session: drop it so the
// router sends the user back to the login screen instead of looping on 401s.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      await clearSession();
    }
    return Promise.reject(error);
  },
);

export default api;
