import * as SecureStore from 'expo-secure-store';

export const ACCESS_TOKEN_KEY = 'access_token';

type SessionListener = () => void;

const listeners = new Set<SessionListener>();

export function onSessionCleared(listener: SessionListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function readToken() {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  listeners.forEach((listener) => listener());
}
