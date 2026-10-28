import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useRouter } from 'expo-router';
import { Sms, Lock, Eye, EyeSlash, VideoPlay } from 'iconsax-react-native';
import { useAuth } from '../../context/AuthContext';
import { useAuthApi } from '../../hooks/useAuthApi';

export default function LoginScreen() {
  const router = useRouter();
  const { login: authContextLogin } = useAuth();
  const { login: apiLogin, loading, error: apiError } = useAuthApi();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      // The API returns { access_token, user }; the context now loads the
      // profile from /auth/me rather than trusting a `user` field that the
      // login response did not always carry.
      const { access_token } = await apiLogin({ email, password });
      await authContextLogin(access_token);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Login Failed', apiError || err?.message || 'Login failed');
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <View className="flex-1 bg-white items-center justify-center p-6">
      <View className="w-full max-w-sm">
        {/* Header */}
        <View className="items-center mb-10">
          <View className="w-16 h-16 rounded-full bg-black flex items-center justify-center mb-4 shadow-sm">
            <VideoPlay color="#FFFFFF" size={28} variant="Bold" />
          </View>
          <Text className="text-3xl font-bold text-gray-900">Task.me</Text>
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-1">
            Production Studio Workspace
          </Text>
        </View>

        {/* Form */}
        <View className="space-y-4">
          <View>
            <Text className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Email
            </Text>
            <View className="relative justify-center">
              <View className="absolute left-4 z-10">
                <Sms size={20} color="#9CA3AF" variant="Linear" />
              </View>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="admin@taskme.com"
                keyboardType="email-address"
                autoCapitalize="none"
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-base text-gray-900"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          <View className="mt-4">
            <Text className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Password
            </Text>
            <View className="relative justify-center">
              <View className="absolute left-4 z-10">
                <Lock size={20} color="#9CA3AF" variant="Linear" />
              </View>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                className="w-full pl-12 pr-12 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-base text-gray-900"
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                className="absolute right-4 z-10"
              >
                {showPassword ? (
                  <EyeSlash size={20} color="#9CA3AF" />
                ) : (
                  <Eye size={20} color="#9CA3AF" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            className="w-full mt-8 py-4 rounded-full bg-black items-center flex-row justify-center"
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text className="text-white text-base font-semibold">Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View className="flex-row items-center my-8">
          <View className="flex-1 h-[1px] bg-gray-200" />
          <Text className="mx-4 text-xs font-semibold text-gray-400 tracking-wider">OR</Text>
          <View className="flex-1 h-[1px] bg-gray-200" />
        </View>

        {/* Google Placeholder (Assuming OAuth requires web-browser later) */}
        <TouchableOpacity
          className="w-full py-4 px-6 rounded-full bg-white border border-gray-200 flex-row items-center justify-center"
          onPress={() => Alert.alert('Notice', 'Google Sign-In coming soon to mobile')}
        >
          <Text className="text-gray-800 text-base font-semibold ml-2">Sign in with Google</Text>
        </TouchableOpacity>
      </View>
    </View>
    </TouchableWithoutFeedback>
  );
}
