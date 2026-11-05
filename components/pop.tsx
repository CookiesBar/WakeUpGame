// Pop surfaces: an ink "plate" sits under each face, so the hard shadow is real geometry
// (works the same on iOS and Android) and a press can push the face down onto it.
import * as Haptics from 'expo-haptics';
import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { LINE, Pop } from '@/constants/pop';

const KNOB_EASE = Easing.bezier(0.23, 1, 0.32, 1);

type Haptic = 'light' | 'selection' | 'none';

const radiusOf = (style: StyleProp<ViewStyle>) => StyleSheet.flatten(style)?.borderRadius ?? 0;

export const buzz = (kind: Haptic) => {
  if (kind === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  else if (kind === 'selection') Haptics.selectionAsync().catch(() => {});
};

interface Surface {
  /** The face: background, radius, padding, layout of the children. */
  style?: StyleProp<ViewStyle>;
  /** The outer box: margins, flex, width. */
  containerStyle?: StyleProp<ViewStyle>;
  /** Height of the hard shadow. */
  depth?: number;
  children?: ReactNode;
}

export function PopView({ style, containerStyle, depth = 4, children }: Surface) {
  return (
    <View style={[{ paddingBottom: depth }, containerStyle]}>
      <View style={[styles.plate, { top: depth, borderRadius: radiusOf(style) }]} />
      <View style={[styles.face, style]}>{children}</View>
    </View>
  );
}

type ButtonProps = Surface &
  Omit<PressableProps, 'style' | 'children'> & {
    haptic?: Haptic;
  };

/** Press: the face drops onto its plate at once (feedback on touch-down), then springs back. */
export function PopButton({ style, containerStyle, depth = 4, haptic = 'light', children, onPressIn, onPressOut, ...rest }: ButtonProps) {
  const down = useSharedValue(0);
  const face = useAnimatedStyle(() => ({ transform: [{ translateY: down.value * (depth - 1) }] }));
  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
      onPressIn={e => {
        down.value = withTiming(1, { duration: 90 });
        buzz(haptic);
        onPressIn?.(e);
      }}
      onPressOut={e => {
        down.value = withSpring(0, { duration: 250, dampingRatio: 1 });
        onPressOut?.(e);
      }}
      style={[{ paddingBottom: depth }, containerStyle]}
    >
      <View style={[styles.plate, { top: depth, borderRadius: radiusOf(style) }]} />
      <Animated.View style={[styles.face, style, face]}>{children}</Animated.View>
    </Pressable>
  );
}

export function PopSwitch({
  value,
  onValueChange,
  accessibilityLabel,
  disabled,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}) {
  const on = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    on.value = withTiming(value ? 1 : 0, { duration: 260, easing: KNOB_EASE });
  }, [value, on]);
  const track = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(on.value, [0, 1], [Pop.mist, Pop.blue]) }));
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: on.value * 22 }] }));
  return (
    <Pressable
      onPress={() => {
        buzz('selection');
        onValueChange(!value);
      }}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[styles.track, track]}>
        <Animated.View style={[styles.knob, knob]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  plate: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: Pop.ink },
  face: { borderWidth: LINE, borderColor: Pop.ink, backgroundColor: Pop.white },
  track: {
    width: 54,
    height: 32,
    borderRadius: 999,
    borderWidth: LINE,
    borderColor: Pop.ink,
    padding: 2,
  },
  knob: {
    width: 23,
    height: 23,
    borderRadius: 999,
    borderWidth: LINE,
    borderColor: Pop.ink,
    backgroundColor: Pop.white,
  },
});
