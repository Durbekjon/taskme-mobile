/**
 * In-app notification banner.
 *
 * Listens to WebSocket `notification` events and shows a slide-down toast at
 * the top of the screen. Auto-dismisses after 4 seconds. Tapping it also
 * dismisses it immediately.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Text,
  TouchableOpacity,
  View,
  Platform,
  StatusBar,
} from 'react-native';
import { Notification } from 'iconsax-react-native';
import { useSocket, type NotificationEvent } from '../context/SocketContext';

const TOP_OFFSET = Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight ?? 0) + 8;
const BANNER_HEIGHT = 72;
const AUTO_DISMISS_MS = 4000;

export function NotificationBanner() {
  const { on } = useSocket();
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<NotificationEvent | null>(null);
  const translateY = useRef(new Animated.Value(-BANNER_HEIGHT - TOP_OFFSET)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    Animated.timing(translateY, {
      toValue: -BANNER_HEIGHT - TOP_OFFSET,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setVisible(false));
    if (timerRef.current) clearTimeout(timerRef.current);
  }, [translateY]);

  const show = useCallback(
    (notif: NotificationEvent) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setCurrent(notif);
      setVisible(true);

      // Slide in
      Animated.spring(translateY, {
        toValue: TOP_OFFSET,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();

      // Auto-dismiss
      timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    },
    [translateY, dismiss],
  );

  useEffect(() => {
    const unsubscribe = on('notification', show);
    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [on, show]);

  if (!visible || !current) return null;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 16,
        right: 16,
        transform: [{ translateY }],
        zIndex: 9999,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={dismiss}
        style={{
          backgroundColor: '#111827',
          borderRadius: 16,
          padding: 14,
          flexDirection: 'row',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
          gap: 12,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(255,255,255,0.1)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Notification size={18} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}
            numberOfLines={1}
          >
            {current.title}
          </Text>
          <Text
            style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}
            numberOfLines={2}
          >
            {current.message}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
