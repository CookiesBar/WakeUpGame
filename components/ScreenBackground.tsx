import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/theme';

/** Plain Wakey app background (soft blue-white). */
export default function ScreenBackground({ children }: { children: ReactNode }) {
  return <View style={styles.fill}>{children}</View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: Colors.paper },
});
