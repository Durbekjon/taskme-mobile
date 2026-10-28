import '../global.css';
import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider } from '@/context/AuthContext';
import { SocketProvider } from '@/context/SocketContext';
import { NotificationBanner } from '@/components/NotificationBanner';

SplashScreen.preventAutoHideAsync();

import { usePushNotifications } from '@/hooks/usePushNotifications';

function PushNotificationsSetup() {
  usePushNotifications();
  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <SocketProvider>
          <PushNotificationsSetup />
          <AnimatedSplashOverlay />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="auth/login" options={{ headerShown: false }} />
            <Stack.Screen
              name="booking/[id]"
              options={{
                headerShown: true,
                headerTitle: '',
                headerBackTitle: 'Back',
                headerShadowVisible: false,
                headerStyle: { backgroundColor: '#ffffff' },
                headerTintColor: '#000000',
              }}
            />
            <Stack.Screen
              name="studio/edit"
              options={{
                headerShown: true,
                headerTitle: 'Studio',
                headerBackTitle: 'Back',
                headerShadowVisible: false,
                headerStyle: { backgroundColor: '#f9fafb' },
                headerTintColor: '#000000',
              }}
            />
            <Stack.Screen name="booking/new" options={{ headerShown: false }} />
          </Stack>
          <NotificationBanner />
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
    </GestureHandlerRootView>
  );
}
