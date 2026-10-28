import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Wallet, TickCircle, Clock, Building } from 'iconsax-react-native';
import { useRouter } from 'expo-router';
import { crewApi, financeApi } from '../../libs/endpoints';
import { isActiveAssignment, localDateKey, money } from '../../libs/format';
import { AssignmentStatus, type WorkerAssignment, type WorkerFinanceSummary } from '../../types/api';

function StatCard({
  label,
  value,
  sub,
  dark,
  icon: Icon,
  className = '',
}: {
  label: string;
  value: string;
  sub?: string;
  dark?: boolean;
  icon: React.ComponentType<{ size: number; color: string }>;
  className?: string;
}) {
  return (
    <View
      className={`rounded-3xl p-5 border ${
        dark ? 'bg-black border-transparent' : 'bg-gray-50 border-gray-100'
      } ${className}`}
    >
      <Icon size={22} color={dark ? '#FFFFFF' : '#000000'} />
      <Text className={`text-2xl font-bold mt-2 ${dark ? 'text-white' : 'text-gray-900'}`}>
        {value}
      </Text>
      <Text className={`text-xs font-semibold uppercase tracking-wider mt-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
        {label}
      </Text>
      {sub ? (
        <Text className={`text-xs mt-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{sub}</Text>
      ) : null}
    </View>
  );
}

export default function EarningsScreen() {
  const [summary, setSummary] = useState<WorkerFinanceSummary | null>(null);
  const [assignments, setAssignments] = useState<WorkerAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const load = async () => {
    try {
      setLoading(true);
      const [earnings, jobs] = await Promise.all([
        financeApi.myEarnings(),
        crewApi.listMine(),
      ]);
      setSummary(earnings);
      setAssignments(jobs);
    } catch (err) {
      console.error('Failed to load earnings', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const billable = useMemo(
    () => (Array.isArray(assignments) ? assignments : []).filter((a) => isActiveAssignment(a.status)),
    [assignments],
  );

  const rows = useMemo(
    () =>
      billable
        .slice()
        .sort((a, b) => (b.startAt ?? '').localeCompare(a.startAt ?? ''))
        .map((a) => ({
          id: a.id,
          bookingId: a.bookingId,
          date: localDateKey(a.startAt) ?? '—',
          studio: a.studio?.name ?? 'Studio',
          job: a.title ?? 'Booking',
          amount: a.fee ?? 0,
          status: a.status === AssignmentStatus.COMPLETED ? 'paid' : 'pending',
        })),
    [billable, summary],
  );

  const byStudio = useMemo(() => {
    const totals = new Map<string, { name: string; jobs: number; amount: number }>();
    for (const job of billable) {
      const name = job.studio?.name ?? 'Studio';
      const entry = totals.get(name) ?? { name, jobs: 0, amount: 0 };
      entry.jobs += 1;
      entry.amount += job.fee ?? 0;
      totals.set(name, entry);
    }
    const all = [...totals.values()].sort((a, b) => b.amount - a.amount);
    const grandTotal = all.reduce((sum, s) => sum + s.amount, 0);
    return all.map((s) => ({
      ...s,
      share: grandTotal > 0 ? Math.round((s.amount / grandTotal) * 100) : 0,
    }));
  }, [billable]);

  const pendingCount = (Array.isArray(assignments) ? assignments : []).filter(
    (a) => a.status === AssignmentStatus.CONFIRMED,
  ).length;

  return (
    <ScrollView
      className="flex-1 bg-white"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <View className="px-6 pt-16 pb-6">
        <Text className="text-2xl font-bold text-gray-900 mb-6">Earnings</Text>

        {/* Stats */}
        <View className="flex-row gap-3 mb-3">
          <StatCard
            label="Total Earned"
            value={money(summary?.totalEarned)}
            sub={`${billable.length} job${billable.length === 1 ? '' : 's'}`}
            icon={Wallet}
            className="flex-1"
          />
          <StatCard
            label="Pending Payout"
            value={money(summary?.currentBalance)}
            sub={`${pendingCount} awaiting payment`}
            icon={Clock}
            className="flex-1"
          />
        </View>

        <StatCard
          label="Already Paid"
          value={money(summary?.totalPaid)}
          sub="Paid out by studios"
          dark
          icon={TickCircle}
          className="mb-3"
        />

        {/* By Studio */}
        {byStudio.length > 0 && (
          <>
            <Text className="text-lg font-bold text-gray-900 mt-6 mb-4">Top Studios</Text>
            {byStudio.map((studio) => (
              <View key={studio.name} className="mb-4">
                <View className="flex-row justify-between items-center mb-1.5">
                  <View className="flex-row items-center gap-2">
                    <Building size={14} color="#9CA3AF" />
                    <Text className="font-semibold text-gray-900 text-sm">{studio.name}</Text>
                  </View>
                  <Text className="font-bold text-gray-900 text-sm">{money(studio.amount)}</Text>
                </View>
                <Text className="text-xs text-gray-500 mb-1.5">
                  {studio.jobs} job{studio.jobs === 1 ? '' : 's'} · {studio.share}%
                </Text>
                <View className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <View
                    className="h-full bg-gray-900 rounded-full"
                    style={{ width: `${studio.share}%` }}
                  />
                </View>
              </View>
            ))}
          </>
        )}

        {/* Job History */}
        <Text className="text-lg font-bold text-gray-900 mt-6 mb-4">Job History</Text>

        {rows.length === 0 ? (
          <View className="bg-gray-50 p-8 rounded-3xl items-center border border-gray-100">
            <Text className="font-bold text-gray-900">No jobs yet</Text>
            <Text className="text-xs text-gray-500 text-center mt-2">
              Accepted jobs will appear here.
            </Text>
          </View>
        ) : (
          rows.map((row) => (
            <TouchableOpacity
              key={row.id}
              onPress={() => router.push(`/booking/${row.bookingId}` as any)}
              className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-3 flex-row justify-between items-start"
            >
              <View className="flex-1 pr-3">
                <Text className="font-bold text-gray-900" numberOfLines={1}>
                  {row.job}
                </Text>
                <View className="flex-row items-center gap-1.5 mt-1">
                  <Building size={12} color="#9CA3AF" />
                  <Text className="text-xs text-gray-600">{row.studio}</Text>
                </View>
                <Text className="text-xs text-gray-400 mt-0.5">{row.date}</Text>
              </View>
              <View className="items-end">
                <Text className="font-bold text-gray-900">{money(row.amount)}</Text>
                <View
                  className={`mt-1 px-2 py-0.5 rounded-full ${
                    row.status === 'paid' ? 'bg-emerald-100' : 'bg-amber-100'
                  }`}
                >
                  <Text
                    className={`text-[10px] font-semibold uppercase ${
                      row.status === 'paid' ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {row.status === 'paid' ? 'Paid' : 'Pending'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}
