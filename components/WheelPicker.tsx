import { Colors, FontFamily } from '@/constants/theme';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

interface WheelPickerProps {
    data: string[];
    selectedIndex: number;
    onIndexChange: (index: number) => void;
    style?: ViewStyle;
    infinite?: boolean;
    itemHeight?: number;
    visibleItems?: number;
}

const DEFAULT_ITEM_HEIGHT = 56;
const DEFAULT_VISIBLE_ITEMS = 5;

export default function WheelPicker({
    data,
    selectedIndex,
    onIndexChange,
    style,
    infinite = true,
    itemHeight = DEFAULT_ITEM_HEIGHT,
    visibleItems = DEFAULT_VISIBLE_ITEMS,
}: WheelPickerProps) {
    const translateY = useSharedValue(0);
    const lastTranslateY = useSharedValue(0);
    const [visibleSelectedIndex, setVisibleSelectedIndex] = useState(selectedIndex);
    const containerHeight = itemHeight * visibleItems;
    const centerOffset = (visibleItems - 1) / 2 * itemHeight;

    const dataLength = data.length;

    // For infinite scroll, only use 3 repetitions (much faster!)
    const repetitions = infinite ? 3 : 1;
    const middleRepetition = infinite ? 1 : 0;

    // Normalize index to data range
    const normalizeIndex = useCallback((index: number): number => {
        if (!infinite || dataLength === 0) return Math.max(0, Math.min(dataLength - 1, index));
        return ((index % dataLength) + dataLength) % dataLength;
    }, [infinite, dataLength]);

    // Initialize and update position when selectedIndex changes
    useEffect(() => {
        const targetVirtualIndex = infinite
            ? middleRepetition * dataLength + selectedIndex
            : selectedIndex;
        translateY.value = withTiming(-targetVirtualIndex * itemHeight, { duration: 100 });
        setVisibleSelectedIndex(selectedIndex);
    }, [selectedIndex, infinite, dataLength, middleRepetition, itemHeight]);

    // Update visible selected index based on scroll position
    const updateVisibleSelection = useCallback((virtualIndex: number) => {
        const normalized = normalizeIndex(virtualIndex);
        setVisibleSelectedIndex(normalized);
    }, [normalizeIndex]);

    const recenterIfNeeded = useCallback((currentVirtualIndex: number) => {
        if (!infinite) return;

        // If we've scrolled too far from middle, reset position
        const normalizedIndex = normalizeIndex(currentVirtualIndex);
        const middleIndex = middleRepetition * dataLength + normalizedIndex;

        if (currentVirtualIndex < dataLength / 2 || currentVirtualIndex > dataLength * 2.5) {
            translateY.value = -middleIndex * itemHeight;
        }
    }, [infinite, dataLength, middleRepetition, itemHeight, normalizeIndex]);

    const snapToIndex = useCallback((velocity: number) => {
        'worklet';
        let currentIndex = Math.round(-translateY.value / itemHeight);

        // Add momentum effect
        if (Math.abs(velocity) > 200) {
            const momentumItems = Math.round(velocity / 800);
            currentIndex = currentIndex - momentumItems;
        }

        if (!infinite) {
            currentIndex = Math.max(0, Math.min(dataLength - 1, currentIndex));
        }

        translateY.value = withSpring(-currentIndex * itemHeight, {
            damping: 20,
            stiffness: 150,
            mass: 0.5,
        });

        // Update visible selection and notify parent
        runOnJS(updateVisibleSelection)(currentIndex);

        const normalizedIndex = infinite && dataLength > 0
            ? ((currentIndex % dataLength) + dataLength) % dataLength
            : currentIndex;

        runOnJS(onIndexChange)(normalizedIndex);

        // Recenter after animation
        if (infinite) {
            runOnJS(recenterIfNeeded)(currentIndex);
        }
    }, [dataLength, infinite, itemHeight, onIndexChange, updateVisibleSelection, recenterIfNeeded]);

    // Update visible selection during drag
    const updateSelectionDuringDrag = useCallback(() => {
        'worklet';
        const currentIndex = Math.round(-translateY.value / itemHeight);
        runOnJS(updateVisibleSelection)(currentIndex);
    }, [itemHeight, updateVisibleSelection]);

    const panGesture = Gesture.Pan()
        .onStart(() => {
            lastTranslateY.value = translateY.value;
        })
        .onUpdate((event) => {
            let newTranslateY = lastTranslateY.value + event.translationY;

            if (!infinite) {
                // Add resistance at edges
                const minTranslateY = -(dataLength - 1) * itemHeight;
                const maxTranslateY = 0;

                if (newTranslateY > maxTranslateY) {
                    newTranslateY = maxTranslateY + (newTranslateY - maxTranslateY) * 0.3;
                } else if (newTranslateY < minTranslateY) {
                    newTranslateY = minTranslateY + (newTranslateY - minTranslateY) * 0.3;
                }
            }

            translateY.value = newTranslateY;
            updateSelectionDuringDrag();
        })
        .onEnd((event) => {
            snapToIndex(event.velocityY);
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value + centerOffset }],
    }));

    // Build items for rendering
    const items = [];
    for (let rep = 0; rep < repetitions; rep++) {
        for (let i = 0; i < dataLength; i++) {
            const virtualIndex = rep * dataLength + i;
            // Check if this item's data index matches the currently visible selected index
            const isSelected = i === visibleSelectedIndex;

            items.push(
                <View key={`${rep}-${i}`} style={[styles.item, { height: itemHeight }]}>
                    <Text style={[
                        styles.itemText,
                        isSelected && styles.selectedItemText,
                    ]}>
                        {data[i]}
                    </Text>
                </View>
            );
        }
    }

    return (
        <View style={[styles.container, { height: containerHeight }, style]}>
            <GestureDetector gesture={panGesture}>
                <Animated.View style={[styles.wheel, animatedStyle]}>
                    {items}
                </Animated.View>
            </GestureDetector>

            {/* Selection indicator */}
            <View
                style={[
                    styles.selectionIndicator,
                    {
                        top: centerOffset,
                        height: itemHeight,
                    }
                ]}
                pointerEvents="none"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
        width: 100,
    },
    wheel: {
        position: 'absolute',
        left: 0,
        right: 0,
    },
    item: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemText: {
        fontSize: 28,
        fontFamily: FontFamily.medium,
        color: Colors.textMuted,
    },
    selectedItemText: {
        fontFamily: FontFamily.bold,
        color: '#000000',
        fontSize: 32,
    },
    selectionIndicator: {
        position: 'absolute',
        left: 0,
        right: 0,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: Colors.border,
        backgroundColor: 'transparent',
    },
});
