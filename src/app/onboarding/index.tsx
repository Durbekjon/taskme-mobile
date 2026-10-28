import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthApi } from '../../hooks/useAuthApi';
import { apiErrorMessage } from '../../libs/format';
import Animated, { FadeIn, FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { ArrowRight, Check, Briefcase, Camera, Gallery } from 'iconsax-react-native';
import { useAuth } from '../../context/AuthContext';

type Role = 'STUDIO' | 'CREATIVE' | null;

export default function OnboardingScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { onboard, loading } = useAuthApi();
  
  const [step, setStep] = useState(1);
  
  const [formData, setFormData] = useState({
    whatsapp: '',
    role: null as Role,
    fullName: '',
    studioName: '',
    studioLocation: '',
    specialization: '',
    primaryGear: '',
    creativeId: '',
  });


  // Worker public IDs are "TM-######" everywhere else; "#CR-XXXXXX" could
  // never be matched by a studio typing the id into the invite box.
  const generateCreativeId = () => {
    const digits = Math.floor(100000 + Math.random() * 900000);
    setFormData(prev => ({ ...prev, creativeId: `TM-${digits}` }));
  };

  const handleNext = () => setStep(s => s + 1);

  const handleRoleSelect = (role: Role) => {
    setFormData(prev => ({ ...prev, role }));
    if (role === 'CREATIVE') generateCreativeId();
    handleNext();
  };

  const handleSubmit = async () => {
    if (!formData.role) return;
    try {
      // The form collects one "full name" field but the API takes firstName
      // and lastName; posting formData wholesale meant the name was dropped.
      const names = formData.fullName.trim().split(/\s+/).filter(Boolean);
      const { access_token } = await onboard({
        role: formData.role,
        whatsapp: formData.whatsapp,
        firstName: names[0],
        lastName: names.slice(1).join(' ') || undefined,
        ...(formData.role === 'STUDIO'
          ? {
              studioName: formData.studioName || undefined,
              studioLocation: formData.studioLocation || undefined,
            }
          : {
              specialization: formData.specialization || undefined,
              primaryGear: formData.primaryGear || undefined,
              creativeId: formData.creativeId || undefined,
            }),
      });
      await login(access_token);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Error', apiErrorMessage(err, 'Failed onboarding'));
    }
  };

  const renderStep = () => {
    if (step === 1) {
      return (
        <Animated.View entering={FadeInRight} exiting={FadeOutLeft} className="w-full">
          <Text className="text-3xl font-bold mb-2">Welcome to Task.me</Text>
          <Text className="text-gray-500 mb-8">Let's get started by connecting your WhatsApp account.</Text>

          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">WhatsApp Number</Text>
          <TextInput
            value={formData.whatsapp}
            onChangeText={v => setFormData(p => ({ ...p, whatsapp: v }))}
            placeholder="+1 234 567 8900"
            keyboardType="phone-pad"
            className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-base text-gray-900 mb-6"
          />
          <TouchableOpacity
            onPress={handleNext}
            disabled={!formData.whatsapp}
            className="w-full py-4 rounded-full bg-black flex-row items-center justify-center"
          >
            <Text className="text-white font-semibold text-base mr-2">Continue</Text>
            <ArrowRight size={20} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      );
    }

    if (step === 2) {
      return (
        <Animated.View entering={FadeInRight} exiting={FadeOutLeft} className="w-full">
          <Text className="text-3xl font-bold mb-2">Choose your path</Text>
          <Text className="text-gray-500 mb-8">How will you be using Task.me?</Text>
          
          <View className="flex-row gap-4">
            <TouchableOpacity 
              onPress={() => handleRoleSelect('STUDIO')}
              className="flex-1 bg-gray-50 p-6 rounded-3xl items-center border border-gray-200"
            >
              <View className="w-16 h-16 rounded-full bg-gray-200 items-center justify-center mb-4">
                <Briefcase size={32} color="#000" />
              </View>
              <Text className="text-lg font-bold">Studio / Admin</Text>
              <Text className="text-xs text-gray-500 mt-1 text-center">Manage projects & teams</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => handleRoleSelect('CREATIVE')}
              className="flex-1 bg-gray-50 p-6 rounded-3xl items-center border border-gray-200"
            >
              <View className="w-16 h-16 rounded-full bg-gray-200 items-center justify-center mb-4">
                <Camera size={32} color="#000" />
              </View>
              <Text className="text-lg font-bold">Creative</Text>
              <Text className="text-xs text-gray-500 mt-1 text-center">Accept assignments</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      );
    }

    if (step === 3 && formData.role === 'STUDIO') {
      return (
        <Animated.View entering={FadeInRight} exiting={FadeOutLeft} className="w-full">
          <Text className="text-3xl font-bold mb-2">Studio Details</Text>
          <Text className="text-gray-500 mb-8">Tell us a bit about your studio.</Text>
          
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Your Full Name</Text>
          <TextInput
            value={formData.fullName}
            onChangeText={v => setFormData(p => ({ ...p, fullName: v }))}
            className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl mb-4"
          />

          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Studio Name</Text>
          <TextInput
            value={formData.studioName}
            onChangeText={v => setFormData(p => ({ ...p, studioName: v }))}
            className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl mb-4"
          />

          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Location / City</Text>
          <TextInput
            value={formData.studioLocation}
            onChangeText={v => setFormData(p => ({ ...p, studioLocation: v }))}
            className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl mb-8"
          />

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading || !formData.fullName || !formData.studioName}
            className="w-full py-4 rounded-full bg-black flex-row items-center justify-center"
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Text className="text-white font-semibold text-base mr-2">Finish Setup</Text>
                <Check size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      );
    }

    if (step === 3 && formData.role === 'CREATIVE') {
      return (
        <Animated.View entering={FadeInRight} exiting={FadeOutLeft} className="w-full">
          <Text className="text-3xl font-bold mb-2">Creative Profile</Text>
          <Text className="text-gray-500 mb-8">Let studios know what you do best.</Text>
          
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Full Name</Text>
          <TextInput
            value={formData.fullName}
            onChangeText={v => setFormData(p => ({ ...p, fullName: v }))}
            className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl mb-4"
          />

          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Specialization</Text>
          <TextInput
            value={formData.specialization}
            onChangeText={v => setFormData(p => ({ ...p, specialization: v }))}
            placeholder="e.g. Videographer"
            className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl mb-4"
          />

          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Primary Gear / Equipment</Text>
          <TextInput
            value={formData.primaryGear}
            onChangeText={v => setFormData(p => ({ ...p, primaryGear: v }))}
            className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl mb-8"
          />

          <TouchableOpacity
            onPress={handleNext}
            disabled={!formData.fullName || !formData.specialization}
            className="w-full py-4 rounded-full bg-black flex-row items-center justify-center"
          >
            <Text className="text-white font-semibold text-base mr-2">Continue</Text>
            <ArrowRight size={20} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      );
    }

    if (step === 4 && formData.role === 'CREATIVE') {
      return (
        <Animated.View entering={FadeInRight} exiting={FadeOutLeft} className="w-full">
          <Text className="text-3xl font-bold mb-2">Final Touches</Text>
          <Text className="text-gray-500 mb-8">Your unique ID is generated.</Text>
          
          <View className="bg-gray-50 p-8 rounded-3xl border border-gray-200 items-center justify-center mb-8">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Your Creative ID</Text>
            <Text className="text-4xl font-bold text-black">{formData.creativeId}</Text>
          </View>

          <View className="items-center justify-center mb-8">
            <View className="w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 items-center justify-center">
              <Gallery size={24} color="#9CA3AF" />
              <Text className="text-[10px] uppercase font-semibold text-gray-400 mt-1">Upload</Text>
            </View>
            <Text className="text-xs text-gray-400 mt-2">Profile Picture (Optional)</Text>
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            className="w-full py-4 rounded-full bg-black flex-row items-center justify-center"
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Text className="text-white font-semibold text-base mr-2">Finish</Text>
                <Check size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      );
    }

    return null;
  };

  return (
    <ScrollView keyboardDismissMode="on-drag" contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' }}>
      <View className="w-full max-w-sm self-center">
        {renderStep()}
      </View>
    </ScrollView>
  );
}
