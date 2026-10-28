import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert, AppState } from 'react-native';
import { Image } from 'expo-image';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../../context/AuthContext';
import { useAssignments } from '../../hooks/useAssignments';
import { Building, Calendar, Wallet, TickCircle, CloseCircle, Sms, Clock, Money, Profile2User, Add } from 'iconsax-react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useFocusEffect, useRouter } from 'expo-router';
import { bookingsApi, financeApi, teamApi } from '../../libs/endpoints';
import { isActiveAssignment, isPendingAssignment, localDate, money } from '../../libs/format';
import { AssignmentStatus } from '../../types/api';
import { useSocket } from '../../context/SocketContext';
import { config } from '../../libs/config';

function resolveAvatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${config.mediaBaseUrl}${path}`;
}

function Avatar({ user, size = 56 }: { user: any; size?: number }) {
  const imgUrl = resolveAvatarUrl(user?.avatarUrl);
  const initials = (user?.fullName || user?.email || '?')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const radius = size / 2;
  if (imgUrl) {
    return (
      <Image
        source={{ uri: imgUrl }}
        style={{ width: size, height: size, borderRadius: radius }}
        contentFit="cover"
      />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: radius }} className="bg-black items-center justify-center">
      <Text className="text-white font-bold" style={{ fontSize: size * 0.32 }}>{initials}</Text>
    </View>
  );
}

function WorkerDashboard({ user }: { user: any }) {
  const router = useRouter();
  const { assignments, loading, fetchAssignments, respondToAssignment } = useAssignments();
  const { on } = useSocket();
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeData, setFinanceData] = useState({ totalEarned: 0, totalPaid: 0, currentBalance: 0 });
  const loadingRef = useRef(false);

  const loadFinance = async () => {
    try {
      setFinanceLoading(true);
      setFinanceData(await financeApi.myEarnings());
    } catch (err) {
      console.error('Failed to load worker finance', err);
    } finally {
      setFinanceLoading(false);
    }
  };

  const loadData = useCallback(() => {
    fetchAssignments().catch(() => {});
    void loadFinance();
  }, [fetchAssignments]);

  // Refresh when this tab gains focus
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // Refresh on any socket event
  useEffect(() => {
    const u1 = on('notification', () => loadData());
    const u2 = on('assignment_updated', () => loadData());
    return () => { u1(); u2(); };
  }, [on, loadData]);

  // Refresh when app returns to foreground (catches missed socket events)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadData();
    });
    return () => sub.remove();
  }, [loadData]);

  // Refresh when a push notification is received while app is open
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => loadData());
    return () => sub.remove();
  }, [loadData]);

  const handleAcceptJob = async (assignmentId: string) => {
    try {
      await respondToAssignment(assignmentId, AssignmentStatus.CONFIRMED);
      Alert.alert('Success', 'Job Accepted!');
    } catch (err) {
      console.error('Failed to accept job', err);
    }
  };

  const handleDeclineJob = async (assignmentId: string) => {
    try {
      await respondToAssignment(assignmentId, AssignmentStatus.DECLINED);
    } catch (err) {
      console.error('Failed to decline job', err);
    }
  };

  // One enum, one comparison - the web wrote "ACCEPTED", this screen wrote
  // "confirmed", and the tasks screen looked for "ACCEPTED".
  const pendingInvitations = assignments.filter((a) => isPendingAssignment(a.status));
  const acceptedJobs = assignments.filter((a) => isActiveAssignment(a.status));

  return (
    <ScrollView 
      className="flex-1 bg-white"
      refreshControl={<RefreshControl refreshing={loading || financeLoading} onRefresh={loadData} />}
    >
      <View className="px-6 pt-16 pb-6">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-8">
          <View className="flex-row items-center flex-1">
            <View className="mr-4">
              <Avatar user={user} size={56} />
            </View>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-gray-900" numberOfLines={1}>
                {user?.fullName || user?.email || 'Welcome'}
              </Text>
              <Text className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-1" numberOfLines={1}>
                {user?.memberOfStudio?.name || user?.primaryRole || 'Creative'}
              </Text>
            </View>
          </View>
        </View>

        {/* KPIs */}
        <View className="flex-row flex-wrap justify-between mb-8">
          <View className="w-[48%] bg-gray-50 rounded-3xl p-5 mb-4 border border-gray-100">
            <Sms size={24} color="#000" className="mb-2" />
            <Text className="text-3xl font-bold">{pendingInvitations.length}</Text>
            <Text className="text-xs text-gray-500 font-semibold uppercase mt-1 tracking-wider">Pending</Text>
          </View>
          <View className="w-[48%] bg-gray-50 rounded-3xl p-5 mb-4 border border-gray-100">
            <TickCircle size={24} color="#000" className="mb-2" />
            <Text className="text-3xl font-bold">{acceptedJobs.length}</Text>
            <Text className="text-xs text-gray-500 font-semibold uppercase mt-1 tracking-wider">Accepted</Text>
          </View>
          <View className="w-full bg-black rounded-3xl p-5 border border-gray-100 flex-row items-center justify-between">
            <View>
              <Wallet size={24} color="#FFF" className="mb-2" />
              <Text className="text-3xl font-bold text-white">{money(financeData.currentBalance)}</Text>
              <Text className="text-xs text-gray-300 font-semibold uppercase mt-1 tracking-wider">Current Balance</Text>
            </View>
            <Text className="text-emerald-400 font-bold text-sm">Total Earned: {money(financeData.totalEarned)}</Text>
          </View>
        </View>

        {/* Invitations */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-lg font-bold text-gray-900">Job Invitations</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/tasks')}>
            <Text className="text-xs font-semibold text-gray-900">View All</Text>
          </TouchableOpacity>
        </View>

        {pendingInvitations.length === 0 ? (
          <View className="bg-gray-50 p-8 rounded-3xl items-center border border-gray-100">
            <TickCircle size={32} color="#10B981" variant="Bold" className="mb-2" />
            <Text className="font-bold text-gray-900">No Pending Invitations</Text>
            <Text className="text-xs text-gray-500 text-center mt-2">You are all caught up! New job offers will appear here.</Text>
          </View>
        ) : (
          pendingInvitations.map((inv, index) => {
            // The worker endpoint returns these already flattened; the card
            // used to dig for `inv.booking.studio.name`, `inv.agreedFee` and
            // `inv.assignedParts[0].eventPart.venueName`, none of which are on
            // this payload, so every field fell back to its placeholder.
            const studioName = inv.studio?.name || 'Studio';
            const category = inv.role || inv.category || 'Event Production';
            const fee = inv.fee;
            const date = localDate(inv.startAt) ?? 'TBD';
            const location = inv.location || 'Location TBD';

            // Parts this worker is assigned to
            const parts = inv.assignedParts ?? [];
            const partLabel = parts.length > 0
              ? parts.map(p => p.eventPart.customName || p.eventPart.partType || 'Event').join(', ')
              : null;
            const partStart = parts.length > 0 ? parts[0].eventPart.startAt : inv.startAt;
            const partEnd = parts.length > 0 ? parts[parts.length - 1].eventPart.endAt : inv.endAt;
            const partTime = partStart
              ? new Date(partStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
                (partEnd ? ' – ' + new Date(partEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')
              : null;

            return (
              <Animated.View
                key={inv.id}
                entering={FadeInDown.delay(index * 100)}
                exiting={FadeOutUp}
                className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm mb-4"
              >
                <View className="flex-row justify-between items-start mb-4">
                  <View className="flex-row items-center flex-1">
                    <View className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center mr-3 border border-gray-100">
                      <Building size={20} color="#9CA3AF" />
                    </View>
                    <View className="flex-1">
                      <Text className="font-bold text-gray-900 text-base">{studioName}</Text>
                      <View className="bg-gray-100 self-start px-2 py-1 rounded-md mt-1">
                        <Text className="text-[10px] font-bold text-gray-600">{category}</Text>
                      </View>
                    </View>
                  </View>
                  <Text className="text-xl font-bold text-gray-900">{money(fee)}</Text>
                </View>

                <View className="bg-gray-50 rounded-xl p-3 mb-3 border border-gray-100 gap-2">
                  <View className="flex-row gap-4">
                    <View className="flex-row items-center">
                      <Calendar size={14} color="#9CA3AF" />
                      <Text className="text-xs font-semibold text-gray-600 ml-1">{date}</Text>
                    </View>
                    <View className="flex-row items-center flex-1">
                      <Building size={14} color="#9CA3AF" />
                      <Text className="text-xs font-semibold text-gray-600 ml-1 flex-1" numberOfLines={1}>
                        {location}
                      </Text>
                    </View>
                  </View>
                  {(partLabel || partTime) && (
                    <View className="flex-row items-center gap-4 pt-1 border-t border-gray-200">
                      {partLabel && (
                        <View className="flex-row items-center flex-1">
                          <TickCircle size={14} color="#9CA3AF" />
                          <Text className="text-xs font-semibold text-gray-600 ml-1 flex-1" numberOfLines={1}>
                            {partLabel}
                          </Text>
                        </View>
                      )}
                      {partTime && (
                        <View className="flex-row items-center">
                          <Clock size={14} color="#9CA3AF" />
                          <Text className="text-xs font-semibold text-gray-600 ml-1">{partTime}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {inv.deposit != null && inv.deposit > 0 && (
                  <View className="flex-row items-center bg-emerald-50 rounded-xl px-3 py-2 mb-3 border border-emerald-100">
                    <Money size={14} color="#10B981" />
                    <Text className="text-xs font-bold text-emerald-700 ml-1">
                      Deposit: {money(inv.deposit)}
                    </Text>
                  </View>
                )}

                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => handleDeclineJob(inv.id)}
                    className="flex-1 py-3 rounded-xl border border-red-200 bg-red-50 flex-row items-center justify-center"
                  >
                    <CloseCircle size={16} color="#DC2626" />
                    <Text className="text-red-600 font-semibold ml-2 text-sm">Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleAcceptJob(inv.id)}
                    className="flex-1 py-3 rounded-xl bg-black flex-row items-center justify-center"
                  >
                    <TickCircle size={16} color="#FFFFFF" />
                    <Text className="text-white font-semibold ml-2 text-sm">Accept Job</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

function StudioDashboard({ user }: { user: any }) {
  const router = useRouter();
  const [financeData, setFinanceData] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [teamSize, setTeamSize] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    if (!user?.studioId) return;
    try {
      setLoading(true);
      const [finance, bookingList, team] = await Promise.all([
        financeApi.studioSummary(),
        bookingsApi.list(),
        teamApi.get(),
      ]);
      setFinanceData(finance);
      setBookings(bookingList);
      setTeamSize(team.active.length);
    } catch (err) {
      console.error('Failed to load studio data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.studioId]);

  const safeBookings = Array.isArray(bookings) ? bookings : [];
  const activeBookings = safeBookings.filter(
    (b) => b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS',
  );
  const draftBookings = safeBookings.filter((b) => b.status === 'DRAFT');
  const recentBookings = safeBookings.slice(0, 3);

  return (
    <ScrollView
      className="flex-1 bg-white"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
    >
      <View className="px-6 pt-16 pb-6">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-8">
          <View className="flex-row items-center flex-1">
            <View className="mr-4">
              <Avatar user={user} size={56} />
            </View>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-gray-900" numberOfLines={1}>
                {user?.fullName || user?.email || 'Studio'}
              </Text>
              <Text className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-1" numberOfLines={1}>
                {user?.studio?.name || 'Studio Dashboard'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/booking/new' as any)}
            className="flex-row items-center gap-1.5 bg-black px-3 py-2 rounded-xl ml-3"
          >
            <Add size={16} color="#FFFFFF" />
            <Text className="text-white text-xs font-semibold">New</Text>
          </TouchableOpacity>
        </View>

        {/* KPI Grid */}
        <View className="flex-row flex-wrap justify-between mb-8">
          <View className="w-[48%] bg-gray-50 rounded-3xl p-5 mb-4 border border-gray-100">
            <Wallet size={24} color="#000" />
            <Text className="text-3xl font-bold mt-2">{money(financeData?.revenue)}</Text>
            <Text className="text-xs text-gray-500 font-semibold uppercase mt-1 tracking-wider">Revenue</Text>
          </View>
          <View className="w-[48%] bg-gray-50 rounded-3xl p-5 mb-4 border border-gray-100">
            <TickCircle size={24} color="#000" />
            <Text className="text-3xl font-bold mt-2">{activeBookings.length}</Text>
            <Text className="text-xs text-gray-500 font-semibold uppercase mt-1 tracking-wider">
              Active{draftBookings.length > 0 ? ` · ${draftBookings.length} draft` : ''}
            </Text>
          </View>
          <View className="w-[48%] bg-gray-50 rounded-3xl p-5 border border-gray-100">
            <Profile2User size={24} color="#000" />
            <Text className="text-3xl font-bold mt-2">{teamSize ?? '—'}</Text>
            <Text className="text-xs text-gray-500 font-semibold uppercase mt-1 tracking-wider">Team</Text>
          </View>
          <View className="w-[48%] bg-black rounded-3xl p-5 border border-transparent">
            <Wallet size={24} color="#FFF" />
            <Text className="text-3xl font-bold text-white mt-2">{money(financeData?.studioProfit)}</Text>
            <Text className="text-xs text-gray-400 font-semibold uppercase mt-1 tracking-wider">Net Profit</Text>
          </View>
        </View>

        {/* Recent Bookings */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-lg font-bold text-gray-900">Recent Bookings</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/bookings')}>
            <Text className="text-xs font-semibold text-gray-900">View All</Text>
          </TouchableOpacity>
        </View>

        {recentBookings.length === 0 ? (
          <View className="bg-gray-50 p-8 rounded-3xl items-center border border-gray-100">
            <Text className="font-bold text-gray-900">No bookings yet</Text>
          </View>
        ) : (
          recentBookings.map((booking) => (
            <TouchableOpacity
              key={booking.id}
              onPress={() => router.push(`/booking/${booking.id}`)}
              className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-3 flex-row justify-between items-center active:opacity-70"
            >
              <View className="flex-1 pr-3">
                <Text className="font-bold text-gray-900" numberOfLines={1}>
                  {booking.title || 'Untitled'}
                </Text>
                <Text className="text-xs text-gray-500 mt-0.5">
                  {booking.eventDate
                    ? new Date(booking.eventDate).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })
                    : 'No date'}
                </Text>
              </View>
              <View className="items-end">
                <Text className="font-bold text-gray-900">{money(booking.agreedPrice)}</Text>
                <View className={`mt-1 px-2 py-0.5 rounded-full ${
                  booking.status === 'CONFIRMED' ? 'bg-green-100' :
                  booking.status === 'IN_PROGRESS' ? 'bg-amber-100' :
                  booking.status === 'DRAFT' ? 'bg-gray-100' : 'bg-gray-100'
                }`}>
                  <Text className={`text-[10px] font-semibold ${
                    booking.status === 'CONFIRMED' ? 'text-green-700' :
                    booking.status === 'IN_PROGRESS' ? 'text-amber-700' :
                    'text-gray-600'
                  }`}>
                    {booking.status}
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

export default function DashboardScreen() {
  const { user } = useAuth();
  
  if (user?.accountType === 'studio') {
    return <StudioDashboard user={user} />;
  }

  return <WorkerDashboard user={user} />;
}
