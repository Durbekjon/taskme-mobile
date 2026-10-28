import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Alert,
  ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Calendar, Location, DocumentText, DollarCircle, Edit2, TickCircle, CloseCircle, ArrowLeft2, ArrowRight2 } from 'iconsax-react-native';
import type { Booking, BookingStatus as BookingStatusType } from '../../types/api';
import { BookingStatus } from '../../types/api';
import { localDate, localClock, money } from '../../libs/format';
import { useAuth } from '../../context/AuthContext';
import { bookingsApi } from '../../libs/endpoints';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STATUS_NEXT: Record<string, string[]> = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: ['DRAFT'],
};

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  DRAFT:       { bg: 'bg-gray-100',    text: 'text-gray-700' },
  CONFIRMED:   { bg: 'bg-green-100',   text: 'text-green-700' },
  IN_PROGRESS: { bg: 'bg-amber-100',   text: 'text-amber-700' },
  COMPLETED:   { bg: 'bg-blue-100',    text: 'text-blue-700' },
  CANCELLED:   { bg: 'bg-red-100',     text: 'text-red-700' },
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_HDR = ['Su','Mo','Tu','We','Th','Fr','Sa'];
function pad(n: number) { return n < 10 ? `0${n}` : String(n); }
function fmtIso(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function fmtDisplay(iso: string) {
  if (!iso) return '';
  const [y, mo, d] = iso.split('-').map(Number);
  return `${MONTHS[(mo ?? 1) - 1]} ${d}, ${y}`;
}

function buildCells(year: number, month: number) {
  const first = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = Array(first).fill(null);
  for (let i = 1; i <= total; i++) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function CalendarModal({ visible, value, onSelect, onClose }: {
  visible: boolean; value: string; onSelect: (d: string) => void; onClose: () => void;
}) {
  const now = new Date();
  const [year, setYear] = useState(() => {
    if (value) return Number(value.split('-')[0]);
    return now.getFullYear();
  });
  const [month, setMonth] = useState(() => {
    if (value) return Number(value.split('-')[1]) - 1;
    return now.getMonth();
  });
  const cells = buildCells(year, month);
  const todayIso = fmtIso(now.getFullYear(), now.getMonth(), now.getDate());
  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        <View className="flex-row justify-between items-center px-6 py-5 border-b border-gray-100">
          <Text className="text-lg font-bold text-gray-900">Select Date</Text>
          <TouchableOpacity onPress={onClose}><CloseCircle size={24} color="#6B7280" /></TouchableOpacity>
        </View>
        <View className="px-5 pt-6">
          <View className="flex-row items-center justify-between mb-6">
            <TouchableOpacity onPress={prev} className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center">
              <ArrowLeft2 size={18} color="#111827" />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-gray-900">{MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={next} className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center">
              <ArrowRight2 size={18} color="#111827" />
            </TouchableOpacity>
          </View>
          <View className="flex-row mb-2">
            {DAYS_HDR.map(d => (
              <View key={d} style={{ width: '14.28%' }} className="items-center">
                <Text className="text-xs font-semibold text-gray-400">{d}</Text>
              </View>
            ))}
          </View>
          <View className="flex-row flex-wrap">
            {cells.map((day, i) => {
              if (!day) return <View key={i} style={{ width: '14.28%', aspectRatio: 1 }} />;
              const iso = fmtIso(year, month, day);
              const isSel = iso === value;
              const isToday = iso === todayIso;
              return (
                <TouchableOpacity key={i} onPress={() => { onSelect(iso); onClose(); }}
                  style={{ width: '14.28%', aspectRatio: 1 }}
                  className={`items-center justify-center rounded-full ${isSel ? 'bg-black' : ''}`}>
                  <Text className={`text-sm font-medium ${isSel ? 'text-white' : isToday ? 'text-black font-bold' : 'text-gray-700'}`}>{day}</Text>
                  {isToday && !isSel && <View className="w-1 h-1 rounded-full bg-black absolute" style={{ bottom: 3 }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const EVENT_TYPES = ['Wedding', 'LoveStory', 'Birthday', 'Engagement', 'Corporate', 'Other'];

export function OverviewTab({ booking, onUpdated }: { booking: Booking; onUpdated?: (b: Booking) => void }) {
  const { user } = useAuth();
  const isStudio = user?.accountType === 'studio';

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const isoToLocalDate = (iso: string | null) => {
    if (!iso) return '';
    return iso.slice(0, 10);
  };

  const [editTitle, setEditTitle] = useState(booking.title ?? '');
  const [editEventType, setEditEventType] = useState(booking.eventType ?? 'Wedding');
  const [editDate, setEditDate] = useState(isoToLocalDate(booking.eventDate));
  const [editLocation, setEditLocation] = useState(booking.location ?? '');
  const [editPrice, setEditPrice] = useState(booking.agreedPrice ? String(booking.agreedPrice) : '');
  const [editNotes, setEditNotes] = useState(booking.notes ?? '');

  const openEdit = () => {
    setEditTitle(booking.title ?? '');
    setEditEventType(booking.eventType ?? 'Wedding');
    setEditDate(isoToLocalDate(booking.eventDate));
    setEditLocation(booking.location ?? '');
    setEditPrice(booking.agreedPrice ? String(booking.agreedPrice) : '');
    setEditNotes(booking.notes ?? '');
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const updated = await bookingsApi.update(booking.id, {
        title: editTitle || undefined,
        eventType: editEventType || undefined,
        eventDate: editDate ? new Date(editDate).toISOString() : undefined,
        location: editLocation || undefined,
        agreedPrice: editPrice ? Number(editPrice) : undefined,
        notes: editNotes || undefined,
      });
      setIsEditing(false);
      onUpdated?.(updated);
    } catch {
      Alert.alert('Error', 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    Alert.alert(
      'Change Status',
      `Change status to "${STATUS_LABEL[newStatus]}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setIsChangingStatus(true);
              const updated = await bookingsApi.update(booking.id, { status: newStatus as BookingStatusType });
              onUpdated?.(updated);
            } catch {
              Alert.alert('Error', 'Failed to change status');
            } finally {
              setIsChangingStatus(false);
            }
          },
        },
      ],
    );
  };

  const statusColors = STATUS_COLOR[booking.status] ?? STATUS_COLOR.DRAFT;
  const nextStatuses = STATUS_NEXT[booking.status] ?? [];
  const people = (booking as any).people ?? [];

  const INPUT_CLS = 'bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900';

  return (
    <ScrollView keyboardDismissMode="on-drag" className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Status + Edit row */}
      <View className="flex-row items-center justify-between mb-4">
        <View className={`px-3 py-1.5 rounded-full ${statusColors.bg}`}>
          <Text className={`text-xs font-bold uppercase tracking-wider ${statusColors.text}`}>
            {STATUS_LABEL[booking.status] ?? booking.status}
          </Text>
        </View>
        {isStudio && !isEditing && (
          <TouchableOpacity onPress={openEdit} className="flex-row items-center gap-1.5 bg-gray-100 px-3 py-2 rounded-xl">
            <Edit2 size={14} color="#374151" />
            <Text className="text-gray-700 text-xs font-semibold">Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Status change chips */}
      {isStudio && !isEditing && nextStatuses.length > 0 && (
        <View className="flex-row gap-2 mb-4 flex-wrap">
          {isChangingStatus ? (
            <ActivityIndicator size="small" />
          ) : (
            nextStatuses.map(s => (
              <TouchableOpacity
                key={s}
                onPress={() => handleStatusChange(s)}
                className={`px-3 py-1.5 rounded-full border ${
                  s === 'CANCELLED' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
                }`}
              >
                <Text className={`text-xs font-semibold ${s === 'CANCELLED' ? 'text-red-600' : 'text-gray-700'}`}>
                  → {STATUS_LABEL[s]}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      {/* ──────────── EDIT MODE ──────────── */}
      {isEditing && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 shadow-sm">
            <Text className="text-base font-bold text-gray-900 mb-4">Edit Booking</Text>

            <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Event Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
              {EVENT_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setEditEventType(t)}
                  className={`mr-2 px-3 py-2 rounded-xl border ${editEventType === t ? 'bg-black border-black' : 'bg-gray-50 border-gray-200'}`}
                >
                  <Text className={`text-xs font-semibold ${editEventType === t ? 'text-white' : 'text-gray-700'}`}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Event Date</Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              className={`bg-gray-50 border rounded-xl px-4 py-3 mb-3 flex-row items-center justify-between ${editDate ? 'border-black' : 'border-gray-200'}`}
            >
              <Text className={editDate ? 'text-gray-900 font-semibold' : 'text-gray-400'}>
                {editDate ? fmtDisplay(editDate) : 'Tap to pick date'}
              </Text>
              <Text>📅</Text>
            </TouchableOpacity>

            <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Title</Text>
            <TextInput value={editTitle} onChangeText={setEditTitle} placeholder="Booking title" placeholderTextColor="#9CA3AF" className={`${INPUT_CLS} mb-3`} />

            <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Location</Text>
            <TextInput value={editLocation} onChangeText={setEditLocation} placeholder="Location" placeholderTextColor="#9CA3AF" className={`${INPUT_CLS} mb-3`} />

            <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Agreed Price ($)</Text>
            <TextInput value={editPrice} onChangeText={setEditPrice} keyboardType="numeric" placeholder="0" placeholderTextColor="#9CA3AF" className={`${INPUT_CLS} mb-3`} />

            <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Notes</Text>
            <TextInput value={editNotes} onChangeText={setEditNotes} placeholder="Notes..." placeholderTextColor="#9CA3AF" multiline numberOfLines={3} textAlignVertical="top" className={`${INPUT_CLS} mb-4`} />

            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setIsEditing(false)} className="flex-1 py-3 rounded-xl bg-gray-100 items-center">
                <Text className="text-gray-700 font-semibold text-sm">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} disabled={isSaving} className={`flex-1 py-3 rounded-xl items-center flex-row justify-center gap-2 ${isSaving ? 'bg-gray-300' : 'bg-black'}`}>
                {isSaving && <ActivityIndicator size="small" color="#fff" />}
                <Text className={`font-bold text-sm ${isSaving ? 'text-gray-500' : 'text-white'}`}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ──────────── VIEW MODE ──────────── */}
      {!isEditing && (
        <>
          {/* Basic Info */}
          <View className="bg-white p-4 rounded-xl border border-gray-100 mb-4">
            <Text className="text-base font-bold text-gray-900 mb-3">Booking Info</Text>
            <View className="flex-row items-center mb-2">
              <Calendar size={18} color="#6B7280" />
              <Text className="ml-2 text-gray-700">{localDate(booking.eventDate) ?? '—'}</Text>
            </View>
            <View className="flex-row items-center mb-2">
              <DocumentText size={18} color="#6B7280" />
              <Text className="ml-2 text-gray-700 capitalize">{booking.eventType ?? '—'}</Text>
            </View>
            {!!booking.location && (
              <View className="flex-row items-center mb-2">
                <Location size={18} color="#6B7280" />
                <Text className="ml-2 text-gray-700">{booking.location}</Text>
              </View>
            )}
            {isStudio && (
              <View className="flex-row items-center">
                <DollarCircle size={18} color="#6B7280" />
                <Text className="ml-2 text-gray-700">{money(booking.agreedPrice)} agreed</Text>
              </View>
            )}
          </View>

          {/* People */}
          {people.length > 0 && (
            <View className="bg-white p-4 rounded-xl border border-gray-100 mb-4">
              <Text className="text-base font-bold text-gray-900 mb-3">People</Text>
              {people.map((p: any) => (
                <View key={p.id} className="flex-row justify-between items-center py-2 border-b border-gray-50 last:border-0">
                  <View>
                    <Text className="font-semibold text-gray-900">
                      {p.firstName}{p.lastName ? ` ${p.lastName}` : ''}
                    </Text>
                    {p.phone ? <Text className="text-xs text-gray-500 mt-0.5">{p.phone}</Text> : null}
                  </View>
                  <View className="bg-gray-100 px-2 py-0.5 rounded-md">
                    <Text className="text-xs font-semibold text-gray-600 capitalize">{p.personType}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Event Parts / Schedule */}
          <View className="bg-white p-4 rounded-xl border border-gray-100 mb-4">
            <Text className="text-base font-bold text-gray-900 mb-3">Schedule</Text>
            {booking.eventParts && booking.eventParts.length > 0 ? (
              booking.eventParts.map((part) => (
                <View key={part.id} className="mb-4 border-l-2 border-black pl-3">
                  <Text className="font-bold text-gray-900">{part.customName || part.partType || 'Event Part'}</Text>
                  {(part.startAt || part.endAt) && (
                    <View className="flex-row items-center mt-1">
                      <Calendar size={14} color="#6B7280" />
                      <Text className="text-xs text-gray-600 ml-1">
                        {localClock(part.startAt)}{part.endAt ? ` – ${localClock(part.endAt)}` : ''}
                      </Text>
                    </View>
                  )}
                  {part.venueName && (
                    <View className="flex-row items-center mt-1">
                      <Location size={14} color="#6B7280" />
                      <Text className="text-xs text-gray-600 ml-1">{part.venueName}</Text>
                    </View>
                  )}
                </View>
              ))
            ) : (
              <Text className="text-gray-400 text-sm">No schedule added.</Text>
            )}
          </View>

          {/* Notes */}
          {booking.notes && (
            <View className="bg-white p-4 rounded-xl border border-gray-100 mb-4">
              <Text className="text-base font-bold text-gray-900 mb-2">Notes</Text>
              <Text className="text-gray-700">{booking.notes}</Text>
            </View>
          )}
        </>
      )}

      <CalendarModal
        visible={showDatePicker}
        value={editDate}
        onSelect={setEditDate}
        onClose={() => setShowDatePicker(false)}
      />
    </ScrollView>
  );
}
