import WheelPicker from '@/components/WheelPicker';
import { W, WFont } from '@/constants/white';
import { useAlarms } from '@/contexts/AlarmContext';
import { LanguagePref, useLocale } from '@/contexts/LocaleContext';
import { LANGUAGE_NAMES, SUPPORTED_LOCALES } from '@/i18n';
import { armWakeCheck, scheduleAlarmNotification } from '@/utils/notifications';
import { manageSubscription } from '@/utils/revenueCat';
import { getAlarms, saveAlarm } from '@/utils/storage';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TERMS = 'https://resonant-stock-52e.notion.site/Terms-of-Service-3e187bf678be806496d7c7f1ef9d61b0';
const PRIVACY = 'https://resonant-stock-52e.notion.site/Privacy-Policy-EN-43a8162e83de4eb58b61ee67a8dddcd2';

const PREFS: LanguagePref[] = ['system', ...SUPPORTED_LOCALES];
const WHEEL_ROW = 40;

type IconName = keyof typeof Ionicons.glyphMap;

function Row({ label, detail, icon, onPress, last }: { label: string; detail?: string; icon?: IconName; onPress: () => void; last?: boolean }) {
    return (
        <>
            <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress} accessibilityRole="button">
                <Text style={styles.rowLabel}>{label}</Text>
                <View style={styles.rowRight}>
                    {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
                    {icon ? <Ionicons name={icon} size={20} color={icon === 'checkmark' ? W.blue : W.chev} /> : null}
                </View>
            </Pressable>
            {!last && <View style={styles.divider} />}
        </>
    );
}

const resetOnboarding = () =>
    Alert.alert('Reset onboarding?', 'Restart the app to see onboarding again.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => AsyncStorage.removeItem('hasSeenOnboarding') },
    ]);

export default function SettingsScreen() {
    const { pref, setPref, locale, t } = useLocale();
    const [notificationsOn, setNotificationsOn] = useState<boolean | null>(null);
    const { alarms, refreshAlarms } = useAlarms();

    // Dev: test the wake-up game and the "Still awake?" check without waiting for an alarm
    const playGame = (params?: { steps: string; math: string }) => router.push({ pathname: '/ring', params });
    const testWakeCheck = async () => {
        const alarm = alarms[0];
        if (!alarm) return Alert.alert('Add an alarm first', 'The check levels up the first alarm in the list.');
        await armWakeCheck(alarm, 10 * 1000);
        Alert.alert('Armed', `"Still awake?" rings in 10 s for ${alarm.time}. Leave the app closed for ~4.5 min to test a miss (game gets one notch harder), or open it during the ring to confirm.`);
    };
    const resetLevels = async () => {
        for (const alarm of await getAlarms()) await saveAlarm({ ...alarm, steps: undefined, mathLevel: undefined });
        await refreshAlarms();
        Alert.alert('Done', 'All alarms back to 50 steps + easy math.');
    };

    // Re-read the permission whenever the user comes back from system Settings.
    useEffect(() => {
        const check = () => Notifications.getPermissionsAsync().then(p => setNotificationsOn(p.granted)).catch(() => {});
        check();
        const sub = AppState.addEventListener('change', s => s === 'active' && check());
        return () => sub.remove();
    }, []);

    // Scheduled notifications carry their text, so re-schedule them in the new language.
    const scheduledLocale = useRef(locale);
    useEffect(() => {
        if (locale === scheduledLocale.current) return;
        scheduledLocale.current = locale;
        getAlarms().then(alarms => Promise.all(alarms.filter(a => a.enabled).map(scheduleAlarmNotification))).catch(() => {});
    }, [locale]);

    const name = (p: LanguagePref) => (p === 'system' ? t('settings.system') : LANGUAGE_NAMES[p]);
    // The language wheel: rolls freely, applies on Done (re-rendering the app mid-roll would be jarring).
    const [picking, setPicking] = useState<number | null>(null);
    const done = () => {
        if (picking !== null) setPref(PREFS[picking]);
        setPicking(null);
    };
    const open = (url: string) => WebBrowser.openBrowserAsync(url).catch(() => {});

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Pressable style={({ pressed }) => [styles.round, pressed && styles.pressed]} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={4}>
                    <Ionicons name="chevron-back" size={22} color={W.ink} />
                </Pressable>
                <Text style={styles.headerTitle}>{t('settings.title')}</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                    <View style={styles.listContainer}>
                        <Row label={t('settings.language')} detail={name(pref)} icon="chevron-forward" onPress={() => setPicking(PREFS.indexOf(pref))} last />
                    </View>
                </View>

                <View style={styles.section}>
                    <View style={styles.listContainer}>
                        <Row
                            label={t('settings.notifications')}
                            detail={notificationsOn == null ? undefined : t(notificationsOn ? 'settings.on' : 'settings.off')}
                            icon="open-outline"
                            onPress={() => Linking.openSettings()}
                            last
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('settings.legal')}</Text>
                    <View style={styles.listContainer}>
                        <Row label={t('legal.terms')} icon="open-outline" onPress={() => open(TERMS)} />
                        <Row label={t('legal.privacy')} icon="open-outline" onPress={() => open(PRIVACY)} last={Platform.OS !== 'ios'} />
                        {/* RevenueCat is iOS-only here; opens Apple's native manage-subscriptions sheet */}
                        {Platform.OS === 'ios' && (
                            <Row label={t('settings.subscription')} icon="open-outline" onPress={manageSubscription} last />
                        )}
                    </View>
                </View>

                {__DEV__ && (
                    <>
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Test game</Text>
                            <View style={styles.listContainer}>
                                <Row label="Play game" detail="20 steps, easy" icon="game-controller-outline" onPress={() => playGame({ steps: '20', math: '0' })} />
                                <Row label="Play game" detail="100 steps, hard" icon="game-controller-outline" onPress={() => playGame({ steps: '100', math: '2' })} />
                                <Row label="Still awake? check in 10 s" detail={alarms[0] ? `${alarms[0].steps ?? 50} st · math ${alarms[0].mathLevel ?? 0}` : undefined} icon="alarm-outline" onPress={testWakeCheck} />
                                <Row label="Reset game difficulty" icon="refresh" onPress={resetLevels} last />
                            </View>
                        </View>
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Developer</Text>
                            <View style={styles.listContainer}>
                                <Row label="Reset onboarding" icon="refresh" onPress={resetOnboarding} last />
                            </View>
                        </View>
                    </>
                )}

                <Text style={styles.version}>v{Constants.expoConfig?.version}</Text>
            </ScrollView>

            <Modal visible={picking !== null} transparent animationType="fade" onRequestClose={() => setPicking(null)}>
                <Pressable style={styles.scrim} onPress={() => setPicking(null)} accessibilityLabel={t('common.cancel')} />
                <View style={styles.sheet}>
                    <View style={styles.sheetHeader}>
                        <Text style={styles.headerTitle}>{t('settings.language')}</Text>
                        <Pressable style={styles.save} onPress={done} accessibilityRole="button" hitSlop={8}>
                            <Text style={styles.doneText}>{t('settings.done')}</Text>
                        </Pressable>
                    </View>
                    <View style={styles.wheelCard}>
                        <View style={styles.band} pointerEvents="none" />
                        {picking !== null && (
                            <WheelPicker
                                data={PREFS.map(name)}
                                selectedIndex={picking}
                                onIndexChange={setPicking}
                                infinite={false}
                                itemHeight={WHEEL_ROW}
                                style={styles.wheel}
                                textStyle={styles.wheelText}
                                colors={[W.ink, 'rgba(11,13,16,0.3)']}
                                accessibilityLabel={t('settings.language')}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: W.mist },
    header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
    round: { width: 44, height: 44, borderRadius: 999, backgroundColor: W.paper, alignItems: 'center', justifyContent: 'center' },
    headerSpacer: { width: 44 },
    headerTitle: { fontFamily: WFont.semibold, fontSize: 17, lineHeight: 22, color: W.ink },
    save: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
    saveText: { fontFamily: WFont.bold, fontSize: 17, color: W.ink },
    content: { flex: 1 },
    section: { marginTop: 20, paddingHorizontal: 20 },
    sectionTitle: { marginBottom: 8, paddingHorizontal: 20, fontFamily: WFont.semibold, fontSize: 13, lineHeight: 18, color: W.graphite },
    listContainer: { backgroundColor: W.paper, borderRadius: 24, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, minHeight: 52, paddingVertical: 12 },
    pressed: { backgroundColor: W.hair },
    rowContent: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
    rowLabel: { flexShrink: 1, fontFamily: WFont.medium, fontSize: 17, lineHeight: 22, color: W.ink },
    rowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    rowDetail: { fontFamily: WFont.regular, fontSize: 17, lineHeight: 22, color: W.graphite },
    divider: { height: 1, backgroundColor: W.hair, marginLeft: 20 },
    version: { marginTop: 32, marginBottom: 48, fontFamily: WFont.medium, fontSize: 13, color: W.dim, textAlign: 'center' },
    bottomSpacer: { height: 48 },
    scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
    sheet: { backgroundColor: W.mist, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 40 },
    sheetHeader: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    doneText: { fontFamily: WFont.bold, fontSize: 17, color: W.blueText },
    wheelCard: { borderRadius: 24, backgroundColor: W.paper, overflow: 'hidden', justifyContent: 'center' },
    band: { position: 'absolute', left: 12, right: 12, top: '50%', height: WHEEL_ROW, marginTop: -WHEEL_ROW / 2, borderRadius: 10, backgroundColor: W.mist },
    wheel: { width: '100%' },
    wheelText: { fontFamily: WFont.semibold, fontSize: 22, letterSpacing: -0.22 },
});
