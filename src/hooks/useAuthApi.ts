import { useCallback, useState } from 'react';

import { authApi } from '../libs/endpoints';
import { apiErrorMessage } from '../libs/format';
import type { LoginPayload, OnboardingPayload } from '../types/api';

export function useAuthApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T>(action: () => Promise<T>, fallback: string) => {
    setLoading(true);
    setError(null);
    try {
      return await action();
    } catch (err) {
      setError(apiErrorMessage(err, fallback));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    login: useCallback(
      (payload: LoginPayload) => run(() => authApi.login(payload), 'Login failed'),
      [run],
    ),
    sendOtp: useCallback(
      (phoneNumber: string) =>
        run(() => authApi.sendWhatsappOtp(phoneNumber), 'Failed to send OTP'),
      [run],
    ),
    verifyOtp: useCallback(
      (otp: string) => run(() => authApi.verifyWhatsappOtp(otp), 'Invalid OTP'),
      [run],
    ),
    onboard: useCallback(
      (payload: OnboardingPayload) =>
        run(() => authApi.onboarding(payload), 'Onboarding failed'),
      [run],
    ),
  };
}
