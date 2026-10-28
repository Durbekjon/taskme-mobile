import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, RefreshControl, Pressable,
  TextInput, TouchableOpacity,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useMonthSwipe } from '../../hooks/useMonthSwipe';
import { useRouter } from 'expo-router';
import {
  SearchNormal1, Add, Calendar, ArrowLeft2, ArrowRight2, Calendar1, RowVertical, Location,
} from 'iconsax-react-native';
import { useAuth } from '../../context/AuthContext';
import { bookingsApi } from '../../libs/endpoints';
import { localDateKey, money } from '../../libs/format';
import { BookingStatus, type Booking } from '../../types/api';

const STATUS_LABEL: Record<BookingStatus, string> = {
  DRAFT: 'Draft',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STATUS_COLORS: Record<BookingStatus, { bg: string; text: string; dot: string }> = {
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700', dot: '#9CA3AF' },
  CONFIRMED: { bg: 'bg-green-100', text: 'text-green-700', dot: '#22C55E' },
  IN_PROGRESS: { bg: 'bg-amber-100', text: 'text-amber-700', dot: '#F59E0B' },
  COMPLETED: { bg: 'bg-blue-100', text: 'text-blue-700', dot: '#3B82F6' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-700', dot: '#EF4444' },
};

const ALL_STATUSES: Array<BookingStatus | 'ALL'> = [
  'ALL', BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS,
  BookingStatus.DRAFT, BookingStatus.COMPLETED, BookingStatus.CANCELLED,
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function pad(n: number) { return n < 10 ? `0${n}` : String(n); }
function keyOf(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function todayKey() { const d = new Date(); return keyOf(d.getFullYear(), d.getMonth(), d.getDate()); }

function monthCells(year: number, month: number): Array<{ day: number; key: string } | null> {
  const first = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ day: number; key: string } | null> = Array(first).fill(null);
  for (let d = 1; d <= total; d++) cells.push({ day: d, key: keyOf(year, month, d) });
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function prettyDay(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function getEventName(b: Booking): string {
  const people = b.people ?? [];
  const bride = people.find((p) => p.personType?.toLowerCase() === 'bride')?.firstName;
  const groom = people.find(
    (p) => p.personType?.toLowerCase() === 'groom' || p.personType?.toLowerCase() === 'husband',
  )?.firstName;
  if (bride && groom) return `${bride} & ${groom}`;
  return b.title || 'Untitled booking';
}

function BookingCard({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  const colors = STATUS_COLORS[booking.status];
  return (
    <Pressable
      onPress={onPress}
      className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm mb-4 active:opacity-70"
    >
      <View className="flex-row justify-between items-start mb-3">
        <View className={`px-2.5 py-1 rounded-full ${colors.bg}`}>
          <Text className={`text-xs font-semibold ${colors.text}`}>{STATUS_LABEL[booking.status]}</Text>
        </View>
        {booking.eventType ? (
          <View className="bg-gray-100 px-2 py-1 rounded-lg">
            <Text className="text-xs text-gray-600 font-medium">{booking.eventType}</Text>
          </View>
        ) : null}
      </View>
      <Text className="font-bold text-gray-900 text-lg mb-0.5">{getEventName(booking)}</Text>
      {booking.client && (
        <Text className="text-gray-500 text-sm mb-3">
          {booking.client.firstName} {booking.client.lastName ?? ''}
        </Text>
      )}
      <View className="flex-row justify-between items-center border-t border-gray-100 pt-3">
        <View className="flex-row items-center gap-1.5">
          <Calendar size={14} color="#9CA3AF" />
          <Text className="text-sm text-gray-600 font-medium">
            {booking.eventDate
              ? new Date(booking.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : 'No date set'}
          </Text>
        </View>
        <Text className="font-bold text-gray-900">{money(booking.agreedPrice)}</Text>
      </View>
    </Pressable>
  );
}

function AgendaRow({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  const colors = STATUS_COLORS[booking.status];
  const venue = booking.location ?? null;
  return (
    <Pressable
      onPress={onPress}
      className="flex-row bg-white rounded-2xl border border-gray-200 mb-3 overflow-hidden active:opacity-70"
    >
      <View style={{ width: 4, backgroundColor: colors.dot }} />
      <View className="flex-1 px-4 py-3.5">
        <View className="flex-row items-center justify-between">
          <Text className="font-bold text-gray-900 text-base flex-1 pr-2" numberOfLines={1}>
            {getEventName(booking)}
          </Text>
          <Text className="font-bold text-gray-900">{money(booking.agreedPrice)}</Text>
        </View>
        <View className="flex-row items-center mt-1.5 gap-2">
          <View className={`px-2 py-0.5 rounded-full ${colors.bg}`}>
            <Text className={`text-[11px] font-semibold ${colors.text}`}>{STATUS_LABEL[booking.status]}</Text>
          </View>
          {booking.eventType ? <Text className="text-xs text-gray-500">{booking.eventType}</Text> : null}
          {venue ? (
            <View className="flex-row items-center gap-1 flex-1">
              <Location size={12} color="#9CA3AF" />
              <Text className="text-xs text-gray-500 flex-1" numberOfLines={1}>{venue}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function BookingsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const isStudio = user?.accountType === 'studio';
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'ALL'>('ALL');
  const [view, setView] = useState<'calendar' | 'list'>(isStudio ? 'calendar' : 'list');

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState(todayKey());
  const today = todayKey();

  const loadBookings = useCallback(async () => {
    if (!user?.studioId) return;
    try {
      setLoading(true);
      setBookings(await bookingsApi.list());
    } catch (err) {
      console.error('Failed to load bookings', err);
    } finally {
      setLoading(false);
    }
  }, [user?.studioId]);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const filtered = useMemo(() => {
    let result = Array.isArray(bookings) ? bookings : [];
    if (statusFilter !== 'ALL') result = result.filter((b) => b.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) => (b.title ?? '').toLowerCase().includes(q) || getEventName(b).toLowerCase().includes(q),
      );
    }
    return result;
  }, [bookings, statusFilter, search]);

  const byDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of Array.isArray(bookings) ? bookings : []) {
      const key = localDateKey(b.eventDate);
      if (!key) continue;
      const list = map.get(key);
      if (list) list.push(b); else map.set(key, [b]);
    }
    return map;
  }, [bookings]);

  const cells = useMemo(() => monthCells(year, month), [year, month]);

  const monthPrefix = `${year}-${pad(month + 1)}-`;
  const monthStats = useMemo(() => {
    let count = 0;
    let revenue = 0;
    byDay.forEach((list, key) => {
      if (!key.startsWith(monthPrefix)) return;
      for (const b of list) {
        if (b.status === BookingStatus.CANCELLED) continue;
        count++;
        revenue += Number(b.agreedPrice ?? 0) || 0;
      }
    });
    return { count, revenue };
  }, [byDay, monthPrefix]);

  const { gesture: swipe, dragStyle, entering, shift: changeMonth } = useMonthSwipe((delta) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  });

  const goToday = () => {
    const d = new Date();
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelected(todayKey());
  };

  const selectedBookings = byDay.get(selected) ?? [];
  const openBooking = (id: string) => router.push(`/booking/${id}`);

  return (
    <ScrollView
      keyboardDismissMode="on-drag"
      className="flex-1 bg-white"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadBookings} />}
    >
      <View className="px-6 pt-16 pb-6">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-5">
          <Text className="text-2xl font-bold text-gray-900">Bookings</Text>
          <View className="flex-row items-center gap-2">
            {isStudio && (
              <View className="flex-row bg-gray-100 rounded-xl p-1">
                <TouchableOpacity
                  onPress={() => setView('calendar')}
                  className={`px-2.5 py-1.5 rounded-lg ${view === 'calendar' ? 'bg-white' : ''}`}
                >
                  <Calendar1 size={16} color={view === 'calendar' ? '#111827' : '#9CA3AF'} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setView('list')}
                  className={`px-2.5 py-1.5 rounded-lg ${view === 'list' ? 'bg-white' : ''}`}
                >
                  <RowVertical size={16} color={view === 'list' ? '#111827' : '#9CA3AF'} />
                </TouchableOpacity>
              </View>
            )}
            {isStudio && (
              <TouchableOpacity
                onPress={() => router.push('/booking/new' as any)}
                className="flex-row items-center gap-1.5 bg-black px-3 py-2 rounded-xl"
              >
                <Add size={16} color="#FFFFFF" />
                <Text className="text-white text-xs font-semibold">New</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {view === 'calendar' ? (
          <>
            {/* Month navigation */}
            <View className="flex-row items-center justify-between mb-1">
              <TouchableOpacity
                onPress={() => changeMonth(-1)}
                className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center"
              >
                <ArrowLeft2 size={16} color="#111827" />
              </TouchableOpacity>
              <TouchableOpacity onPress={goToday} className="items-center">
                <Text className="text-lg font-bold text-gray-900">{MONTHS[month]} {year}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => changeMonth(1)}
                className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center"
              >
                <ArrowRight2 size={16} color="#111827" />
              </TouchableOpacity>
            </View>

            <View className="flex-row items-center justify-center gap-2 mb-4">
              <Text className="text-xs text-gray-500 font-medium">
                {monthStats.count} {monthStats.count === 1 ? 'booking' : 'bookings'} · {money(monthStats.revenue)}
              </Text>
              {(selected !== today || year !== now.getFullYear() || month !== now.getMonth()) && (
                <TouchableOpacity onPress={goToday} className="px-2 py-0.5 rounded-full border border-gray-200">
                  <Text className="text-[11px] font-semibold text-gray-700">Today</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Calendar grid */}
            <GestureDetector gesture={swipe}>
            <View
              className="bg-gray-50 rounded-3xl p-3 mb-6 border border-gray-100"
              style={{ overflow: 'hidden' }}
            >
              <Animated.View style={dragStyle}>
              <Animated.View
                key={`${year}-${month}`}
                entering={entering}
              >
              <View className="flex-row mb-1">
                {WEEKDAYS.map((d) => (
                  <View key={d} style={{ width: '14.2857%', alignItems: 'center', paddingVertical: 6 }}>
                    <Text className="text-[11px] font-semibold text-gray-400">{d}</Text>
                  </View>
                ))}
              </View>
              <View className="flex-row flex-wrap">
                {cells.map((cell, i) => {
                  if (!cell) return <View key={i} style={{ width: '14.2857%', height: 52 }} />;
                  const dayBookings = byDay.get(cell.key) ?? [];
                  const isSelected = cell.key === selected;
                  const isToday = cell.key === today;
                  const isPast = cell.key < today;
                  const dots = dayBookings.slice(0, 3);
                  return (
                    <TouchableOpacity
                      key={cell.key}
                      onPress={() => setSelected(cell.key)}
                      style={{ width: '14.2857%', height: 52, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <View
                        style={{
                          width: 38, height: 38, borderRadius: 19,
                          alignItems: 'center', justifyContent: 'center',
                          backgroundColor: isSelected ? '#111827' : 'transparent',
                          borderWidth: isToday && !isSelected ? 1.5 : 0,
                          borderColor: '#111827',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: isSelected || isToday || dayBookings.length ? '700' : '500',
                            color: isSelected ? '#FFFFFF' : isPast ? '#9CA3AF' : '#111827',
                          }}
                        >
                          {cell.day}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 2, height: 5, marginTop: 2 }}>
                        {dots.map((b) => (
                          <View
                            key={b.id}
                            style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: STATUS_COLORS[b.status].dot }}
                          />
                        ))}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              </Animated.View>
              </Animated.View>
            </View>
            </GestureDetector>

            {/* Agenda for selected day */}
            <View className="flex-row items-center justify-between mb-3">
              <View>
                <Text className="text-base font-bold text-gray-900">
                  {selected === today ? 'Today' : prettyDay(selected)}
                </Text>
                {selected === today && <Text className="text-xs text-gray-500">{prettyDay(selected)}</Text>}
              </View>
              <Text className="text-xs text-gray-400 font-medium">
                {selectedBookings.length} {selectedBookings.length === 1 ? 'booking' : 'bookings'}
              </Text>
            </View>

            {selectedBookings.length === 0 ? (
              <View className="bg-gray-50 p-6 rounded-3xl items-center border border-gray-100">
                <Text className="font-semibold text-gray-900">No bookings on this day</Text>
                {selected >= today ? (
                  <TouchableOpacity
                    onPress={() => router.push(`/booking/new?date=${selected}` as any)}
                    className="mt-3 flex-row items-center gap-1.5 bg-black px-4 py-2.5 rounded-xl"
                  >
                    <Add size={16} color="#FFFFFF" />
                    <Text className="text-white text-xs font-semibold">Book this date</Text>
                  </TouchableOpacity>
                ) : (
                  <Text className="text-xs text-gray-500 mt-1">Pick another day to see its bookings.</Text>
                )}
              </View>
            ) : (
              selectedBookings.map((b) => (
                <AgendaRow key={b.id} booking={b} onPress={() => openBooking(b.id)} />
              ))
            )}

            {/* Legend */}
            <View className="flex-row flex-wrap gap-x-4 gap-y-2 mt-4">
              {(Object.keys(STATUS_LABEL) as BookingStatus[]).map((s) => (
                <View key={s} className="flex-row items-center gap-1.5">
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: STATUS_COLORS[s].dot }} />
                  <Text className="text-[11px] text-gray-500">{STATUS_LABEL[s]}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <>
            {/* Search */}
            <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 mb-4">
              <SearchNormal1 size={18} color="#9CA3AF" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search bookings..."
                placeholderTextColor="#9CA3AF"
                className="flex-1 ml-2 text-gray-900 text-sm"
              />
            </View>

            {/* Status filter chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4 -mx-1"
              contentContainerStyle={{ paddingHorizontal: 4 }}
            >
              {ALL_STATUSES.map((s) => {
                const active = statusFilter === s;
                return (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setStatusFilter(s)}
                    className={`mr-2 px-3 py-1.5 rounded-full border ${active ? 'bg-black border-black' : 'bg-white border-gray-200'}`}
                  >
                    <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-gray-600'}`}>
                      {s === 'ALL' ? 'All' : STATUS_LABEL[s]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {!loading && (
              <Text className="text-xs text-gray-400 font-medium mb-4">
                {filtered.length} {filtered.length === 1 ? 'booking' : 'bookings'}
              </Text>
            )}

            {filtered.length === 0 ? (
              <View className="bg-gray-50 p-8 rounded-3xl items-center border border-gray-100">
                <Text className="font-bold text-gray-900">No Bookings Found</Text>
                <Text className="text-xs text-gray-500 text-center mt-2">
                  {search || statusFilter !== 'ALL'
                    ? 'Try adjusting your search or filters.'
                    : 'No bookings yet. Create your first booking.'}
                </Text>
              </View>
            ) : (
              filtered.map((booking) => (
                <BookingCard key={booking.id} booking={booking} onPress={() => openBooking(booking.id)} />
              ))
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}
