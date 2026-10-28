/**
 * Runtime configuration.
 *
 * `EXPO_PUBLIC_API_URL` is inlined at build time by Expo, so it must be set in
 * `.env` (see `.env.example`) before starting Metro. Note that `localhost` does
 * not resolve on a physical device - use a LAN IP or a tunnel URL there.
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error(
    'EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env and restart Metro.',
  );
}

export const config = {
  apiUrl: API_URL,
  mediaBaseUrl: API_URL.replace(/\/api\/?$/, ''),
};
