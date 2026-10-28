import { useCallback, useMemo, useRef, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { FadeInLeft, FadeInRight, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/**
 * Horizontal swipe for month calendars: left = next month, right = previous.
 * Wrap the grid in <GestureDetector gesture={gesture}>, apply `dragStyle` to an
 * Animated.View, and key the inner grid by month with `entering` so the new month
 * slides in from the side it came from.
 */
export function useMonthSwipe(onShift: (delta: number) => void, canShift?: (delta: number) => boolean) {
  const [direction, setDirection] = useState(1);
  const dragX = useSharedValue(0);

  const latest = useRef({ onShift, canShift });
  latest.current = { onShift, canShift };

  const shift = useCallback((delta: number) => {
    if (latest.current.canShift && !latest.current.canShift(delta)) return;
    setDirection(delta);
    latest.current.onShift(delta);
  }, []);

  const gesture = useMemo(() => Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-12, 12])
    .onUpdate((e) => { dragX.value = e.translationX * 0.5; })
    .onEnd((e) => {
      const delta = e.translationX < -50 || e.velocityX < -500 ? 1
        : e.translationX > 50 || e.velocityX > 500 ? -1 : 0;
      if (delta === 0) {
        dragX.value = withSpring(0);
      } else {
        dragX.value = 0;
        scheduleOnRN(shift, delta);
      }
    }), [dragX, shift]);

  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dragX.value }] }));
  const entering = (direction > 0 ? FadeInRight : FadeInLeft).duration(220);

  return { gesture, dragStyle, entering, shift };
}
