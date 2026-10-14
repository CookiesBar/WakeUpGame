import { GlassButton } from '@/components/Glass';
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAlarms } from '@/contexts/AlarmContext';
import { LanguagePref, useLocale } from '@/contexts/LocaleContext';
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
import { Alert, AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TERMS = 'https://app.notion.com/p/Terms-of-Service-3e187bf678be806496d7c7f1ef9d61b0';
const PRIVACY = 'https://resonant-stock-52e.notion.site/Privacy-Policy-EN-43a8162e83de4eb58b61ee67a8dddcd2';

const PREFS: LanguagePref[] = ['system', 'en', 'es', 'sv', 'de'];
const LANG_NAME: Record<Exclude<LanguagePref, 'system'>, string> = { en: 'English', es: 'Español', sv: 'Svenska', de: 'Deutsch' };

type IconName = keyof typeof Ionicons.glyphMap;

function Row({ label, detail, icon, onPress, last }: { label: string; detail?: string; icon?: IconName; onPress: () => void; last?: boolean }) {
    return (
        <>
            <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
                <Text style={styles.rowLabel}>{label}</Text>
                <View style={styles.rowRight}>
                    {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
                    {icon ? <Ionicons name={icon} size={20} color={icon === 'checkmark' ? Colors.accent : Colors.textMuted} /> : null}
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
        Alert.alert('Done', 'All alarms back to 50 steps + medium math.');
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

    const name = (p: LanguagePref) => (p === 'system' ? t('settings.system') : LANG_NAME[p]);
    const open = (url: string) => WebBrowser.openBrowserAsync(url).catch(() => {});

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <GlassButton icon="chevron-back" color={Colors.text} onPress={() => router.back()} accessibilityLabel={t('common.back')} />
                <Text style={styles.headerTitle}>{t('settings.title')}</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
                    <View style={styles.listContainer}>
                        {PREFS.map((p, i) => (
                            <Row key={p} label={name(p)} icon={p === pref ? 'checkmark' : undefined} onPress={() => setPref(p)} last={i === PREFS.length - 1} />
                        ))}
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
                                <Row label="Still awake? check in 10 s" detail={alarms[0] ? `${alarms[0].steps ?? 50} st · math ${alarms[0].mathLevel ?? 1}` : undefined} icon="alarm-outline" onPress={testWakeCheck} />
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
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    headerSpacer: { width: 44 },
    headerTitle: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.semibold,
        color: Colors.text,
    },
    section: {
        marginTop: Spacing.lg,
        paddingHorizontal: Spacing.lg,
    },
    sectionTitle: {
        fontSize: FontSize.sm,
        fontFamily: FontFamily.medium,
        color: Colors.textSecondary,
        marginBottom: Spacing.sm,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    listContainer: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        minHeight: 52,
    },
    rowLabel: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: Colors.text,
        flex: 1,
    },
    rowRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    rowDetail: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: Colors.textSecondary,
    },
    divider: {
        height: 1,
        backgroundColor: Colors.border,
        marginLeft: Spacing.md,
    },
    version: {
        fontSize: FontSize.xs,
        fontFamily: FontFamily.regular,
        color: Colors.textMuted,
        textAlign: 'center',
        marginTop: Spacing.xl,
        marginBottom: Spacing.xxl,
    },
});
