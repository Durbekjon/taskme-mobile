import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Profile2User } from 'iconsax-react-native';

/**
 * The standalone clients list was removed when clients were merged into the
 * people attached to each booking. Client details are now accessible through
 * the Bookings tab.
 */
export default function ClientsScreen() {
  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-6 pt-16 pb-6 items-center">
        <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-4 mt-8">
          <Profile2User size={32} color="#9CA3AF" />
        </View>
        <Text className="text-xl font-bold text-gray-900 mb-2">Clients</Text>
        <Text className="text-sm text-gray-500 text-center leading-relaxed px-4">
          Client information is now stored inside each booking.{'\n'}Open a booking to view or edit client details.
        </Text>
      </View>
    </ScrollView>
  );
}
