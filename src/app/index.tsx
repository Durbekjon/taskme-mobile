import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/auth/login" />;
  }

  // Google sign-in creates accounts without a role; they finish onboarding first.
  const onboarded = user.roles?.some((r) => r === 'ADMIN' || r === 'CREATIVE');
  return <Redirect href={onboarded ? '/(tabs)' : '/onboarding'} />;
}
