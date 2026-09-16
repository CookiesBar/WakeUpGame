import { useCallback, useEffect, useRef } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors, FontFamily } from '@/constants/theme';

interface WheelPickerProps {
  items: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  itemHeight?: number;
  visibleCount?: number;
  width?: number;
  /** Infinite looping scroll (hours / minutes). */
  loop?: boolean;
}

/**
 * Snapping wheel picker. With `loop`, the item list is repeated across several
 * copies and, after every settle, we silently recenter to the middle copy so it
 * scrolls endlessly. Initial centering happens on the first content-size layout
 * (scrolling before the content is measured is a no-op — that was the old bug).
 */
export default function WheelPicker({
  items,
  selectedIndex,
  onChange,
  itemHeight = 44,
  visibleCount = 5,
  width = 70,
  loop = false,
}: WheelPickerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const L = items.length;
  const copies = loop ? 5 : 1;
  const base = loop ? L * Math.floor(copies / 2) : 0;
  const data = loop ? Array.from({ length: copies }, () => items).flat() : items;
  const pad = (itemHeight * (visibleCount - 1)) / 2;

  const didInit = useRef(false);
  const lastEmitted = useRef(selectedIndex);

  const centerTo = useCallback(
    (real: number, animated = false) => {
      scrollRef.current?.scrollTo({ y: (base + real) * itemHeight, animated });
    },
    [base, itemHeight]
  );

  // Center once the content has actually been laid out.
  const handleContentSize = useCallback(() => {
    if (!didInit.current) {
      didInit.current = true;
      centerTo(selectedIndex);
    }
  }, [centerTo, selectedIndex]);

  // React to external (programmatic) selection changes, e.g. loading an alarm.
  useEffect(() => {
    if (!didInit.current) return;
    if (selectedIndex === lastEmitted.current) return; // our own scroll
    centerTo(selectedIndex);
  }, [selectedIndex, centerTo]);

  const settle = useCallback(
    (y: number) => {
      const raw = Math.round(y / itemHeight);
      const real = ((raw % L) + L) % L;
      lastEmitted.current = real;
      if (real !== selectedIndex) onChange(real);
      // Always snap to the exact item (fixes resting between values); for loop
      // this doubles as the invisible jump back to the middle copy.
      centerTo(real);
    },
    [L, itemHeight, onChange, selectedIndex, centerTo]
  );

  // A flick ends the drag while momentum is still to come — settling (and its
  // recenter teleport) now would fight that momentum, so defer to
  // onMomentumScrollEnd. Only settle here when the finger released at rest.
  const handleScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (Math.abs(e.nativeEvent.velocity?.y ?? 0) > 0.01) return;
      settle(e.nativeEvent.contentOffset.y);
    },
    [settle]
  );

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => settle(e.nativeEvent.contentOffset.y),
    [settle]
  );

  return (
    <View style={[styles.container, { height: itemHeight * visibleCount, width }]}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        disableIntervalMomentum
        decelerationRate="fast"
        nestedScrollEnabled
        onContentSizeChange={handleContentSize}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScrollEndDrag={handleScrollEndDrag}
        contentContainerStyle={{ paddingVertical: pad }}
      >
        {data.map((item, index) => {
          const active = index % L === selectedIndex;
          return (
            <View key={`${item}-${index}`} style={[styles.item, { height: itemHeight }]}>
              <Text style={[styles.itemText, active ? styles.active : styles.inactive]}>
                {item}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  item: { alignItems: 'center', justifyContent: 'center' },
  itemText: { fontFamily: FontFamily.display, textAlign: 'center' },
  active: { fontSize: 30, color: Colors.ink900, fontFamily: FontFamily.displayBold },
  inactive: { fontSize: 24, color: Colors.ink400 },
});
