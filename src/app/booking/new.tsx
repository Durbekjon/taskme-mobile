import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, type KeyboardTypeOptions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useMonthSwipe } from '../../hooks/useMonthSwipe';
import {
  ArrowLeft2, ArrowRight2, Add, Trash, CloseCircle, Location, Calendar, Clock,
  DollarCircle, Call, User, Warning2, People,
} from 'iconsax-react-native';
import { bookingsApi } from '../../libs/endpoints';
import { localDateKey, money } from '../../libs/format';
import type { Booking } from '../../types/api';

// ─── helpers ────────────────────────────────────────────────────────────────

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_HDRS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
function pad(n: number) { return n < 10 ? `0${n}` : String(n); }
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function displayDate(iso: string) {
  const [y, mo, d] = iso.split('-').map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
}
function buildCells(year: number, month: number): Array<{ day: number; iso: string } | null> {
  const first = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ day: number; iso: string } | null> = Array(first).fill(null);
  for (let d = 1; d <= total; d++) cells.push({ day: d, iso: `${year}-${pad(month + 1)}-${pad(d)}` });
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Accepts "10", "1030", "10:30", "9:5" and returns "HH:MM", or null if it is not a time. */
function normalizeTime(raw: string): string | null {
  const s = raw.trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2})(?::?(\d{1,2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

function bookingName(b: Booking) {
  const people = b.people ?? [];
  const bride = people.find((p) => p.personType?.toLowerCase() === 'bride')?.firstName;
  const groom = people.find((p) => ['groom', 'husband'].includes(p.personType?.toLowerCase() ?? ''))?.firstName;
  if (bride && groom) return `${bride} & ${groom}`;
  return b.title || 'Untitled booking';
}

// ─── People presets ──────────────────────────────────────────────────────────

type Person = { personType: string; label: string; name: string };

const PEOPLE_PRESETS: Record<string, Array<{ personType: string; label: string }>> = {
  Wedding:    [{ personType: 'bride', label: 'Bride' }, { personType: 'groom', label: 'Groom' }],
  LoveStory:  [{ personType: 'partner1', label: 'Partner 1' }, { personType: 'partner2', label: 'Partner 2' }],
  Birthday:   [{ personType: 'birthday_person', label: 'Birthday Person' }],
  Engagement: [{ personType: 'bride', label: 'Bride' }, { personType: 'groom', label: 'Groom' }],
  Corporate:  [{ personType: 'client', label: 'Client / Contact' }],
  Other:      [],
};

const PEOPLE_STEP_TITLE: Record<string, string> = {
  Wedding:    'Bride & Groom',
  LoveStory:  'Partners',
  Birthday:   'Birthday Person',
  Engagement: 'Bride & Groom',
  Corporate:  'Contact Person',
  Other:      'People',
};

function defaultPeople(bookingType: string): Person[] {
  return (PEOPLE_PRESETS[bookingType] ?? []).map(p => ({ ...p, name: '' }));
}

// ─── Other types ─────────────────────────────────────────────────────────────

const BOOKING_TYPES: Array<{ key: string; label: string }> = [
  { key: 'Wedding', label: 'Wedding' },
  { key: 'LoveStory', label: 'Love Story' },
  { key: 'Engagement', label: 'Engagement' },
  { key: 'Birthday', label: 'Birthday' },
  { key: 'Corporate', label: 'Corporate' },
  { key: 'Other', label: 'Other' },
];
const PART_TYPES = ['Preparation', 'First Look', 'Photosession', 'Ceremony', 'Reception', 'Dinner', 'Dance', 'Party'];

type StepKey = 'calendar' | 'basic' | 'people' | 'events' | 'price';
type Part = { partType: string; startTime: string };
const FLOW: StepKey[] = ['calendar', 'basic', 'people', 'events', 'price'];

// ─── Shared building blocks ──────────────────────────────────────────────────

function Shell({ stepIndex, title, subtitle, onBack, footer, children }: {
  stepIndex: number; title: string; subtitle?: string; onBack: () => void;
  footer: React.ReactNode; children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <View className="bg-gray-50 px-5 pt-2 pb-4">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={onBack}
            hitSlop={8}
            className="w-10 h-10 rounded-full bg-white border border-gray-200 items-center justify-center"
          >
            {stepIndex === 0 ? <CloseCircle size={18} color="#111827" /> : <ArrowLeft2 size={18} color="#111827" />}
          </TouchableOpacity>
          <View className="items-center">
            <Text className="text-sm font-bold text-gray-900">New Booking</Text>
            <Text className="text-[11px] text-gray-400 font-medium mt-0.5">Step {stepIndex + 1} of {FLOW.length}</Text>
          </View>
          <View className="w-10" />
        </View>

        <View className="flex-row gap-1.5 mt-4">
          {FLOW.map((_, i) => (
            <View
              key={i}
              style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= stepIndex ? '#111827' : '#E5E7EB' }}
            />
          ))}
        </View>

        <Text className="text-[26px] font-bold text-gray-900 mt-5">{title}</Text>
        {subtitle ? <Text className="text-sm text-gray-500 mt-1">{subtitle}</Text> : null}
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          className="flex-1"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 }}
        >
          {children}
        </ScrollView>
        <View
          className="bg-white border-t border-gray-100 px-5 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          {footer}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled, loading, icon = true }: {
  label: string; onPress: () => void; disabled?: boolean; loading?: boolean; icon?: boolean;
}) {
  const off = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={off}
      activeOpacity={0.85}
      className={`h-14 rounded-2xl items-center flex-row justify-center gap-2 ${off ? 'bg-gray-200' : 'bg-black'}`}
    >
      {loading && <ActivityIndicator size="small" color="#6B7280" />}
      <Text className={`font-bold text-base ${off ? 'text-gray-500' : 'text-white'}`}>{label}</Text>
      {icon && !loading && <ArrowRight2 size={18} color={off ? '#6B7280' : '#FFFFFF'} />}
    </TouchableOpacity>
  );
}

function Card({ title, right, children }: { title?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View className="bg-white rounded-3xl border border-gray-100 p-5 mb-4">
      {title ? (
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, icon: Icon, keyboardType, prefix, onBlur, last, autoCapitalize }: {
  label?: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
  icon?: React.ComponentType<{ size: number; color: string }>; keyboardType?: KeyboardTypeOptions;
  prefix?: string; onBlur?: () => void; last?: boolean; autoCapitalize?: 'none' | 'words' | 'sentences';
}) {
  return (
    <View className={last ? '' : 'mb-4'}>
      {label ? <Text className="text-[13px] font-semibold text-gray-700 mb-2">{label}</Text> : null}
      <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 h-[52px]">
        {Icon ? <Icon size={18} color="#9CA3AF" /> : null}
        {prefix ? <Text className="text-gray-400 text-[15px] font-semibold ml-0.5">{prefix}</Text> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? 'words'}
          autoCorrect={false}
          returnKeyType="done"
          className={`flex-1 text-gray-900 text-[15px] ${Icon || prefix ? 'ml-2' : ''}`}
        />
      </View>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`mr-2 mb-2 px-3.5 py-2 rounded-full border ${active ? 'bg-black border-black' : 'bg-white border-gray-200'}`}
    >
      <Text className={`text-[13px] font-semibold ${active ? 'text-white' : 'text-gray-700'}`}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Step 1: Calendar ────────────────────────────────────────────────────────

function CalendarStep({ stepIndex, initialDate, onNext, onBack }: {
  stepIndex: number; initialDate: string; onNext: (date: string) => void; onBack: () => void;
}) {
  const today = todayIso();
  const start = initialDate ? new Date(`${initialDate}T00:00:00`) : new Date();
  const [year, setYear] = useState(start.getFullYear());
  const [month, setMonth] = useState(start.getMonth());
  const [selected, setSelected] = useState(initialDate);
  const [existing, setExisting] = useState<Booking[]>([]);

  useEffect(() => {
    bookingsApi.list().then(setExisting).catch(() => {});
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of existing) {
      if (b.status === 'CANCELLED') continue;
      const key = localDateKey(b.eventDate);
      if (!key) continue;
      map.set(key, [...(map.get(key) ?? []), b]);
    }
    return map;
  }, [existing]);

  const cells = useMemo(() => buildCells(year, month), [year, month]);
  const now = new Date();
  const atCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const { gesture, dragStyle, entering, shift } = useMonthSwipe(
    (delta) => {
      const d = new Date(year, month + delta, 1);
      setYear(d.getFullYear());
      setMonth(d.getMonth());
    },
    (delta) => !(delta < 0 && atCurrentMonth),
  );

  const clashes = selected ? byDay.get(selected) ?? [] : [];

  return (
    <Shell
      stepIndex={stepIndex}
      title="Pick the date"
      subtitle={selected ? displayDate(selected) : 'When is the event happening?'}
      onBack={onBack}
      footer={<PrimaryButton label="Continue" disabled={!selected} onPress={() => onNext(selected)} />}
    >
      <View className="bg-white rounded-3xl border border-gray-100 p-4 mb-4">
        <View className="flex-row items-center justify-between mb-3">
          <TouchableOpacity
            onPress={() => shift(-1)}
            disabled={atCurrentMonth}
            className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center"
            style={{ opacity: atCurrentMonth ? 0.35 : 1 }}
          >
            <ArrowLeft2 size={16} color="#111827" />
          </TouchableOpacity>
          <Text className="text-base font-bold text-gray-900">{MONTHS[month]} {year}</Text>
          <TouchableOpacity onPress={() => shift(1)} className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center">
            <ArrowRight2 size={16} color="#111827" />
          </TouchableOpacity>
        </View>

        <GestureDetector gesture={gesture}>
        <View style={{ overflow: 'hidden' }}>
        <Animated.View style={dragStyle}>
        <Animated.View key={`${year}-${month}`} entering={entering}>
        <View className="flex-row">
          {DAY_HDRS.map(d => (
            <View key={d} style={{ width: '14.2857%', alignItems: 'center', paddingVertical: 6 }}>
              <Text className="text-[11px] font-semibold text-gray-400">{d}</Text>
            </View>
          ))}
        </View>

        <View className="flex-row flex-wrap">
          {cells.map((cell, i) => {
            if (!cell) return <View key={i} style={{ width: '14.2857%', height: 50 }} />;
            const isPast = cell.iso < today;
            const isToday = cell.iso === today;
            const isSelected = cell.iso === selected;
            const busy = (byDay.get(cell.iso) ?? []).length;
            return (
              <TouchableOpacity
                key={cell.iso}
                disabled={isPast}
                onPress={() => setSelected(cell.iso)}
                style={{ width: '14.2857%', height: 50, alignItems: 'center', justifyContent: 'center' }}
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
                      fontSize: 15,
                      fontWeight: isSelected || isToday ? '700' : '500',
                      color: isSelected ? '#FFFFFF' : isPast ? '#D1D5DB' : '#111827',
                    }}
                  >
                    {cell.day}
                  </Text>
                </View>
                <View style={{ height: 5, marginTop: 1, flexDirection: 'row', gap: 2 }}>
                  {!isPast && Array.from({ length: Math.min(busy, 3) }).map((_, k) => (
                    <View key={k} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#F59E0B' }} />
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

        <View className="flex-row items-center gap-4 mt-2 pt-3 border-t border-gray-100">
          <View className="flex-row items-center gap-1.5">
            <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: '#111827' }} />
            <Text className="text-[11px] text-gray-500">Today</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#F59E0B' }} />
            <Text className="text-[11px] text-gray-500">Already booked</Text>
          </View>
        </View>
      </View>

      {clashes.length > 0 && (
        <View className="flex-row bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <Warning2 size={18} color="#D97706" />
          <View className="flex-1 ml-3">
            <Text className="text-sm font-semibold text-amber-800">
              {clashes.length} {clashes.length === 1 ? 'booking' : 'bookings'} already on this day
            </Text>
            <Text className="text-xs text-amber-700 mt-0.5" numberOfLines={2}>
              {clashes.map(bookingName).join(', ')}
            </Text>
          </View>
        </View>
      )}
    </Shell>
  );
}

// ─── Step 2: Basic Details ───────────────────────────────────────────────────

function BasicStep({ stepIndex, date, bookingType, setBookingType, location, setLocation, onBack, onNext }: {
  stepIndex: number; date: string;
  bookingType: string; setBookingType: (v: string) => void;
  location: string; setLocation: (v: string) => void;
  onBack: () => void; onNext: () => void;
}) {
  return (
    <Shell
      stepIndex={stepIndex}
      title="What's the event?"
      subtitle={displayDate(date)}
      onBack={onBack}
      footer={<PrimaryButton label="Continue" onPress={onNext} />}
    >
      <Card title="Booking type">
        <View className="flex-row flex-wrap justify-between">
          {BOOKING_TYPES.map(t => {
            const active = bookingType === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => setBookingType(t.key)}
                activeOpacity={0.8}
                style={{ width: '48.5%' }}
                className={`mb-2.5 h-14 rounded-2xl border items-center justify-center ${active ? 'bg-black border-black' : 'bg-gray-50 border-gray-200'}`}
              >
                <Text className={`text-[15px] font-semibold ${active ? 'text-white' : 'text-gray-800'}`}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>
      <Card title="Location">
        <Field value={location} onChangeText={setLocation} placeholder="e.g. Grand Plaza Hotel" icon={Location} last />
      </Card>
    </Shell>
  );
}

// ─── Step 3: People ──────────────────────────────────────────────────────────

function PeopleStep({ stepIndex, date, bookingType, people, setPeople, onBack, onNext }: {
  stepIndex: number; date: string; bookingType: string;
  people: Person[]; setPeople: (v: Person[]) => void;
  onBack: () => void; onNext: () => void;
}) {
  const isOther = bookingType === 'Other';
  const title = PEOPLE_STEP_TITLE[bookingType] ?? 'People';

  const updateName = (i: number, val: string) =>
    setPeople(people.map((p, idx) => idx === i ? { ...p, name: val } : p));
  const updateLabel = (i: number, val: string) =>
    setPeople(people.map((p, idx) => idx === i ? { ...p, label: val, personType: val.toLowerCase().replace(/\s+/g, '_') } : p));
  const addPerson = () => setPeople([...people, { personType: 'person', label: '', name: '' }]);
  const removePerson = (i: number) => setPeople(people.filter((_, idx) => idx !== i));

  return (
    <Shell
      stepIndex={stepIndex}
      title={title}
      subtitle="Who is the event for? You can skip this."
      onBack={onBack}
      footer={<PrimaryButton label="Continue" onPress={onNext} />}
    >
      {isOther ? (
        <>
          {people.map((p, i) => (
            <Card
              key={i}
              title={`Person ${i + 1}`}
              right={
                <TouchableOpacity onPress={() => removePerson(i)} hitSlop={8} className="w-8 h-8 rounded-full bg-red-50 items-center justify-center">
                  <Trash size={14} color="#EF4444" />
                </TouchableOpacity>
              }
            >
              <Field label="Role" value={p.label} onChangeText={v => updateLabel(i, v)} placeholder="Host, Speaker, Birthday boy…" />
              <Field label="Full name" value={p.name} onChangeText={v => updateName(i, v)} placeholder="Full name" icon={User} last />
            </Card>
          ))}
          {people.length === 0 && (
            <View className="items-center py-8">
              <People size={28} color="#9CA3AF" />
              <Text className="text-sm text-gray-500 mt-2">No people added yet</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={addPerson}
            className="flex-row items-center justify-center gap-2 border-2 border-dashed border-gray-200 h-14 rounded-2xl bg-white"
          >
            <Add size={18} color="#374151" />
            <Text className="text-gray-700 text-sm font-semibold">Add person</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Card>
          {people.map((p, i) => (
            <Field
              key={i}
              label={p.label}
              value={p.name}
              onChangeText={v => updateName(i, v)}
              placeholder={`${p.label}'s full name`}
              icon={User}
              last={i === people.length - 1}
            />
          ))}
        </Card>
      )}
    </Shell>
  );
}

// ─── Step 4: Events ──────────────────────────────────────────────────────────

function EventsStep({ stepIndex, date, parts, setParts, onBack, onNext }: {
  stepIndex: number; date: string;
  parts: Part[]; setParts: (v: Part[]) => void;
  onBack: () => void; onNext: () => void;
}) {
  const updatePart = (i: number, field: keyof Part, val: string) =>
    setParts(parts.map((p, idx) => idx === i ? { ...p, [field]: val } : p));
  const addPart = () => setParts([...parts, { partType: '', startTime: '' }]);
  const removePart = (i: number) => setParts(parts.filter((_, idx) => idx !== i));

  const tidyTime = (i: number) => {
    const t = normalizeTime(parts[i].startTime);
    if (t !== null) updatePart(i, 'startTime', t);
  };

  const next = () => {
    const bad = parts.findIndex(p => normalizeTime(p.startTime) === null);
    if (bad >= 0) {
      Alert.alert('Check the time', `Event ${bad + 1} has a start time we can't read. Use a format like 10:00 or 18:30.`);
      return;
    }
    setParts(parts.map(p => ({ ...p, startTime: normalizeTime(p.startTime) ?? '' })));
    onNext();
  };

  return (
    <Shell
      stepIndex={stepIndex}
      title="Schedule"
      subtitle={`What happens on ${displayDate(date)}?`}
      onBack={onBack}
      footer={<PrimaryButton label="Continue" onPress={next} />}
    >
      {parts.map((part, i) => (
        <Card
          key={i}
          title={`Event ${i + 1}`}
          right={parts.length > 1 ? (
            <TouchableOpacity onPress={() => removePart(i)} hitSlop={8} className="w-8 h-8 rounded-full bg-red-50 items-center justify-center">
              <Trash size={14} color="#EF4444" />
            </TouchableOpacity>
          ) : undefined}
        >
          <View className="flex-row flex-wrap mb-2">
            {PART_TYPES.map(pt => (
              <Chip key={pt} label={pt} active={part.partType === pt} onPress={() => updatePart(i, 'partType', pt)} />
            ))}
          </View>
          {!PART_TYPES.includes(part.partType) && (
            <Field value={part.partType} onChangeText={v => updatePart(i, 'partType', v)} placeholder="Or type a custom name…" />
          )}
          <Field
            label="Starts at"
            value={part.startTime}
            onChangeText={v => updatePart(i, 'startTime', v)}
            onBlur={() => tidyTime(i)}
            placeholder="10:00"
            icon={Clock}
            keyboardType="numbers-and-punctuation"
            last
          />
        </Card>
      ))}
      <TouchableOpacity
        onPress={addPart}
        className="flex-row items-center justify-center gap-2 border-2 border-dashed border-gray-200 h-14 rounded-2xl bg-white"
      >
        <Add size={18} color="#374151" />
        <Text className="text-gray-700 text-sm font-semibold">Add another event</Text>
      </TouchableOpacity>
    </Shell>
  );
}

// ─── Step 5: Price & Contact ─────────────────────────────────────────────────

function SummaryRow({ icon: Icon, label, value }: {
  icon: React.ComponentType<{ size: number; color: string }>; label: string; value: string;
}) {
  return (
    <View className="flex-row items-center py-2">
      <Icon size={16} color="#9CA3AF" />
      <Text className="text-xs text-gray-500 ml-2 w-20">{label}</Text>
      <Text className="text-sm font-semibold text-gray-900 flex-1" numberOfLines={2}>{value}</Text>
    </View>
  );
}

function PriceStep({ stepIndex, date, bookingType, location, parts, people,
  agreedPrice, setAgreedPrice, deposit, setDeposit,
  contactName, setContactName, contactPhone, setContactPhone, onBack,
}: {
  stepIndex: number; date: string; bookingType: string; location: string;
  parts: Part[]; people: Person[];
  agreedPrice: string; setAgreedPrice: (v: string) => void;
  deposit: string; setDeposit: (v: string) => void;
  contactName: string; setContactName: (v: string) => void;
  contactPhone: string; setContactPhone: (v: string) => void;
  onBack: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const buildTitle = () => {
    const first = people.find(p => p.name.trim());
    const second = people[1]?.name?.trim();
    if (first && second) return `${first.name.trim().split(' ')[0]} & ${second.split(' ')[0]}`;
    if (first) return `${first.name.trim().split(' ')[0]}'s ${bookingType}`;
    if (contactName.trim()) return `${contactName.trim().split(' ')[0]}'s ${bookingType}`;
    return `New ${bookingType}`;
  };

  const handleSave = async () => {
    if (deposit && agreedPrice && Number(deposit) > Number(agreedPrice)) {
      Alert.alert('Check the deposit', 'The deposit is larger than the agreed price.');
      return;
    }
    try {
      setSaving(true);
      const [y, mo, d] = date.split('-').map(Number);

      const finalParts = parts
        .filter(p => p.partType.trim())
        .map((p, idx) => {
          const [h, m] = p.startTime ? p.startTime.split(':').map(Number) : [];
          return {
            partType: p.partType,
            customName: p.partType,
            // The time is entered on the device's clock, so build it locally rather than as UTC.
            startAt: p.startTime ? new Date(y, mo - 1, d, h, m).toISOString() : undefined,
            sortOrder: idx,
          };
        });

      const finalPeople: any[] = people
        .filter(p => p.name.trim())
        .map(p => {
          const [fn, ...rest] = p.name.trim().split(' ');
          return { personType: p.personType, firstName: fn, lastName: rest.join(' ') || undefined };
        });

      if (contactName.trim()) {
        const [fn, ...rest] = contactName.trim().split(' ');
        finalPeople.push({ personType: 'client', firstName: fn, lastName: rest.join(' ') || undefined, phone: contactPhone || undefined });
      }

      const booking = await bookingsApi.create({
        title: buildTitle(),
        eventType: bookingType,
        eventDate: `${date}T00:00:00.000Z`,
        location: location || undefined,
        agreedPrice: agreedPrice ? Number(agreedPrice) : undefined,
        deposit: deposit ? Number(deposit) : undefined,
        people: finalPeople.length ? finalPeople : undefined,
        parts: finalParts.length ? finalParts : undefined,
      });

      router.replace(`/booking/${booking.id}` as any);
    } catch {
      Alert.alert('Error', 'Could not create booking. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const typeLabel = BOOKING_TYPES.find(t => t.key === bookingType)?.label ?? bookingType;
  const namedParts = parts.filter(p => p.partType.trim());
  const balance = (Number(agreedPrice) || 0) - (Number(deposit) || 0);
  const digits = (v: string) => v.replace(/[^\d.]/g, '');

  return (
    <Shell
      stepIndex={stepIndex}
      title="Price & contact"
      subtitle="Last step — review and create."
      onBack={onBack}
      footer={<PrimaryButton label={saving ? 'Creating…' : 'Create booking'} onPress={handleSave} loading={saving} icon={false} />}
    >
      <Card title="Payment">
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field label="Agreed price" value={agreedPrice} onChangeText={v => setAgreedPrice(digits(v))} placeholder="0" prefix="$" keyboardType="decimal-pad" last />
          </View>
          <View className="flex-1">
            <Field label="Deposit" value={deposit} onChangeText={v => setDeposit(digits(v))} placeholder="0" prefix="$" keyboardType="decimal-pad" last />
          </View>
        </View>
        {agreedPrice ? (
          <View className="flex-row justify-between items-center mt-4 pt-4 border-t border-gray-100">
            <Text className="text-sm text-gray-500">Balance due</Text>
            <Text className={`text-base font-bold ${balance < 0 ? 'text-red-500' : 'text-gray-900'}`}>{money(balance)}</Text>
          </View>
        ) : null}
      </Card>

      <Card title="Contact">
        <Field label="Name" value={contactName} onChangeText={setContactName} placeholder="Full name" icon={User} />
        <Field label="Phone" value={contactPhone} onChangeText={setContactPhone} placeholder="+998 90 123 45 67" icon={Call} keyboardType="phone-pad" last />
      </Card>

      <Card title="Summary">
        <SummaryRow icon={Calendar} label="Date" value={displayDate(date)} />
        <SummaryRow icon={People} label="Type" value={typeLabel} />
        {location ? <SummaryRow icon={Location} label="Location" value={location} /> : null}
        {namedParts.length ? (
          <SummaryRow
            icon={Clock}
            label="Schedule"
            value={namedParts.map(p => (p.startTime ? `${p.partType} ${p.startTime}` : p.partType)).join(' · ')}
          />
        ) : null}
        {agreedPrice ? <SummaryRow icon={DollarCircle} label="Price" value={money(Number(agreedPrice))} /> : null}
      </Card>
    </Shell>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────

export default function NewBookingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const presetDate = typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date) && params.date >= todayIso()
    ? params.date : '';
  const [stepKey, setStepKey] = useState<StepKey>(presetDate ? 'basic' : 'calendar');

  const [date, setDate] = useState(presetDate);
  const [bookingType, setBookingType] = useState('Wedding');
  const [location, setLocation] = useState('');
  const [people, setPeople] = useState<Person[]>(defaultPeople('Wedding'));
  const [parts, setParts] = useState<Part[]>([{ partType: '', startTime: '' }]);
  const [agreedPrice, setAgreedPrice] = useState('');
  const [deposit, setDeposit] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const handleSetBookingType = (t: string) => {
    if (t === bookingType) return;
    setBookingType(t);
    setPeople(defaultPeople(t));
  };

  const stepIndex = FLOW.indexOf(stepKey);
  const goNext = () => { const next = FLOW[stepIndex + 1]; if (next) setStepKey(next); };
  const goBack = () => {
    if (stepIndex === 0) { router.back(); return; }
    setStepKey(FLOW[stepIndex - 1]);
  };

  const common = { stepIndex, date };

  if (stepKey === 'calendar') return (
    <CalendarStep stepIndex={stepIndex} initialDate={date} onNext={d => { setDate(d); goNext(); }} onBack={goBack} />
  );
  if (stepKey === 'basic') return (
    <BasicStep {...common}
      bookingType={bookingType} setBookingType={handleSetBookingType}
      location={location} setLocation={setLocation}
      onBack={goBack} onNext={goNext}
    />
  );
  if (stepKey === 'people') return (
    <PeopleStep {...common}
      bookingType={bookingType}
      people={people} setPeople={setPeople}
      onBack={goBack} onNext={goNext}
    />
  );
  if (stepKey === 'events') return (
    <EventsStep {...common}
      parts={parts} setParts={setParts}
      onBack={goBack} onNext={goNext}
    />
  );
  return (
    <PriceStep {...common}
      bookingType={bookingType} location={location} parts={parts} people={people}
      agreedPrice={agreedPrice} setAgreedPrice={setAgreedPrice}
      deposit={deposit} setDeposit={setDeposit}
      contactName={contactName} setContactName={setContactName}
      contactPhone={contactPhone} setContactPhone={setContactPhone}
      onBack={goBack}
    />
  );
}
