import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import api from './api';
import { config } from './config';
import type { AuthResponse } from '../types/api';

/**
 * Google sign-in through the backend's existing OAuth flow.
 *
 * The app opens `/auth/google?client=mobile&code_challenge=…` in the system
 * browser. After consent the backend redirects to `taskme://auth/google?code=…`
 * with a 2-minute, single-use code bound to our PKCE challenge, and we trade
 * it (plus the verifier only we hold) for a normal session. The calendar
 * grant and refresh token stay on the server, exactly like the web login.
 *
 * Returns null when the user closes the browser.
 */
export async function signInWithGoogle(): Promise<AuthResponse | null> {
  const verifier = base64url(Crypto.getRandomBytes(32));
  const challenge = base64url(
    new Uint8Array(
      await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new TextEncoder().encode(verifier)),
    ),
  );

  const returnUrl = Linking.createURL('auth/google');
  const startUrl =
    `${config.apiUrl}/auth/google?client=mobile&code_challenge=${encodeURIComponent(challenge)}`;

  const result = await WebBrowser.openAuthSessionAsync(startUrl, returnUrl);
  if (result.type !== 'success') return null;

  const code = Linking.parse(result.url).queryParams?.code;
  if (typeof code !== 'string' || !code) {
    throw new Error('Google sign-in did not complete. Please try again.');
  }

  const { data } = await api.post<AuthResponse>('/auth/google/exchange', {
    code,
    codeVerifier: verifier,
  });
  return data;
}

function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
