import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { UserAdd, Trash, CloseCircle } from 'iconsax-react-native';
import { useAuth } from '../../context/AuthContext';
import { bookingsApi, crewApi } from '../../libs/endpoints';
import { ASSIGNMENT_STATUS_LABEL, money } from '../../libs/format';
import type { Booking, CrewAssignment, EventPart } from '../../types/api';

const ROLES = ['Photographer', 'Videographer', 'Photo Editor', 'Video Editor', 'Second Shooter', 'Other'];

function PartCheckbox({
  part,
  checked,
  onToggle,
}: {
  part: EventPart;
  checked: boolean;
  onToggle: () => void;
}) {
  const label = part.customName || part.partType || 'Event Part';
  return (
    <TouchableOpacity
      onPress={onToggle}
      className={`flex-row items-center p-3 rounded-xl border mb-2 ${
        checked ? 'bg-black border-black' : 'bg-gray-50 border-gray-200'
      }`}
    >
      <View
        className={`w-4 h-4 rounded border mr-3 items-center justify-center ${
          checked ? 'bg-white border-white' : 'bg-white border-gray-300'
        }`}
      >
        {checked && <View className="w-2 h-2 rounded-sm bg-black" />}
      </View>
      <Text className={`text-sm font-medium flex-1 ${checked ? 'text-white' : 'text-gray-900'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function CrewScreen() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [assignments, setAssignments] = useState<CrewAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  // Booking picker modal
  const [bookingPickerOpen, setBookingPickerOpen] = useState(false);

  // Assign modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [lookupId, setLookupId] = useState('');
  const [lookupResult, setLookupResult] = useState<{ id: string; fullName: string; primaryRole: string | null } | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [workerId, setWorkerId] = useState('');
  const [role, setRole] = useState('Photographer');
  const [agreedFee, setAgreedFee] = useState('');
  const [deposit, setDeposit] = useState('');
  const [selectedParts, setSelectedParts] = useState<string[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);

  const loadBookings = useCallback(async () => {
    if (!user?.studioId) return;
    try {
      setLoading(true);
      const list = await bookingsApi.list();
      setBookings((Array.isArray(list) ? list : []).filter((b) => b.status !== 'CANCELLED'));
    } catch (err) {
      console.error('Failed to load bookings', err);
    } finally {
      setLoading(false);
    }
  }, [user?.studioId]);

  const loadAssignments = useCallback(async (bookingId: string) => {
    if (!bookingId) return;
    try {
      setAssignmentsLoading(true);
      const [crew, detail] = await Promise.all([
        crewApi.listByBooking(bookingId),
        bookingsApi.get(bookingId),
      ]);
      setAssignments(crew);
      setSelectedBooking(detail);
    } catch (err) {
      console.error('Failed to load crew', err);
    } finally {
      setAssignmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    if (selectedBookingId) void loadAssignments(selectedBookingId);
    else { setAssignments([]); setSelectedBooking(null); }
  }, [selectedBookingId, loadAssignments]);

  // Debounce lookup
  useEffect(() => {
    const id = lookupId.trim();
    if (!id || !selectedBookingId) {
      setLookupResult(null);
      setLookupError('');
      setWorkerId('');
      return;
    }
    const timer = setTimeout(async () => {
      setIsLookingUp(true);
      setLookupError('');
      setLookupResult(null);
      try {
        const res = await crewApi.checkAvailability(selectedBookingId, id);
        setLookupResult({
          id: res.worker.id,
          fullName: res.worker.fullName,
          primaryRole: res.worker.primaryRole,
        });
        setWorkerId(res.worker.id);
        if (res.worker.primaryRole) setRole(res.worker.primaryRole);
      } catch {
        setLookupError('Could not find that creative. Check the TM-ID.');
        setWorkerId('');
      } finally {
        setIsLookingUp(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [lookupId, selectedBookingId]);

  const handleAssign = async () => {
    if (!selectedBookingId || !workerId) return;
    try {
      setIsAssigning(true);
      await crewApi.create({
        bookingId: selectedBookingId,
        workerId,
        role,
        agreedFee: agreedFee ? Number(agreedFee) : undefined,
        deposit: deposit ? Number(deposit) : undefined,
        eventPartIds: selectedParts.length > 0 ? selectedParts : undefined,
      });
      await loadAssignments(selectedBookingId);
      setAssignModalOpen(false);
      setLookupId('');
      setLookupResult(null);
      setWorkerId('');
      setAgreedFee('');
      setDeposit('');
      setSelectedParts([]);
    } catch (err) {
      Alert.alert('Error', 'Failed to assign crew member');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemove = (id: string) => {
    Alert.alert('Remove Crew', 'Remove this crew member from the booking?', [
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

  const safeBookings = Array.isArray(bookings) ? bookings : [];
  const safeAssignments = Array.isArray(assignments) ? assignments : [];
  const selectedBookingLabel = safeBookings.find((b) => b.id === selectedBookingId)?.title || 'Select a booking';

  return (
    <ScrollView keyboardDismissMode="on-drag"
      className="flex-1 bg-white"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadBookings} />}
    >
      <View className="px-6 pt-16 pb-6">
        <Text className="text-2xl font-bold text-gray-900 mb-6">Crew</Text>

        {/* Booking Picker */}
        <TouchableOpacity
          onPress={() => setBookingPickerOpen(true)}
          className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 mb-6 flex-row justify-between items-center"
        >
          <Text className={`font-medium text-sm ${selectedBookingId ? 'text-gray-900' : 'text-gray-400'}`}>
            {selectedBookingLabel}
          </Text>
          <Text className="text-gray-400 text-xs">Tap to change ▾</Text>
        </TouchableOpacity>

        {/* Booking picker modal */}
        <Modal
          visible={bookingPickerOpen}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setBookingPickerOpen(false)}
        >
          <View className="flex-1 bg-white">
            <View className="flex-row justify-between items-center px-6 py-5 border-b border-gray-100">
              <Text className="text-lg font-bold text-gray-900">Select Booking</Text>
              <TouchableOpacity onPress={() => setBookingPickerOpen(false)}>
                <CloseCircle size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardDismissMode="on-drag" contentContainerStyle={{ padding: 16 }}>
              {safeBookings.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  onPress={() => { setSelectedBookingId(b.id); setBookingPickerOpen(false); }}
                  className={`p-4 rounded-2xl border mb-3 ${
                    selectedBookingId === b.id ? 'bg-black border-black' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <Text className={`font-bold ${selectedBookingId === b.id ? 'text-white' : 'text-gray-900'}`}>
                    {b.title || 'Untitled booking'}
                  </Text>
                  <Text className={`text-xs mt-1 ${selectedBookingId === b.id ? 'text-gray-300' : 'text-gray-500'}`}>
                    {b.eventType}
                    {b.eventDate ? ` · ${new Date(b.eventDate).toLocaleDateString()}` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Modal>

        {/* Assignments */}
        {selectedBookingId && (
          <>
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold text-gray-900">Assigned Crew</Text>
              <TouchableOpacity
                onPress={() => setAssignModalOpen(true)}
                className="flex-row items-center gap-1.5 bg-black px-3 py-2 rounded-xl"
              >
                <UserAdd size={16} color="#FFFFFF" />
                <Text className="text-white text-xs font-semibold">Assign</Text>
              </TouchableOpacity>
            </View>

            {assignmentsLoading ? (
              <ActivityIndicator className="my-8" />
            ) : safeAssignments.length === 0 ? (
              <View className="bg-gray-50 p-8 rounded-3xl items-center border border-gray-100 mb-4">
                <Text className="font-bold text-gray-900">No crew assigned yet</Text>
                <Text className="text-xs text-gray-500 text-center mt-2">
                  Tap "Assign" to add a crew member to this booking.
                </Text>
              </View>
            ) : (
              safeAssignments.map((a) => (
                <View
                  key={a.id}
                  className="bg-gray-50 p-4 rounded-2xl border border-gray-200 mb-3"
                >
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1 pr-3">
                      <Text className="font-bold text-gray-900">{a.worker.fullName}</Text>
                      <View className="flex-row items-center gap-2 mt-1 flex-wrap">
                        <Text className="text-sm text-gray-600">{a.role}</Text>
                        <Text className="text-gray-400">·</Text>
                        <Text className="text-sm text-gray-600">{money(a.agreedFee)}</Text>
                      </View>
                      <View className="mt-1.5 bg-gray-200 self-start px-2 py-0.5 rounded-md">
                        <Text className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          {ASSIGNMENT_STATUS_LABEL[a.status]}
                        </Text>
                      </View>
                      {(a.assignedParts?.length ?? 0) > 0 && (
                        <View className="flex-row flex-wrap gap-1 mt-2">
                          {a.assignedParts.map((ap) => (
                            <View key={ap.id} className="bg-white border border-gray-200 px-2 py-0.5 rounded-md">
                              <Text className="text-xs text-gray-600">
                                {ap.eventPart.customName || ap.eventPart.partType || 'Part'}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemove(a.id)}
                      className="p-2 rounded-lg bg-red-50"
                    >
                      <Trash size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {!selectedBookingId && !loading && (
          <View className="bg-gray-50 p-10 rounded-3xl items-center border border-gray-100">
            <Text className="font-bold text-gray-900 text-center">Select a booking above to manage crew</Text>
          </View>
        )}
      </View>

      {/* Assign Modal */}
      <Modal
        visible={assignModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAssignModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <View className="flex-1 bg-white">
            <View className="flex-row justify-between items-center px-6 py-5 border-b border-gray-100">
              <Text className="text-lg font-bold text-gray-900">New Assignment</Text>
              <TouchableOpacity onPress={() => setAssignModalOpen(false)}>
                <CloseCircle size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardDismissMode="on-drag" contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              {/* TM-ID Lookup */}
              <Text className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                Creative TM-ID *
              </Text>
              <View className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-1">
                <TextInput
                  value={lookupId}
                  onChangeText={setLookupId}
                  placeholder="Enter TM-XXXX ID..."
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  className="text-gray-900"
                />
              </View>
              {isLookingUp && (
                <Text className="text-xs text-gray-500 mb-3">Searching...</Text>
              )}
              {lookupResult && (
                <View className="bg-green-50 border border-green-100 rounded-xl px-3 py-2 mb-3">
                  <Text className="text-xs font-bold text-green-700">
                    Found: {lookupResult.fullName}
                    {lookupResult.primaryRole ? ` · ${lookupResult.primaryRole}` : ''}
                  </Text>
                </View>
              )}
              {lookupError ? (
                <Text className="text-xs text-red-600 mb-3">{lookupError}</Text>
              ) : null}

              {/* Role */}
              <Text className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 mt-4">
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
                    <Text className={`text-sm font-medium ${role === r ? 'text-white' : 'text-gray-700'}`}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Fee & Deposit */}
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                    Agreed Fee ($)
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
                    Deposit ($)
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

              {/* Event parts */}
              {(selectedBooking?.eventParts?.length ?? 0) > 0 && (
                <>
                  <Text className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 mt-2">
                    Event Parts
                  </Text>
                  {selectedBooking?.eventParts?.map((part) => (
                    <PartCheckbox
                      key={part.id}
                      part={part}
                      checked={selectedParts.includes(part.id)}
                      onToggle={() =>
                        setSelectedParts((prev) =>
                          prev.includes(part.id)
                            ? prev.filter((id) => id !== part.id)
                            : [...prev, part.id],
                        )
                      }
                    />
                  ))}
                </>
              )}

              <TouchableOpacity
                onPress={handleAssign}
                disabled={isAssigning || !workerId}
                className={`mt-6 py-4 rounded-2xl items-center flex-row justify-center gap-2 ${
                  isAssigning || !workerId ? 'bg-gray-200' : 'bg-black'
                }`}
              >
                {isAssigning && <ActivityIndicator size="small" color="#FFFFFF" />}
                <Text className={`font-bold text-sm ${isAssigning || !workerId ? 'text-gray-500' : 'text-white'}`}>
                  Assign Crew Member
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}
