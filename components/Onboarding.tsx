import { BUTTON_TEXT, ONBOARDING_PAGES } from '@/constants/onboardingContent';
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Dimensions,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import OnboardingAlarmDemo from './OnboardingAlarmDemo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Only show first 5 pages in the swiper
const REGULAR_PAGES = ONBOARDING_PAGES.slice(0, 5);
const TOTAL_PAGES = 6;

const ANIMATION_DURATION = 250;

interface OnboardingProps {
    onComplete: () => void;
}

// Animated indicator component
const AnimatedIndicator = React.memo(({ index, currentIndex }: { index: number; currentIndex: number }) => {
    const isActive = index === currentIndex;
    const width = useSharedValue(isActive ? 24 : 10);

    useEffect(() => {
        width.value = withSpring(isActive ? 24 : 10, {
            damping: 15,
            stiffness: 150,
        });
    }, [isActive]);

    const animatedStyle = useAnimatedStyle(() => ({
        width: width.value,
        backgroundColor: isActive ? Colors.accent : Colors.border,
    }));

    return <Animated.View style={[styles.indicator, animatedStyle]} />;
});

export default function Onboarding({ onComplete }: OnboardingProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    // Animation values - simple fade + subtle slide
    const opacity = useSharedValue(1);
    const translateX = useSharedValue(0);
    const scale = useSharedValue(1);

    const animateToNext = useCallback((nextIndex: number, goToDemo: boolean = false) => {
        if (goToDemo) {
            // Instant transition to demo page - no animation to avoid stutter
            setCurrentIndex(REGULAR_PAGES.length);
            return;
        }

        setIsAnimating(true);

        // Phase 1: Fade out + slide left slightly
        opacity.value = withTiming(0, { duration: ANIMATION_DURATION, easing: Easing.out(Easing.quad) });
        translateX.value = withTiming(-30, { duration: ANIMATION_DURATION, easing: Easing.out(Easing.quad) });
        scale.value = withTiming(0.95, { duration: ANIMATION_DURATION, easing: Easing.out(Easing.quad) });

        // After fade out, update content + fade in
        setTimeout(() => {
            setCurrentIndex(nextIndex);

            // Reset to right side
            translateX.value = 30;
            scale.value = 0.95;

            // Phase 2: Fade in from right
            opacity.value = withTiming(1, { duration: ANIMATION_DURATION, easing: Easing.out(Easing.quad) });
            translateX.value = withTiming(0, { duration: ANIMATION_DURATION, easing: Easing.out(Easing.quad) });
            scale.value = withTiming(1, { duration: ANIMATION_DURATION, easing: Easing.out(Easing.quad) });

            setTimeout(() => {
                setIsAnimating(false);
            }, ANIMATION_DURATION);
        }, ANIMATION_DURATION);
    }, []);

    const handleNext = useCallback(() => {
        if (isAnimating) return;

        if (currentIndex < REGULAR_PAGES.length - 1) {
            animateToNext(currentIndex + 1);
        } else if (currentIndex === REGULAR_PAGES.length - 1) {
            animateToNext(0, true);
        } else {
            onComplete();
        }
    }, [currentIndex, isAnimating, onComplete, animateToNext]);

    const isOnDemoPage = currentIndex >= REGULAR_PAGES.length;
    const currentPage = REGULAR_PAGES[currentIndex];

    // Animated content style
    const animatedContentStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [
            { translateX: translateX.value },
            { scale: scale.value },
        ],
    }));

    const renderPageIndicator = () => (
        <View style={styles.indicatorContainer}>
            {Array.from({ length: TOTAL_PAGES }).map((_, index) => (
                <AnimatedIndicator key={index} index={index} currentIndex={currentIndex} />
            ))}
        </View>
    );

    // Show demo page when on last page (no page indicator)
    if (isOnDemoPage) {
        return (
            <View style={styles.container}>
                <Animated.View style={[styles.demoContainer, animatedContentStyle]}>
                    <OnboardingAlarmDemo onNext={onComplete} />
                </Animated.View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Content Area with Animation */}
            <Animated.View style={[styles.contentArea, animatedContentStyle]}>
                {/* Image/Thumbnail Area */}
                <View style={styles.imageContainer}>
                    {currentPage?.image ? (
                        <Image source={currentPage.image} style={styles.image} resizeMode="contain" />
                    ) : (
                        <View style={styles.imagePlaceholder}>
                            <Ionicons name="alarm" size={80} color={Colors.accent} />
                        </View>
                    )}
                </View>

                {/* Text Content */}
                <View style={styles.textContainer}>
                    <Text style={styles.title}>{currentPage?.title || 'Welcome'}</Text>
                    <Text style={styles.description}>{currentPage?.description || ''}</Text>
                </View>
            </Animated.View>

            {/* Page Indicator */}
            {renderPageIndicator()}

            {/* Next Button */}
            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={[styles.button, isAnimating && styles.buttonDisabled]}
                    onPress={handleNext}
                    activeOpacity={0.8}
                    disabled={isAnimating}
                >
                    <Text style={styles.buttonText}>{BUTTON_TEXT.next}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    contentArea: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.xl,
    },
    demoContainer: {
        flex: 1,
    },
    imageContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1,
        maxHeight: SCREEN_WIDTH * 0.55,
    },
    image: {
        width: SCREEN_WIDTH * 0.55,
        height: SCREEN_WIDTH * 0.55,
    },
    imagePlaceholder: {
        width: SCREEN_WIDTH * 0.4,
        height: SCREEN_WIDTH * 0.4,
        borderRadius: BorderRadius.xl,
        backgroundColor: Colors.surfaceAlt,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        marginTop: Spacing.lg,
    },
    title: {
        fontFamily: FontFamily.bold,
        fontSize: 28, // Smaller to prevent overlap
        color: Colors.accent,
        textAlign: 'center',
        marginBottom: Spacing.sm,
    },
    description: {
        fontFamily: FontFamily.regular,
        fontSize: FontSize.lg, // 18px
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 32,
    },
    indicatorContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: Spacing.lg,
    },
    indicator: {
        height: 10,
        borderRadius: 5,
        marginHorizontal: 4,
    },
    buttonContainer: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.xxl,
    },
    button: {
        backgroundColor: Colors.accent,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.lg,
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        fontFamily: FontFamily.semibold,
        fontSize: FontSize.md,
        color: Colors.background,
        letterSpacing: 1,
    },
});
