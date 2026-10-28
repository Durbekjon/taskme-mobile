import { AssignmentStatus } from '../types/api';

/**
 * The API returns `firstName`/`lastName`; the clients screen rendered
 * `client.name`, which does not exist on the model and printed nothing.
 */
export function personName(
  person: { firstName?: string | null; lastName?: string | null } | null | undefined,
  fallback = '—',
): string {
  if (!person) return fallback;
  const full = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim();
  return full || fallback;
}

export function money(amount: number | string | null | undefined): string {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  if (value === null || value === undefined || Number.isNaN(value)) return '$0';
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  ASSIGNED: 'Pending',
  CONFIRMED: 'Accepted',
  DECLINED: 'Declined',
  COMPLETED: 'Completed',
};

export function isPendingAssignment(status: AssignmentStatus): boolean {
  return status === AssignmentStatus.ASSIGNED;
}

export function isActiveAssignment(status: AssignmentStatus): boolean {
  return status === AssignmentStatus.CONFIRMED || status === AssignmentStatus.COMPLETED;
}

export function apiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  const response = (error as { response?: { data?: { message?: string | string[] } } })
    ?.response;
  const message = response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string') return message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/**
 * The API ships ISO instants because it cannot know the device's timezone.
 * These render them on the device's own clock.
 */
export function localDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function localClock(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** Returns the date portion as YYYY-MM-DD in the device's local timezone. */
export function localDateKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Extracts up to 2 initials from a full name. */
export function initials(name: string, fallback = '?'): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return (parts[0][0] ?? '').toUpperCase() || fallback;
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase() || fallback;
}
