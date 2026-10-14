import { Ionicons } from '@expo/vector-icons';
import { GlassView, type GlassViewProps, isLiquidGlassAvailable } from 'expo-glass-effect';
import { type ComponentProps } from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

/** iOS 26+ only. Elsewhere `fallback` styles stand in (no blur on Android). */
const LIQUID = isLiquidGlassAvailable();

type GlassProps = GlassViewProps & { fallback?: StyleProp<ViewStyle> };

/**
 * Liquid Glass surface for the floating control layer (buttons, pills, keys) —
 * not for content cards. Reduce Transparency is handled by the OS on iOS.
 */
export default function Glass({ fallback, style, ...props }: GlassProps) {
    if (LIQUID) return <GlassView style={style} {...props} />;
    return <View style={[style, fallback]} {...props} />;
}

type GlassButtonProps = {
    icon: ComponentProps<typeof Ionicons>['name'];
    color: string;
    onPress: () => void;
    accessibilityLabel: string;
    tintColor?: string;
    size?: number;
};

/** 44 pt round glass icon button for headers. Interactive glass gives its own press response. */
export function GlassButton({ icon, color, onPress, accessibilityLabel, tintColor, size = 22 }: GlassButtonProps) {
    return (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} hitSlop={6}>
            {({ pressed }) => (
                <Glass
                    isInteractive
                    tintColor={tintColor}
                    style={styles.button}
                    // No native press response off iOS 26, so dim on press-in instead.
                    fallback={[styles.fallback, tintColor ? { backgroundColor: tintColor } : null, pressed && styles.pressed]}
                >
                    <Ionicons name={icon} size={size} color={color} />
                </Glass>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    button: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    fallback: { backgroundColor: '#F1F5F9' },
    pressed: { opacity: 0.6, transform: [{ scale: 0.96 }] },
});
