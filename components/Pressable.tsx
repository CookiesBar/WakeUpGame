import { Pressable as RNPressable, type PressableProps, StyleSheet } from 'react-native';

/**
 * Pressable with built-in press feedback (dim + slight press-in), so every tap
 * answers the finger. A caller that styles `pressed` itself (style function)
 * keeps full control.
 */
export default function Pressable({ style, ...props }: PressableProps) {
  if (typeof style === 'function') return <RNPressable style={style} {...props} />;
  return <RNPressable style={({ pressed }) => [style, pressed && styles.pressed]} {...props} />;
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
});
