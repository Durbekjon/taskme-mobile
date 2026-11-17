import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import api from './api';
import type { AuthResponse } from '../types/api';

/** Sign in with Apple is iOS-only here; Android users have Google + email. */
export const appleSignInAvailable = () => AppleAuthentication.isAvailableAsync();

/**
 * Native Sign in with Apple, then hand the identity token to the API.
 *
 * A random nonce is generated per attempt: Apple gets its SHA-256 and echoes
 * it inside the signed token, the API gets the raw value and checks the two
 * match, so a captured token cannot be replayed.
 *
 * Returns null when the user cancels the Apple sheet.
 */
export async function signInWithApple(): Promise<AuthResponse | null> {
  const rawNonce = Crypto.randomUUID() + Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw e;
  }

  if (!credential.identityToken) {
    throw new Error('Apple did not return a sign-in token. Please try again.');
  }

  const { data } = await api.post<AuthResponse>('/auth/apple', {
    identityToken: credential.identityToken,
    nonce: rawNonce,
    authorizationCode: credential.authorizationCode ?? undefined,
    // Apple sends the name only the first time the user signs in.
    firstName: credential.fullName?.givenName ?? undefined,
    lastName: credential.fullName?.familyName ?? undefined,
  });
  return data;
}
