import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, type KeyboardTypeOptions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  Building, Camera, Sms, Call, Global, Location, Map, DollarCircle, Clock,
} from 'iconsax-react-native';
import { useAuth } from '../../context/AuthContext';
import { studioApi } from '../../libs/endpoints';
import { config } from '../../libs/config';
import { apiErrorMessage } from '../../libs/format';
import type { Studio } from '../../types/api';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'UZS', 'RUB', 'AED', 'TRY'];
const TIMEZONES = [
  'Asia/Tashkent', 'Asia/Dubai', 'Europe/London', 'Europe/Berlin',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Asia/Tokyo', 'Asia/Singapore',
];

const TEXT_FIELDS = ['name', 'email', 'phone', 'website', 'address', 'city', 'state', 'zipCode', 'country'] as const;
type TextField = (typeof TEXT_FIELDS)[number];
type Form = Record<TextField, string> & { currency: string; timezone: string };

function toForm(s: Studio): Form {
  return {
    name: s.name ?? '',
    email: s.email ?? '',
    phone: s.phone ?? '',
    website: s.website ?? '',
    address: s.address ?? '',
    city: s.city ?? '',
    state: s.state ?? '',
    zipCode: s.zipCode ?? '',
    country: s.country ?? '',
    currency: s.currency ?? 'USD',
    timezone: s.timezone ?? '',
  };
}

function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${config.mediaBaseUrl}${path}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-white rounded-3xl border border-gray-100 p-5 mb-4">
      <Text className="text-sm font-bold text-gray-900 mb-4">{title}</Text>
      {children}
    </View>
  );
}

function Field({
  label, value, onChangeText, placeholder, icon: Icon, keyboardType, autoCapitalize, last,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  icon?: React.ComponentType<{ size: number; color: string }>;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'words' | 'sentences';
  last?: boolean;
}) {
  return (
    <View className={last ? '' : 'mb-4'}>
      <View className="flex-row items-center gap-1.5 mb-1.5">
        {Icon && <Icon size={13} color="#9ca3af" />}
        <Text className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor="#9ca3af"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'words'}
        autoCorrect={false}
        returnKeyType="done"
        className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm"
      />
    </View>
  );
}

function Chips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {options.map((o) => (
        <TouchableOpacity
          key={o}
          onPress={() => onChange(o)}
          className={`mr-2 px-3 py-2 rounded-xl border ${value === o ? 'bg-black border-black' : 'bg-gray-50 border-gray-200'}`}
        >
          <Text className={`text-xs font-medium ${value === o ? 'text-white' : 'text-gray-700'}`}>{o}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

export default function StudioEditScreen() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [studio, setStudio] = useState<Studio | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    studioApi.get()
      .then((s) => { setStudio(s); setForm(toForm(s)); })
      .catch((e) => setLoadError(apiErrorMessage(e, 'Could not load studio')));
  }, []);

  const dirty = useMemo(() => {
    if (!studio || !form) return false;
    const initial = toForm(studio);
    return (Object.keys(form) as Array<keyof Form>).some((k) => form[k].trim() !== initial[k].trim());
  }, [studio, form]);

  const set = (key: keyof Form) => (v: string) => setForm((f) => (f ? { ...f, [key]: v } : f));

  const pickLogo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingLogo(true);
    try {
      const { logoUrl } = await studioApi.uploadLogo(result.assets[0].uri);
      setStudio((s) => (s ? { ...s, logoUrl } : s));
    } catch (e) {
      Alert.alert('Upload failed', apiErrorMessage(e, 'Could not upload logo. Please try again.'));
    } finally {
      setUploadingLogo(false);
    }
  };

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) {
      Alert.alert('Studio name required', 'Please enter a name for your studio.');
      return;
    }
    setSaving(true);
    try {
      const payload = Object.fromEntries(
        (Object.keys(form) as Array<keyof Form>).map((k) => [k, form[k].trim() || null]),
      );
      const updated = await studioApi.update(payload);
      setStudio(updated);
      setForm(toForm(updated));
      await refresh();
      router.back();
    } catch (e) {
      Alert.alert('Error', apiErrorMessage(e, 'Could not save studio. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  if (!form || !studio) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center p-6">
        {loadError ? (
          <Text className="text-sm text-gray-500 text-center">{loadError}</Text>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    );
  }

  const logo = mediaUrl(studio.logoUrl);
  const initials = form.name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'S';

  return (
    <KeyboardAvoidingView className="flex-1 bg-gray-50" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        {/* Logo */}
        <View className="items-center mb-6">
          <TouchableOpacity onPress={pickLogo} disabled={uploadingLogo} activeOpacity={0.8}>
            {logo ? (
              <Image source={{ uri: logo }} style={{ width: 96, height: 96, borderRadius: 24 }} contentFit="cover" />
            ) : (
              <View style={{ width: 96, height: 96, borderRadius: 24, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' }}>
                <Text className="text-white text-3xl font-bold">{initials}</Text>
              </View>
            )}
            <View
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white border-2 border-gray-100 items-center justify-center"
              style={{ shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 }}
            >
              {uploadingLogo ? <ActivityIndicator size="small" color="#374151" /> : <Camera size={15} color="#374151" />}
            </View>
          </TouchableOpacity>
          <Text className="text-xs text-gray-400 mt-3">Tap to change logo</Text>
        </View>

        <Section title="Studio">
          <Field label="Studio name" value={form.name} onChangeText={set('name')} icon={Building} last />
        </Section>

        <Section title="Contact">
          <Field label="Email" value={form.email} onChangeText={set('email')} icon={Sms} keyboardType="email-address" autoCapitalize="none" placeholder="hello@studio.com" />
          <Field label="Phone" value={form.phone} onChangeText={set('phone')} icon={Call} keyboardType="phone-pad" placeholder="+998 90 123 45 67" />
          <Field label="Website" value={form.website} onChangeText={set('website')} icon={Global} keyboardType="url" autoCapitalize="none" placeholder="studio.com" last />
        </Section>

        <Section title="Location">
          <Field label="Address" value={form.address} onChangeText={set('address')} icon={Location} placeholder="Street and building" />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label="City" value={form.city} onChangeText={set('city')} placeholder="Tashkent" />
            </View>
            <View className="flex-1">
              <Field label="State / Region" value={form.state} onChangeText={set('state')} placeholder="Region" />
            </View>
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label="ZIP" value={form.zipCode} onChangeText={set('zipCode')} keyboardType="number-pad" placeholder="100000" last />
            </View>
            <View className="flex-1">
              <Field label="Country" value={form.country} onChangeText={set('country')} icon={Map} placeholder="Uzbekistan" last />
            </View>
          </View>
        </Section>

        <Section title="Preferences">
          <View className="flex-row items-center gap-1.5 mb-2">
            <DollarCircle size={13} color="#9ca3af" />
            <Text className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Currency</Text>
          </View>
          <View className="mb-4">
            <Chips options={CURRENCIES} value={form.currency} onChange={set('currency')} />
          </View>
          <View className="flex-row items-center gap-1.5 mb-2">
            <Clock size={13} color="#9ca3af" />
            <Text className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Timezone</Text>
          </View>
          <Chips options={TIMEZONES} value={form.timezone} onChange={set('timezone')} />
        </Section>

        <TouchableOpacity
          onPress={save}
          disabled={!dirty || saving}
          className={`py-4 rounded-2xl items-center flex-row justify-center gap-2 mt-2 ${dirty && !saving ? 'bg-black' : 'bg-gray-200'}`}
        >
          {saving && <ActivityIndicator size="small" color="#FFFFFF" />}
          <Text className={`font-bold text-base ${dirty && !saving ? 'text-white' : 'text-gray-500'}`}>
            {dirty ? 'Save changes' : 'No changes'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
