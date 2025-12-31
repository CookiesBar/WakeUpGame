// Full-screen alarm ring screen
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { cancelAlarmNotifications } from '@/utils/notifications';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Easing,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AlarmRingScreen() {
    const { alarmId, label, time } = useLocalSearchParams<{
        alarmId: string;
        label?: string;
        time?: string;
    }>();

    // Pulsing animation for the alarm icon
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Start pulsing animation
        const pulseAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.15,
                    duration: 500,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 500,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );

        // Glow animation
        const glowAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, {
                    toValue: 1,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(glowAnim, {
                    toValue: 0,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );

        pulseAnimation.start();
        glowAnimation.start();

        return () => {
            pulseAnimation.stop();
            glowAnimation.stop();
        };
    }, [pulseAnim, glowAnim]);


    const handleStop = async () => {
        // Cancel any remaining backup notifications for this alarm
        if (alarmId) {
            await cancelAlarmNotifications(alarmId);
        }

        // Navigate to game sequence
        router.replace({
            pathname: '/game/sequence',
            params: { alarmId },
        });
    };

    const glowOpacity = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                {/* Glow effect behind icon */}
                <View style={styles.iconContainer}>
                    <Animated.View
                        style={[
                            styles.glowCircle,
                            { opacity: glowOpacity },
                        ]}
                    />
                    <Animated.View
                        style={[
                            styles.iconWrapper,
                            { transform: [{ scale: pulseAnim }] },
                        ]}
                    >
                        <Ionicons name="alarm" size={80} color={Colors.danger} />
                    </Animated.View>
                </View>

                {/* ALARM text */}
                <Text style={styles.alarmText}>ALARM</Text>

                {/* Alarm time */}
                {time && <Text style={styles.timeText}>{time}</Text>}

                {/* Label */}
                {label && label !== 'undefined' && (
                    <Text style={styles.labelText}>{label}</Text>
                )}
            </View>

            {/* Stop button */}
            <View style={styles.buttonContainer}>
                <Pressable
                    style={styles.stopButton}
                    onPress={handleStop}
                >
                    <Text style={styles.stopButtonText}>WAKE UP NOW</Text>
                </Pressable>
                <Text style={styles.hintText}>Complete challenges to dismiss</Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
    },
    iconContainer: {
        position: 'relative',
        width: 160,
        height: 160,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    glowCircle: {
        position: 'absolute',
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: Colors.danger,
    },
    iconWrapper: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: Colors.danger,
    },
    alarmText: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.bold,
        color: Colors.danger,
        letterSpacing: 4,
        marginBottom: Spacing.sm,
    },
    timeText: {
        fontSize: 48,
        fontFamily: FontFamily.bold,
        color: Colors.text,
        marginBottom: Spacing.sm,
    },
    labelText: {
        fontSize: FontSize.xl,
        fontFamily: FontFamily.medium,
        color: Colors.textSecondary,
        marginBottom: Spacing.lg,
    },
    buttonContainer: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.xxl,
        alignItems: 'center',
    },
    stopButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.danger,
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.xxl,
        borderRadius: BorderRadius.full,
        width: '100%',
    },
    stopButtonText: {
        fontSize: FontSize.xl,
        fontFamily: FontFamily.bold,
        color: Colors.background,
    },
    hintText: {
        fontSize: FontSize.sm,
        fontFamily: FontFamily.regular,
        color: Colors.textMuted,
        marginTop: Spacing.md,
    },
});
