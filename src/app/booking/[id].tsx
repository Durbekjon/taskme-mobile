import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { bookingsApi } from '../../libs/endpoints';
import type { Booking } from '../../types/api';
import { useAuth } from '../../context/AuthContext';

import { OverviewTab } from '../../components/booking/OverviewTab';
import { CrewTab } from '../../components/booking/CrewTab';
import { FinanceTab } from '../../components/booking/FinanceTab';

type TabType = 'overview' | 'crew' | 'finance';

export default function BookingDetailsScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const isStudio = user?.accountType === 'studio';
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  useEffect(() => {
    if (id) {
      bookingsApi.get(id as string)
        .then(setBooking)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!booking) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Text className="text-gray-900 font-bold">Booking not found.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title: booking.title || 'Booking Details' }} />

      <View className="px-6 pt-4 pb-2">
        <Text className="text-2xl font-bold text-gray-900 mb-2" numberOfLines={2}>
          {booking.title}
        </Text>
        <View className="bg-gray-100 self-start px-2 py-1 rounded">
          <Text className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            {booking.status}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-gray-200 mt-4 px-2">
        <TouchableOpacity
          onPress={() => setActiveTab('overview')}
          className={`flex-1 py-3 items-center border-b-2 ${activeTab === 'overview' ? 'border-black' : 'border-transparent'}`}
        >
          <Text className={`font-semibold ${activeTab === 'overview' ? 'text-black' : 'text-gray-500'}`}>Overview</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('crew')}
          className={`flex-1 py-3 items-center border-b-2 ${activeTab === 'crew' ? 'border-black' : 'border-transparent'}`}
        >
          <Text className={`font-semibold ${activeTab === 'crew' ? 'text-black' : 'text-gray-500'}`}>Crew</Text>
        </TouchableOpacity>

        {isStudio && (
          <TouchableOpacity
            onPress={() => setActiveTab('finance')}
            className={`flex-1 py-3 items-center border-b-2 ${activeTab === 'finance' ? 'border-black' : 'border-transparent'}`}
          >
            <Text className={`font-semibold ${activeTab === 'finance' ? 'text-black' : 'text-gray-500'}`}>Finance</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <View className="flex-1 bg-gray-50">
        {activeTab === 'overview' && <OverviewTab booking={booking} onUpdated={setBooking} />}
        {activeTab === 'crew' && <CrewTab bookingId={booking.id} booking={booking} />}
        {isStudio && activeTab === 'finance' && <FinanceTab booking={booking} />}
      </View>
    </View>
  );
}
