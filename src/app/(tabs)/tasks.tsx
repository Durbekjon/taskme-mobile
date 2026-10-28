import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import {
  TickCircle, CloseCircle, Clock, Location, Sms, Calendar,
} from 'iconsax-react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { useAssignments } from '../../hooks/useAssignments';
import { isPendingAssignment, localClock, localDate, money } from '../../libs/format';
import { useSocket } from '../../context/SocketContext';
import { AssignmentStatus, type WorkerAssignment } from '../../types/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeLabel(iso: string | null): string | null {
  if (!iso) return null;
  const diff = new Date(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  const days = Math.round(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 1) return `In ${days} days`;
  return `${Math.abs(days)} days ago`;
}

// ---------------------------------------------------------------------------
// Job card
// ---------------------------------------------------------------------------

function JobCard({
  job,
  onAccept,
  onDecline,
  busy,
  accent,
}: {
  job: WorkerAssignment;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  busy: boolean;
  accent?: string;
}) {
  const router = useRouter();
  const isPending = job.status === AssignmentStatus.ASSIGNED;
  const isCompleted = job.status === AssignmentStatus.COMPLETED;
  const rel = relativeLabel(job.startAt);
  const callClock = localClock(job.callTime ?? null);
  const startClock = localClock(job.startAt);
  const endClock = localClock(job.endAt ?? null);

  return (
    <TouchableOpacity
      onPress={() => !isPending && router.push(`/booking/${job.bookingId}` as any)}
      activeOpacity={isPending ? 1 : 0.7}
      className={`bg-white rounded-3xl border border-gray-100 mb-3 overflow-hidden ${accent || ''}`}
    >
      {/* Left accent bar */}
      {accent ? <View className={`absolute left-0 top-0 bottom-0 w-1 ${accent}`} /> : null}

      <View className="p-4 pl-5">
        {/* Title + fee */}
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1 pr-3">
            <Text className="font-bold text-gray-900 text-base" numberOfLines={1}>
              {job.title || 'Booking'}
            </Text>
            {job.studio && (
              <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
                {job.studio.name}{job.role ? ` · ${job.role}` : ''}
              </Text>
            )}
          </View>
          {job.fee != null && (
            <Text className="font-bold text-gray-900 text-base">{money(job.fee)}</Text>
          )}
        </View>

        {/* Date + time */}
        <View className="flex-row flex-wrap gap-x-4 gap-y-1 mb-2">
          {job.startAt && (
            <View className="flex-row items-center gap-1.5">
              <Calendar size={13} color="#9ca3af" />
              <Text className="text-xs text-gray-600 font-medium">
                {localDate(job.startAt)}
              </Text>
              {rel && (
                <Text className={`text-xs font-bold ${rel === 'Today' ? 'text-black' : rel === 'Tomorrow' ? 'text-amber-600' : 'text-gray-400'}`}>
                  · {rel}
                </Text>
              )}
            </View>
          )}
          {startClock && (
            <View className="flex-row items-center gap-1">
              <Clock size={13} color="#9ca3af" />
              <Text className="text-xs text-gray-600">
                {startClock}{endClock ? ` – ${endClock}` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Call time */}
        {callClock && (
          <View className="flex-row items-center gap-1.5 bg-indigo-50 self-start px-2.5 py-1 rounded-xl mb-2">
            <Clock size={12} color="#4338ca" />
            <Text className="text-xs font-bold text-indigo-700">Call: {callClock}</Text>
          </View>
        )}

        {/* Location */}
        {job.location && (
          <View className="flex-row items-center gap-1.5 mb-2">
            <Location size={13} color="#9ca3af" />
            <Text className="text-xs text-gray-500 flex-1" numberOfLines={1}>{job.location}</Text>
          </View>
        )}

        {/* Notes */}
        {job.notes && (
          <View className="flex-row items-start gap-1.5 mb-2">
            <Sms size={13} color="#9ca3af" className="mt-0.5" />
            <Text className="text-xs text-gray-500 flex-1" numberOfLines={2}>{job.notes}</Text>
          </View>
        )}

        {/* Status badge (non-pending) */}
        {!isPending && (
          <View className={`self-start px-2.5 py-0.5 rounded-full mt-1 ${
            isCompleted ? 'bg-emerald-100' : 'bg-blue-100'
          }`}>
            <Text className={`text-[10px] font-bold uppercase tracking-wider ${
              isCompleted ? 'text-emerald-700' : 'text-blue-700'
            }`}>
              {isCompleted ? 'Completed' : 'Confirmed'}
            </Text>
          </View>
        )}

        {/* Accept / Decline (pending only) */}
        {isPending && onAccept && onDecline && (
          <View className="flex-row gap-2 mt-2">
            <TouchableOpacity
              disabled={busy}
              onPress={() => onAccept(job.id)}
              className="flex-1 py-2.5 rounded-2xl bg-black items-center justify-center flex-row gap-1.5"
              style={{ opacity: busy ? 0.5 : 1 }}
            >
              <TickCircle size={14} color="#fff" />
              <Text className="text-white font-bold text-xs">Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={busy}
              onPress={() => onDecline(job.id)}
              className="flex-1 py-2.5 rounded-2xl bg-gray-100 items-center justify-center flex-row gap-1.5"
              style={{ opacity: busy ? 0.5 : 1 }}
            >
              <CloseCircle size={14} color="#374151" />
              <Text className="text-gray-700 font-bold text-xs">Decline</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

function Section({
  title,
  count,
  dotColor,
  children,
  defaultOpen = true,
}: {
  title: string;
  count: number;
  dotColor: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View className="mb-6">
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center gap-2 mb-3"
      >
        <View className={`w-2 h-2 rounded-full ${dotColor}`} />
        <Text className="font-bold text-gray-900 text-sm">{title}</Text>
        <View className="bg-gray-100 px-2 py-0.5 rounded-full">
          <Text className="text-[11px] font-bold text-gray-500">{count}</Text>
        </View>
        <Text className="ml-auto text-gray-400 text-xs">{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && <View>{children}</View>}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TasksScreen() {
  const { assignments, loading, fetchAssignments, accept, decline } = useAssignments();
  const { on } = useSocket();
  const [busyId, setBusyId] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const load = useCallback(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    fetchAssignments()
      .catch(() => {})
      .finally(() => { loadingRef.current = false; });
  }, [fetchAssignments]);

  // Refresh when this tab gains focus (catches missed socket events, tab switches)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Real-time updates: refresh on any relevant socket event
  useEffect(() => {
    const unsub1 = on('notification', () => load());
    const unsub2 = on('assignment_updated', () => load());
    return () => {
      unsub1();
      unsub2();
    };
  }, [on, load]);

  const respond = async (id: string, action: (id: string) => Promise<any>, msg: string) => {
    setBusyId(id);
    try {
      await action(id);
      Alert.alert('', msg);
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const now = Date.now();
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const todayEnd = new Date().setHours(23, 59, 59, 999);
  const weekEnd = todayStart + 7 * 86_400_000;

  const { pending, today, thisWeek, later, past, done } = useMemo(() => {
    const pending: WorkerAssignment[] = [];
    const today: WorkerAssignment[] = [];
    const thisWeek: WorkerAssignment[] = [];
    const later: WorkerAssignment[] = [];
    const past: WorkerAssignment[] = [];
    const done: WorkerAssignment[] = [];

    for (const a of (Array.isArray(assignments) ? assignments : [])) {
      if (isPendingAssignment(a.status)) { pending.push(a); continue; }
      if (a.status === AssignmentStatus.COMPLETED) { done.push(a); continue; }
      if (a.status === AssignmentStatus.DECLINED) continue;
      const ts = a.startAt ? new Date(a.startAt).getTime() : null;
      if (!ts) { today.push(a); continue; }
      if (ts < todayStart) { past.push(a); continue; }
      if (ts <= todayEnd) { today.push(a); continue; }
      if (ts <= weekEnd) { thisWeek.push(a); continue; }
      later.push(a);
    }

    const byDate = (a: WorkerAssignment, b: WorkerAssignment) =>
      (a.startAt ?? '').localeCompare(b.startAt ?? '');
    const byDateDesc = (a: WorkerAssignment, b: WorkerAssignment) =>
      (b.startAt ?? '').localeCompare(a.startAt ?? '');

    return {
      pending: pending.sort(byDate),
      today: today.sort(byDate),
      thisWeek: thisWeek.sort(byDate),
      later: later.sort(byDate),
      past: past.sort(byDateDesc),
      done: done.sort(byDateDesc),
    };
  }, [assignments]);

  const totalActive = pending.length + today.length + thisWeek.length + later.length;

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <View className="px-4 pt-16 pb-10">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <View>
            <Text className="text-2xl font-bold text-gray-900">My Jobs</Text>
            <Text className="text-xs text-gray-500 mt-0.5">
              {totalActive === 0
                ? 'No active jobs right now'
                : `${totalActive} active job${totalActive === 1 ? '' : 's'}`}
            </Text>
          </View>
        </View>

        {/* Pending invitations */}
        {pending.length > 0 && (
          <Section title="Needs your reply" count={pending.length} dotColor="bg-amber-400">
            {pending.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                accent="bg-amber-400"
                busy={busyId === job.id}
                onAccept={(id) => respond(id, accept, 'Job accepted!')}
                onDecline={(id) => respond(id, decline, 'Invitation declined.')}
              />
            ))}
          </Section>
        )}

        {/* Today */}
        <Section title="Today" count={today.length} dotColor="bg-black">
          {today.length === 0 ? (
            <Text className="text-xs text-gray-400 text-center py-3">Nothing scheduled for today</Text>
          ) : (
            today.map((job) => (
              <JobCard key={job.id} job={job} accent="bg-black" busy={busyId === job.id} />
            ))
          )}
        </Section>

        {/* This week */}
        {thisWeek.length > 0 && (
          <Section title="This week" count={thisWeek.length} dotColor="bg-indigo-400">
            {thisWeek.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                accent={job.startAt && new Date(job.startAt).getTime() - now < 2 * 86_400_000 ? 'bg-amber-400' : undefined}
                busy={busyId === job.id}
              />
            ))}
          </Section>
        )}

        {/* Later */}
        {later.length > 0 && (
          <Section title="Later" count={later.length} dotColor="bg-gray-300">
            {later.map((job) => (
              <JobCard key={job.id} job={job} busy={busyId === job.id} />
            ))}
          </Section>
        )}

        {/* Empty state */}
        {totalActive === 0 && !loading && (
          <View className="bg-white rounded-3xl p-10 items-center border border-gray-100 mt-4">
            <TickCircle size={36} color="#d1d5db" />
            <Text className="font-bold text-gray-900 mt-3">No active jobs</Text>
            <Text className="text-xs text-gray-500 text-center mt-1.5">
              Studio invitations will appear here.
            </Text>
          </View>
        )}

        {/* Past (confirmed but date already passed, not yet marked complete) */}
        {past.length > 0 && (
          <Section title="Past" count={past.length} dotColor="bg-gray-400" defaultOpen={false}>
            {past.map((job) => (
              <JobCard key={job.id} job={job} busy={busyId === job.id} />
            ))}
          </Section>
        )}

        {/* Completed */}
        {done.length > 0 && (
          <Section title="Completed" count={done.length} dotColor="bg-emerald-400" defaultOpen={false}>
            {done.map((job) => (
              <JobCard key={job.id} job={job} busy={busyId === job.id} />
            ))}
          </Section>
        )}
      </View>
    </ScrollView>
  );
}
