import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/theme';
import {
  Home2,
  Calendar,
  Profile2User,
  Wallet,
  Briefcase,
  TickCircle,
  ProfileCircle,
} from 'iconsax-react-native';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { user } = useAuth();
  const isStudio = user?.accountType === 'studio';

  // Both tint colors are plain strings, so the `color` handed to tabBarIcon is too
  // (RN 0.88 widens it to ColorValue, which iconsax doesn't accept).
  const tabBar = {
    tabBarActiveTintColor: colors.text,
    tabBarInactiveTintColor: '#9ca3af',
    tabBarStyle: {
      backgroundColor: colors.background,
      borderTopColor: '#f3f4f6',
    },
  };

  return (
    <Tabs screenOptions={{ headerShown: false, ...tabBar }}>
      {/* Home — visible to everyone */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home2 size={size} color={color as string} />,
        }}
      />

      {/* Studio-only */}
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          href: isStudio ? undefined : null,
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="crew"
        options={{
          title: 'Crew',
          href: isStudio ? undefined : null,
          tabBarIcon: ({ color, size }) => <Profile2User size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Finance',
          href: isStudio ? undefined : null,
          tabBarIcon: ({ color, size }) => <Wallet size={size} color={color as string} />,
        }}
      />

      {/* Creative-only */}
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'My Jobs',
          href: !isStudio ? undefined : null,
          tabBarIcon: ({ color, size }) => <Briefcase size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          href: !isStudio ? undefined : null,
          tabBarIcon: ({ color, size }) => <TickCircle size={size} color={color as string} />,
        }}
      />

      {/* Profile — visible to everyone, always last */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <ProfileCircle size={size} color={color as string} />,
        }}
      />

      {/* Clients tab is a placeholder — hidden from tab bar */}
      <Tabs.Screen
        name="clients"
        options={{ href: null }}
      />
    </Tabs>
  );
}
