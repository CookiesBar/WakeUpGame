import { W, WFont } from '@/constants/white';
import { useLocale } from '@/contexts/LocaleContext';
import { BUNDLED_SOUNDS, DEFAULT_SOUND_ID, getSoundName, pickCustomSound, previewSound, setPickedSound, stopAlarmSound } from '@/utils/sounds';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SoundsScreen() {
    const params = useLocalSearchParams<{ currentSoundId?: string }>();
    const { t } = useLocale();
    const [selectedSoundId, setSelectedSoundId] = useState<string>(
        params.currentSoundId || DEFAULT_SOUND_ID
    );
    const [customSoundUri, setCustomSoundUri] = useState<string | null>(
        // If current sound is not a bundled sound, it's a custom sound URI
        params.currentSoundId && !BUNDLED_SOUNDS.find(s => s.id === params.currentSoundId)
            ? params.currentSoundId
            : null
    );

    // Check if current selection is custom
    const isCustomSelected = customSoundUri && selectedSoundId === customSoundUri;

    useEffect(() => {
        return () => {
            stopAlarmSound();
        };
    }, []);

    const handleSelectSound = (soundId: string) => {
        setSelectedSoundId(soundId);
        previewSound(soundId);
    };

    const handleSelectCustom = async () => {
        const sound = await pickCustomSound();
        if (sound) {
            setCustomSoundUri(sound.uri);
            setSelectedSoundId(sound.uri);
            previewSound(sound.uri);
        }
    };

    const handleConfirm = () => {
        stopAlarmSound();
        setPickedSound(selectedSoundId);
        router.back();
    };

    const handleBack = () => {
        stopAlarmSound();
        router.back();
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable style={({ pressed }) => [styles.round, pressed && styles.pressed]} onPress={handleBack} accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={4}>
                    <Ionicons name="chevron-back" size={22} color={W.ink} />
                </Pressable>
                <Text style={styles.headerTitle}>{t('sounds.title')}</Text>
                <Pressable style={styles.save} onPress={handleConfirm} accessibilityRole="button" hitSlop={8}>
                    <Text style={styles.saveText}>{t('common.save')}</Text>
                </Pressable>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Custom Sound Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('sounds.custom')}</Text>
                    <View style={styles.listContainer}>
                        <Pressable
                            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                            onPress={handleSelectCustom}
                        >
                            <View style={styles.rowContent}>
                                <Ionicons name="folder-open-outline" size={22} color={W.graphite} />
                                <Text style={styles.rowLabel}>
                                    {customSoundUri ? t('sounds.customSound') : t('sounds.chooseFile')}
                                </Text>
                            </View>
                            {isCustomSelected && (
                                <Ionicons name="checkmark" size={22} color={W.blue} />
                            )}
                        </Pressable>
                    </View>
                </View>

                {/* App Sounds Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('sounds.list')}</Text>
                    <View style={styles.listContainer}>
                        {BUNDLED_SOUNDS.map((sound, index) => (
                            <React.Fragment key={sound.id}>
                                <Pressable
                                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                                    onPress={() => handleSelectSound(sound.id)}
                                >
                                    <Text style={styles.rowLabel}>{getSoundName(sound.id)}</Text>
                                    {selectedSoundId === sound.id && (
                                        <Ionicons name="checkmark" size={22} color={W.blue} />
                                    )}
                                </Pressable>
                                {index < BUNDLED_SOUNDS.length - 1 && (
                                    <View style={styles.divider} />
                                )}
                            </React.Fragment>
                        ))}
                    </View>
                </View>

                <View style={styles.bottomSpacer} />
            </ScrollView>
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
});
