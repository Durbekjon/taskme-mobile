import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, TouchableOpacity,
  Alert, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { UserAdd, User, DollarCircle, Calendar, CloseCircle, Trash } from 'iconsax-react-native';
import { crewApi, teamApi } from '../../libs/endpoints';
import type { Booking, CreativeLookup, CrewAssignment, TeamMember } from '../../types/api';
import { localClock, money, ASSIGNMENT_STATUS_LABEL } from '../../libs/format';
import { useAuth } from '../../context/AuthContext';

const ROLES = ['Photographer', 'Videographer', 'Photo Editor', 'Video Editor', 'Second Shooter', 'Other'];

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  ASSIGNED:  { bg: 'bg-amber-100',   text: 'text-amber-700' },
  CONFIRMED: { bg: 'bg-green-100',   text: 'text-green-700' },
  DECLINED:  { bg: 'bg-red-100',     text: 'text-red-700' },
  COMPLETED: { bg: 'bg-blue-100',    text: 'text-blue-700' },
};

export function CrewTab({ bookingId, booking }: { bookingId: string; booking?: Booking }) {
  const { user } = useAuth();
  const isStudio = user?.accountType === 'studio';
  const [assignments, setAssignments] = useState<CrewAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Assign modal
  const [showAssign, setShowAssign] = useState(false);
  const [lookupId, setLookupId] = useState('');
  const [lookupResult, setLookupResult] = useState<CreativeLookup | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [role, setRole] = useState('Photographer');
  const [agreedFee, setAgreedFee] = useState('');
  const [deposit, setDeposit] = useState('');
  const [selectedParts, setSelectedParts] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Team member suggestions
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAssignments = async () => {
    try {
      const data = await crewApi.listByBooking(bookingId);
      setAssignments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAssignments();
  }, [bookingId]);

  // Debounced TM-ID lookup
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!lookupId.trim()) {
      setLookupResult(null);
      setLookupError('');
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setIsLookingUp(true);
      setLookupError('');
      try {
        const result = await crewApi.checkAvailability(bookingId, lookupId.trim());
        setLookupResult(result);
      } catch {
        setLookupResult(null);
        setLookupError('Worker not found');
      } finally {
        setIsLookingUp(false);
      }
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [lookupId, bookingId]);

  // Fetch team members when modal opens
  useEffect(() => {
    if (!showAssign || !isStudio) return;
    teamApi.get().then((team) => setTeamMembers(team.active.filter((m) => m.workerPublicId)));
  }, [showAssign]);

  const resetModal = () => {
    setLookupId('');
    setLookupResult(null);
    setLookupError('');
    setRole('Photographer');
    setAgreedFee('');
    setDeposit('');
    setSelectedParts([]);
    setShowSuggestions(false);
    setShowAssign(false);
  };

  const selectTeamMember = (member: TeamMember) => {
    setLookupId(member.workerPublicId!);
    setShowSuggestions(false);
  };

  const handleAssign = async () => {
    if (!lookupResult) return;
    try {
      setIsSubmitting(true);
      const created = await crewApi.create({
        bookingId,
        workerId: lookupResult.worker.id,
        role,
        agreedFee: agreedFee ? Number(agreedFee) : undefined,
        deposit: deposit ? Number(deposit) : undefined,
        eventPartIds: selectedParts.length > 0 ? selectedParts : undefined,
      });
      setAssignments((prev) => [...prev, created]);
      resetModal();
    } catch {
      Alert.alert('Error', 'Failed to assign crew member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = (id: string) => {
    Alert.alert('Remove', 'Remove this crew member from the booking?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await crewApi.remove(id);
            setAssignments((prev) => prev.filter((a) => a.id !== id));
          } catch {
            Alert.alert('Error', 'Failed to remove crew member');
          }
        },
      },
    ]);
  };

  const togglePart = (partId: string) => {
    setSelectedParts((prev) =>
      prev.includes(partId) ? prev.filter((p) => p !== partId) : [...prev, partId],
    );
  };

  const eventParts = booking?.eventParts ?? [];

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center py-10">
        <ActivityIndicator size="small" />
      </View>
    );
  }

  return (
    <>
      <ScrollView keyboardDismissMode="on-drag" className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-xl font-bold text-gray-900">Crew</Text>
          {isStudio && (
            <TouchableOpacity
              onPress={() => setShowAssign(true)}
              className="bg-black px-4 py-2 rounded-xl flex-row items-center gap-2"
            >
              <UserAdd size={16} color="#FFFFFF" />
              <Text className="text-white font-semibold text-sm">Assign</Text>
            </TouchableOpacity>
          )}
        </View>

        {(() => {
          // Workers only see confirmed/completed crew; studios see everyone
          const visible = isStudio
            ? assignments
            : assignments.filter((a) => a.status === 'CONFIRMED' || a.status === 'COMPLETED');

          if (visible.length === 0) {
            return (
              <View className="bg-gray-50 p-8 rounded-3xl items-center border border-gray-100">
                <User size={32} color="#9CA3AF" />
                <Text className="font-bold text-gray-900 mt-2">No crew assigned</Text>
                {isStudio && (
                  <Text className="text-xs text-gray-500 text-center mt-1">
                    Tap Assign to add a crew member using their TM-ID.
                  </Text>
                )}
              </View>
            );
          }

          return visible.map((a) => {
            const colors = STATUS_COLOR[a.status] ?? STATUS_COLOR.ASSIGNED;
            return (
              <View
                key={a.id}
                className="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-3"
              >
                <View className="flex-row justify-between items-start">
                  <View className="flex-1 pr-3">
                    <Text className="font-bold text-gray-900">{a.worker.fullName}</Text>
                    {a.role ? (
                      <Text className="text-xs text-gray-500 mt-0.5">{a.role}</Text>
                    ) : null}
                  </View>
                  {isStudio && (
                    <View className={`px-2 py-0.5 rounded-full ${colors.bg}`}>
                      <Text className={`text-[10px] font-semibold uppercase ${colors.text}`}>
                        {ASSIGNMENT_STATUS_LABEL[a.status]}
                      </Text>
                    </View>
                  )}
                </View>

                {isStudio && (
                  <View className="flex-row items-center mt-2 gap-4">
                    <View className="flex-row items-center gap-1">
                      <DollarCircle size={14} color="#9CA3AF" />
                      <Text className="text-xs text-gray-600">{money(a.agreedFee)}</Text>
                    </View>
                    {a.callTime ? (
                      <View className="flex-row items-center gap-1">
                        <Calendar size={14} color="#9CA3AF" />
                        <Text className="text-xs text-gray-600">{localClock(a.callTime)}</Text>
                      </View>
                    ) : null}
                  </View>
                )}

                {isStudio && (
                  <TouchableOpacity
                    onPress={() => handleRemove(a.id)}
                    className="mt-3 self-end p-1.5 bg-red-50 rounded-lg"
                  >
                    <Trash size={14} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            );
          });
        })()}
      </ScrollView>

      {/* Assign Modal */}
      <Modal
        visible={showAssign}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={resetModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <View className="flex-1 bg-white">
            <View className="flex-row justify-between items-center px-6 py-5 border-b border-gray-100">
              <Text className="text-lg font-bold text-gray-900">Assign Crew</Text>
              <TouchableOpacity onPress={resetModal}>
                <CloseCircle size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardDismissMode="on-drag"
              contentContainerStyle={{ padding: 20 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* TM-ID lookup */}
              <Text className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                TM-ID (e.g. TM-1234) *
              </Text>
              <View className={`bg-gray-50 border rounded-xl px-4 py-3 mb-1 flex-row items-center ${showSuggestions ? 'border-black' : 'border-gray-200'}`}>
                <TextInput
                  value={lookupId}
                  onChangeText={(v) => { setLookupId(v); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="TM-XXXX  —  or pick from team below"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="characters"
                  className="flex-1 text-gray-900"
                />
                {isLookingUp && <ActivityIndicator size="small" />}
              </View>

              {/* Team member suggestions */}
              {showSuggestions && teamMembers.length > 0 && !lookupResult && (
                <View className="border border-gray-200 rounded-xl mb-3 overflow-hidden bg-white">
                  {teamMembers
                    .filter((m) =>
                      !lookupId.trim() ||
                      m.fullName.toLowerCase().includes(lookupId.toLowerCase()) ||
                      m.workerPublicId?.toLowerCase().includes(lookupId.toLowerCase()),
                    )
                    .map((m, idx, arr) => {
                      const initials = [m.firstName, m.lastName]
                        .filter(Boolean)
                        .map((n) => n![0])
                        .join('');
                      const alreadyAssigned = assignments.some(
                        (a) => a.worker.workerPublicId === m.workerPublicId,
                      );
                      return (
                        <TouchableOpacity
                          key={m.id}
                          onPress={() => !alreadyAssigned && selectTeamMember(m)}
                          disabled={alreadyAssigned}
                          className={`flex-row items-center px-4 py-3 ${idx < arr.length - 1 ? 'border-b border-gray-100' : ''} ${alreadyAssigned ? 'opacity-40' : ''}`}
                        >
                          <View className="w-9 h-9 rounded-full bg-gray-900 items-center justify-center mr-3">
                            <Text className="text-white text-xs font-bold">{initials || '?'}</Text>
                          </View>
                          <View className="flex-1">
                            <Text className="text-sm font-semibold text-gray-900">{m.fullName}</Text>
                            <Text className="text-xs text-gray-500">{m.workerPublicId}{m.roleTitle ? ` · ${m.roleTitle}` : ''}</Text>
                          </View>
                          {alreadyAssigned && (
                            <View className="bg-gray-100 px-2 py-0.5 rounded-full">
                              <Text className="text-[10px] text-gray-500 font-semibold">Assigned</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                </View>
              )}

              {lookupError ? (
                <Text className="text-red-500 text-xs mb-3">{lookupError}</Text>
              ) : null}

              {lookupResult ? (
                <View className="bg-gray-50 border border-gray-100 rounded-xl p-3 mb-4">
                  <View className="flex-row items-center gap-2">
                    <View className="w-8 h-8 rounded-full bg-gray-900 items-center justify-center">
                      <Text className="text-white text-xs font-bold">
                        {lookupResult.worker.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="font-bold text-gray-900">{lookupResult.worker.fullName}</Text>
                      {lookupResult.worker.primaryRole ? (
                        <Text className="text-xs text-gray-500">{lookupResult.worker.primaryRole}</Text>
                      ) : null}
                    </View>
                    <View
                      className={`px-2 py-0.5 rounded-full ${
                        lookupResult.availability.status === 'AVAILABLE'
                          ? 'bg-green-100'
                          : lookupResult.availability.status === 'CONFLICT'
                            ? 'bg-red-100'
                            : 'bg-amber-100'
                      }`}
                    >
                      <Text
                        className={`text-[10px] font-semibold uppercase ${
                          lookupResult.availability.status === 'AVAILABLE'
                            ? 'text-green-700'
                            : lookupResult.availability.status === 'CONFLICT'
                              ? 'text-red-700'
                              : 'text-amber-700'
                        }`}
                      >
                        {lookupResult.availability.status}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {/* Role */}
              <Text className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                Role
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                {ROLES.map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setRole(r)}
                    className={`mr-2 px-3 py-2 rounded-xl border ${
                      role === r ? 'bg-black border-black' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <Text className={`text-xs font-medium ${role === r ? 'text-white' : 'text-gray-700'}`}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Fee + Deposit */}
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                    Agreed Fee
                  </Text>
                  <View className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                    <TextInput
                      value={agreedFee}
                      onChangeText={setAgreedFee}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#9CA3AF"
                      className="text-gray-900"
                    />
                  </View>
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                    Deposit
                  </Text>
                  <View className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                    <TextInput
                      value={deposit}
                      onChangeText={setDeposit}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#9CA3AF"
                      className="text-gray-900"
                    />
                  </View>
                </View>
              </View>

              {/* Event Parts */}
              {eventParts.length > 0 && (
                <>
                  <Text className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                    Assign to Parts
                  </Text>
                  {eventParts.map((part) => {
                    const checked = selectedParts.includes(part.id);
                    return (
                      <TouchableOpacity
                        key={part.id}
                        onPress={() => togglePart(part.id)}
                        className={`flex-row items-center p-3 rounded-xl border mb-2 ${
                          checked ? 'bg-gray-900 border-gray-900' : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <View
                          className={`w-4 h-4 rounded border mr-3 items-center justify-center ${
                            checked ? 'bg-white border-white' : 'border-gray-400'
                          }`}
                        >
                          {checked ? <View className="w-2 h-2 bg-gray-900 rounded-sm" /> : null}
                        </View>
                        <Text className={`text-sm font-medium ${checked ? 'text-white' : 'text-gray-700'}`}>
                          {part.customName || part.partType || 'Part'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}

              <View className="h-4" />

              <TouchableOpacity
                onPress={handleAssign}
                disabled={isSubmitting || !lookupResult}
                className={`py-4 rounded-2xl items-center flex-row justify-center gap-2 ${
                  isSubmitting || !lookupResult ? 'bg-gray-200' : 'bg-black'
                }`}
              >
                {isSubmitting && <ActivityIndicator size="small" color="#FFFFFF" />}
                <Text
                  className={`font-bold ${
                    isSubmitting || !lookupResult ? 'text-gray-500' : 'text-white'
                  }`}
                >
                  Assign
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
