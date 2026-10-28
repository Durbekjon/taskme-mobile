import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  LogoutCurve, Edit2, TickCircle, CloseCircle,
  Sms, Building, UserTag, Location, Camera, Tag, Briefcase, ArrowRight2,
} from 'iconsax-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { usersApi } from '../../libs/endpoints';
import { config } from '../../libs/config';

const ROLES = [
  'Photographer', 'Videographer', 'Photo Editor', 'Video Editor',
  'Second Shooter', 'Drone Operator', 'Sound Engineer', 'Other',
];

function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${config.mediaBaseUrl}${path}`;
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  icon: Icon,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  icon?: React.ComponentType<{ size: number; color: string }>;
}) {
  return (
    <View className="mb-4">
      <View className="flex-row items-center gap-1.5 mb-1.5">
        {Icon && <Icon size={13} color="#9ca3af" />}
        <Text className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor="#9ca3af"
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        className={`bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm ${multiline ? 'min-h-[80px]' : ''}`}
        style={multiline ? { textAlignVertical: 'top' } : undefined}
      />
    </View>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  multiline,
}: {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  value: string | null | undefined;
  multiline?: boolean;
}) {
  if (!value) return null;
  return (
    <View className="flex-row items-start gap-3 py-3.5 border-b border-gray-100">
      <View className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center mt-0.5">
        <Icon size={18} color="#6b7280" />
      </View>
      <View className="flex-1">
        <Text className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</Text>
        <Text className={`text-sm font-medium text-gray-900 mt-0.5 ${multiline ? 'leading-5' : ''}`}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, refresh, logout } = useAuth();
  const router = useRouter();
  const isStudio = user?.accountType === 'studio';
  const isWorker = !isStudio;

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [primaryRole, setPrimaryRole] = useState('');
  const [primaryGear, setPrimaryGear] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? '');
      setLastName(user.lastName ?? '');
      setBio(user.bio ?? '');
      setPrimaryRole(user.primaryRole ?? '');
      setPrimaryGear(user.primaryGear ?? '');
      setCity(user.city ?? '');
    }
  }, [user]);

  const pickAndUploadAvatar = async () => {
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
    const uri = result.assets[0].uri;
    setUploadingAvatar(true);
    try {
      await usersApi.uploadAvatar(uri);
      await refresh();
    } catch {
      Alert.alert('Upload failed', 'Could not upload photo. Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const startEdit = () => setEditing(true);

  const cancelEdit = () => {
    setEditing(false);
    if (user) {
      setFirstName(user.firstName ?? '');
      setLastName(user.lastName ?? '');
      setBio(user.bio ?? '');
      setPrimaryRole(user.primaryRole ?? '');
      setPrimaryGear(user.primaryGear ?? '');
      setCity(user.city ?? '');
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await usersApi.updateProfile({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        bio: isWorker ? (bio.trim() || undefined) : undefined,
        primaryRole: isWorker ? (primaryRole.trim() || undefined) : undefined,
        primaryGear: isWorker ? (primaryGear.trim() || undefined) : undefined,
        city: isWorker ? (city.trim() || undefined) : undefined,
      });
      await refresh();
      setEditing(false);
    } catch {
      Alert.alert('Error', 'Could not save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);
  };

  const displayName = user?.fullName || user?.email || 'User';
  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const imgUrl = avatarUrl(user?.avatarUrl);

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView keyboardDismissMode="on-drag"
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-5 pt-16">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-2xl font-bold text-gray-900">Profile</Text>
            {!editing ? (
              <TouchableOpacity
                onPress={startEdit}
                className="flex-row items-center gap-1.5 bg-black px-4 py-2 rounded-xl"
              >
                <Edit2 size={14} color="#fff" />
                <Text className="text-white font-semibold text-sm">Edit</Text>
              </TouchableOpacity>
            ) : (
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={cancelEdit}
                  className="flex-row items-center gap-1 bg-gray-100 px-3 py-2 rounded-xl"
                >
                  <CloseCircle size={14} color="#374151" />
                  <Text className="text-gray-700 font-semibold text-sm">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={save}
                  disabled={saving}
                  className="flex-row items-center gap-1 bg-black px-3 py-2 rounded-xl"
                  style={{ opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <TickCircle size={14} color="#fff" />
                  )}
                  <Text className="text-white font-semibold text-sm">Save</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Avatar */}
          <View className="items-center mb-8">
            <TouchableOpacity
              onPress={pickAndUploadAvatar}
              disabled={uploadingAvatar}
              className="relative mb-3"
              activeOpacity={0.8}
            >
              {imgUrl ? (
                <Image
                  source={{ uri: imgUrl }}
                  style={{ width: 80, height: 80, borderRadius: 40 }}
                  contentFit="cover"
                />
              ) : (
                <View className="w-20 h-20 rounded-full bg-black items-center justify-center">
                  <Text className="text-white text-2xl font-bold">{initials}</Text>
                </View>
              )}
              {/* Camera overlay */}
              <View
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-white border-2 border-gray-100 items-center justify-center"
                style={{ shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 }}
              >
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color="#374151" />
                ) : (
                  <Camera size={14} color="#374151" />
                )}
              </View>
            </TouchableOpacity>

            {!editing && (
              <>
                <Text className="text-xl font-bold text-gray-900">{displayName}</Text>
                {isWorker && user?.primaryRole ? (
                  <Text className="text-sm text-gray-500 mt-0.5">{user.primaryRole}</Text>
                ) : null}
                <View className="mt-2 px-3 py-1 bg-gray-100 rounded-full">
                  <Text className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                    {isStudio ? 'Studio Admin' : 'Creative'}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Edit form */}
          {editing ? (
            <View className="bg-white rounded-3xl border border-gray-100 p-5 mb-6">
              <Text className="text-sm font-bold text-gray-900 mb-4">Personal Info</Text>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Field label="First name" value={firstName} onChangeText={setFirstName} placeholder="First name" />
                </View>
                <View className="flex-1">
                  <Field label="Last name" value={lastName} onChangeText={setLastName} placeholder="Last name" />
                </View>
              </View>

              {isWorker && (
                <>
                  <Text className="text-sm font-bold text-gray-900 mb-4 mt-2">Creative Profile</Text>

                  <View className="mb-4">
                    <View className="flex-row items-center gap-1.5 mb-1.5">
                      <Briefcase size={13} color="#9ca3af" />
                      <Text className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                        Primary Role
                      </Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {ROLES.map((r) => (
                        <TouchableOpacity
                          key={r}
                          onPress={() => setPrimaryRole(r)}
                          className={`mr-2 px-3 py-2 rounded-xl border ${
                            primaryRole === r ? 'bg-black border-black' : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <Text className={`text-xs font-medium ${primaryRole === r ? 'text-white' : 'text-gray-700'}`}>
                            {r}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <Field label="City" value={city} onChangeText={setCity} placeholder="e.g. Tashkent" icon={Location} />
                  <Field label="Primary Gear" value={primaryGear} onChangeText={setPrimaryGear} placeholder="e.g. Sony A7IV, DJI Mavic 3" icon={Camera} />
                  <Field label="Bio" value={bio} onChangeText={setBio} placeholder="Tell studios a bit about yourself..." multiline icon={Tag} />
                </>
              )}
            </View>
          ) : (
            <>
            {isStudio && user?.studio && (
              <TouchableOpacity
                onPress={() => router.push('/studio/edit' as any)}
                activeOpacity={0.7}
                className="flex-row items-center bg-white rounded-3xl border border-gray-100 p-4 mb-4"
              >
                <View className="w-12 h-12 rounded-2xl bg-black items-center justify-center mr-3">
                  <Building size={22} color="#FFFFFF" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold text-gray-900" numberOfLines={1}>{user.studio.name}</Text>
                  <Text className="text-xs text-gray-500 mt-0.5">Logo, contacts, location & currency</Text>
                </View>
                <ArrowRight2 size={18} color="#9ca3af" />
              </TouchableOpacity>
            )}
            <View className="bg-white rounded-3xl border border-gray-100 px-4 mb-6">
              <InfoRow icon={Sms} label="Email" value={user?.email} />
              {isWorker && (
                <>
                  {user?.memberOfStudio && <InfoRow icon={Building} label="Studio" value={user.memberOfStudio.name} />}
                  {user?.workerPublicId && <InfoRow icon={UserTag} label="Creative ID" value={user.workerPublicId} />}
                  {user?.city && <InfoRow icon={Location} label="City" value={user.city} />}
                  {user?.primaryGear && <InfoRow icon={Camera} label="Primary Gear" value={user.primaryGear} />}
                  {user?.bio && <InfoRow icon={Tag} label="Bio" value={user.bio} multiline />}
                </>
              )}
            </View>
            </>
          )}

          {/* Log out */}
          <TouchableOpacity
            onPress={handleLogout}
            className="flex-row items-center justify-center gap-2 bg-red-50 border border-red-100 py-4 rounded-2xl mb-6"
          >
            <LogoutCurve size={20} color="#ef4444" />
            <Text className="text-red-500 font-bold text-sm">Log out</Text>
          </TouchableOpacity>

          <Text className="text-center text-xs text-gray-300">Task.me</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
