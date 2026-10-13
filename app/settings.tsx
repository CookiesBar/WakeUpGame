import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Animated, Easing, Modal, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Pressable from '@/components/Pressable';
import ScreenBackground from '@/components/ScreenBackground';
import WheelPicker from '@/components/WheelPicker';
import { BorderRadius, Colors, FontFamily, FontSize, Shadow, Spacing } from '@/constants/theme';
import { LanguagePref, useLocale } from '@/contexts/LocaleContext';
import { manageSubscription } from '@/utils/revenueCat';

const TERMS = 'https://app.notion.com/p/Terms-of-Service-3e187bf678be806496d7c7f1ef9d61b0';
const PRIVACY = 'https://resonant-stock-52e.notion.site/Privacy-Policy-EN-43a8162e83de4eb58b61ee67a8dddcd2';

const PREFS: LanguagePref[] = ['system', 'en', 'es', 'sv', 'de'];
const LANG_NAME: Record<Exclude<LanguagePref, 'system'>, string> = { en: 'English', es: 'Español', sv: 'Svenska', de: 'Deutsch' };

type IconName = keyof typeof Ionicons.glyphMap;

function Item({ label, detail, icon, onPress, last }: { label: string; detail?: string; icon: IconName; onPress: () => void; last?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.item, !last && styles.divider, pressed && { backgroundColor: Colors.blue50 }]}
      accessibilityRole={detail ? 'button' : 'link'}
      accessibilityValue={detail ? { text: detail } : undefined}>
      <Text style={[styles.body, { flex: 1 }]}>{label}</Text>
      {detail && <Text style={[styles.body, { color: Colors.ink500 }]}>{detail}</Text>}
      <Ionicons name={icon} size={16} color={Colors.ink400} />
    </Pressable>
  );
}

// Bottom sheet: dimmed backdrop fades, panel slides; stays mounted until the close animation ends.
function Sheet({ visible, onClose, title, doneLabel, children }: { visible: boolean; onClose: () => void; title: string; doneLabel: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const [p] = useState(() => new Animated.Value(0));
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    Animated.timing(p, { toValue: visible ? 1 : 0, duration: visible ? 320 : 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(
      ({ finished }) => finished && !visible && setMounted(false),
    );
  }, [visible, p]);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: p }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={doneLabel} />
      </Animated.View>
      <Animated.View
        style={[
          styles.panel,
          { paddingBottom: insets.bottom + Spacing.xl, transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] },
        ]}>
        <View style={styles.grabber} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={8} style={styles.done} accessibilityRole="button">
            <Text style={styles.doneText}>{doneLabel}</Text>
          </Pressable>
        </View>
        {children}
      </Animated.View>
    </Modal>
  );
}

export default function SettingsScreen() {
  const { pref, setPref, t } = useLocale();
  const insets = useSafeAreaInsets();
  const [picking, setPicking] = useState<LanguagePref | null>(null); // the wheel's language while its sheet is open; applied on Done
  const name = (p: LanguagePref) => (p === 'system' ? t('settings.system') : LANG_NAME[p]);
  const open = (url: string) => WebBrowser.openBrowserAsync(url).catch(() => {});
  const done = () => {
    if (picking) setPref(picking);
    setPicking(null);
  };

  return (
    <ScreenBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: insets.bottom + Spacing.xxl }}>
          <Pressable style={styles.back} onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.back')}>
            <Ionicons name="chevron-back" size={24} color={Colors.ink900} />
          </Pressable>
          <Text style={styles.largeTitle}>{t('settings.title')}</Text>

          <View style={[styles.group, { marginTop: Spacing.xxl }]}>
            <Item label={t('settings.language')} detail={name(pref)} icon="chevron-forward" onPress={() => setPicking(pref)} last />
          </View>

          <View style={[styles.group, { marginTop: Spacing.xxl }]}>
            <Item label={t('settings.subscription')} icon="open-outline" onPress={manageSubscription} last />
          </View>

          <Text style={styles.label}>{t('settings.legal')}</Text>
          <View style={styles.group}>
            <Item label={t('settings.terms')} icon="open-outline" onPress={() => open(TERMS)} />
            <Item label={t('settings.privacy')} icon="open-outline" onPress={() => open(PRIVACY)} last />
          </View>

          <Text style={styles.version}>v{Constants.expoConfig?.version}</Text>
        </ScrollView>
      </SafeAreaView>

      <Sheet visible={picking != null} onClose={done} title={t('settings.language')} doneLabel={t('settings.done')}>
        <View style={{ alignItems: 'center' }}>
          <WheelPicker
            items={PREFS.map(name)}
            selectedIndex={PREFS.indexOf(picking ?? pref)}
            onChange={(i) => setPicking(PREFS[i])}
            width={220}
          />
        </View>
      </Sheet>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  back: { width: 40, height: 40, justifyContent: 'center', marginLeft: -Spacing.xs },
  largeTitle: { fontFamily: FontFamily.displayBold, fontSize: FontSize.h1, color: Colors.ink900 },
  body: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.md, color: Colors.ink900 },
  label: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.xs,
    color: Colors.ink500,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: Spacing.xxl,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.lg,
  },
  group: {
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 52, paddingHorizontal: Spacing.lg },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.ink200 },
  version: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.xs, color: Colors.ink400, textAlign: 'center', marginTop: Spacing['3xl'] },

  backdrop: { backgroundColor: 'rgba(11,27,59,0.4)' },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    ...Shadow.md,
  },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: Colors.ink200, marginTop: Spacing.sm },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  sheetTitle: { fontFamily: FontFamily.display, fontSize: FontSize.lg, color: Colors.ink900 },
  done: { backgroundColor: Colors.blue50, borderRadius: BorderRadius.pill, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  doneText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.blue600 },
});
