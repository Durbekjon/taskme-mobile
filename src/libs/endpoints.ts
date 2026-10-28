/**
 * Every API call the mobile app makes, in one typed place.
 *
 * The screens used to spell paths inline, which is how `/bookings/studio/:id`
 * and `/clients/studio/:id` shipped - neither has ever been a route (the
 * server takes the studio from the JWT and serves `/bookings` and `/clients`).
 */
import api from './api';
import type {
  AuthResponse,
  AuthUser,
  Booking,
  Client,
  CrewAssignment,
  CreativeLookup,
  LoginPayload,
  OnboardingPayload,
  StudioFinanceSummary,
  Team,
  Studio,
  UpdateStudioPayload,
  WorkerFinanceSummary,
  WorkerAssignment,
  AssignmentResponse,
  CreateAssignmentPayload,
  ClientPayment,
  WorkerPayment,
  Expense,
  CreateClientPaymentPayload,
  CreateWorkerPaymentPayload,
  CreateExpensePayload,
  CreateBookingPayload,
} from '../types/api';

export const authApi = {
  login: (payload: LoginPayload) =>
    api.post<AuthResponse>('/auth/login', payload).then((r) => r.data),

  me: () => api.get<AuthUser>('/auth/me').then((r) => r.data),

  onboarding: (payload: OnboardingPayload) =>
    api.post<AuthResponse>('/auth/onboarding', payload).then((r) => r.data),

  sendWhatsappOtp: (phoneNumber: string) =>
    api
      .post<{ message: string }>('/auth/whatsapp/send-otp', { phoneNumber })
      .then((r) => r.data),

  verifyWhatsappOtp: (otp: string) =>
    api
      .post<{ message: string; verified: boolean }>('/auth/whatsapp/verify-otp', { otp })
      .then((r) => r.data),
};

export const usersApi = {
  updatePushToken: (token: string) =>
    api.post('/users/push-token', { token }).then((r) => r.data),

  updateProfile: (dto: {
    firstName?: string;
    lastName?: string;
    bio?: string;
    primaryRole?: string;
    primaryGear?: string;
    city?: string;
  }) => api.patch<AuthUser>('/users/me', dto).then((r) => r.data),

  uploadAvatar: (localUri: string) => {
    const form = new FormData();
    const filename = localUri.split('/').pop() ?? 'avatar.jpg';
    const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    form.append('file', { uri: localUri, name: filename, type: mime } as any);
    return api
      .post<{ avatarUrl: string }>('/users/me/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
};

export const bookingsApi = {
  list: () =>
    api
      .get<{ data: Booking[]; meta: unknown } | Booking[]>('/bookings')
      .then((r) => (Array.isArray(r.data) ? r.data : (r.data as { data: Booking[] }).data)),
  get: (id: string) => api.get<Booking>(`/bookings/${id}`).then((r) => r.data),
  create: (payload: CreateBookingPayload) =>
    api.post<Booking>('/bookings', payload).then((r) => r.data),
  update: (id: string, payload: Partial<Booking> & { parts?: any[]; people?: any[] }) =>
    api.patch<Booking>(`/bookings/${id}`, payload).then((r) => r.data),
};

export const clientsApi = {
  list: () => api.get<Client[]>('/clients').then((r) => r.data),
  update: (id: string, payload: Partial<Client>) =>
    api.patch<Client>(`/clients/${id}`, payload).then((r) => r.data),
};

export const crewApi = {
  listMine: () =>
    api.get<WorkerAssignment[]>('/crew-assignments/worker/me').then((r) => r.data),

  listByBooking: (bookingId: string) =>
    api.get<CrewAssignment[]>(`/crew-assignments/booking/${bookingId}`).then((r) => r.data),

  checkAvailability: (bookingId: string, workerPublicId: string) =>
    api
      .get<CreativeLookup>(
        `/crew-assignments/availability/${bookingId}/${encodeURIComponent(workerPublicId)}`,
      )
      .then((r) => r.data),

  create: (payload: CreateAssignmentPayload) =>
    api.post<CrewAssignment>('/crew-assignments', payload).then((r) => r.data),

  /** @deprecated use create */
  assign: (payload: CreateAssignmentPayload) =>
    api.post<CrewAssignment>('/crew-assignments', payload).then((r) => r.data),

  respond: (id: string, status: AssignmentResponse) =>
    api
      .patch<CrewAssignment>(`/crew-assignments/${id}/respond`, { status })
      .then((r) => r.data),

  remove: (id: string) =>
    api.delete(`/crew-assignments/${id}`).then((r) => r.data),
};

export const studioApi = {
  get: () => api.get<Studio>('/studio').then((r) => r.data),

  update: (payload: UpdateStudioPayload) =>
    api.patch<Studio>('/studio', payload).then((r) => r.data),

  uploadLogo: (localUri: string) => {
    const form = new FormData();
    const filename = localUri.split('/').pop() ?? 'logo.jpg';
    const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    form.append('file', { uri: localUri, name: filename, type: mime } as any);
    return api
      .post<{ logoUrl: string }>('/studio/logo', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
};

export const teamApi = {
  get: () => api.get<Team>('/users/team').then((r) => r.data),
};

export const financeApi = {
  studioSummary: () =>
    api.get<StudioFinanceSummary>('/finance/summary').then((r) => r.data),

  myEarnings: () =>
    api.get<WorkerFinanceSummary>('/finance/worker/me').then((r) => r.data),

  clientPayments: (bookingId: string) =>
    api.get<ClientPayment[]>(`/finance/client-payments/booking/${bookingId}`).then((r) => r.data),
  addClientPayment: (payload: CreateClientPaymentPayload) =>
    api.post<ClientPayment>('/finance/client-payments', payload).then((r) => r.data),

  workerPayments: (bookingId: string) =>
    api.get<WorkerPayment[]>(`/finance/worker-payments/booking/${bookingId}`).then((r) => r.data),
  addWorkerPayment: (payload: CreateWorkerPaymentPayload) =>
    api.post<WorkerPayment>('/finance/worker-payments', payload).then((r) => r.data),

  expenses: (bookingId: string) =>
    api.get<Expense[]>(`/finance/expenses/booking/${bookingId}`).then((r) => r.data),
  studioExpenses: () =>
    api.get<Expense[]>('/finance/expenses').then((r) => r.data),
  addExpense: (payload: CreateExpensePayload) =>
    api.post<Expense>('/finance/expenses', payload).then((r) => r.data),
  deleteExpense: (id: string) =>
    api.delete(`/finance/expenses/${id}`).then((r) => r.data),
};
