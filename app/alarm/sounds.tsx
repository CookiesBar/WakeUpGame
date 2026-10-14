import { GlassButton } from '@/components/Glass';
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
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
                <GlassButton icon="chevron-back" color={Colors.text} onPress={handleBack} accessibilityLabel={t('common.back')} />
                <Text style={styles.headerTitle}>{t('sounds.title')}</Text>
                <GlassButton icon="checkmark" color="#FFFFFF" tintColor={Colors.accent} onPress={handleConfirm} accessibilityLabel={t('common.save')} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Custom Sound Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('sounds.custom')}</Text>
                    <View style={styles.listContainer}>
                        <Pressable
                            style={styles.row}
                            onPress={handleSelectCustom}
                        >
                            <View style={styles.rowContent}>
                                <Ionicons name="folder-open-outline" size={22} color={Colors.textSecondary} />
                                <Text style={styles.rowLabel}>
                                    {customSoundUri ? t('sounds.customSound') : t('sounds.chooseFile')}
                                </Text>
                            </View>
                            {isCustomSelected && (
                                <Ionicons name="checkmark" size={22} color={Colors.accent} />
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
                                    style={styles.row}
                                    onPress={() => handleSelectSound(sound.id)}
                                >
                                    <Text style={styles.rowLabel}>{getSoundName(sound.id)}</Text>
                                    {selectedSoundId === sound.id && (
                                        <Ionicons name="checkmark" size={22} color={Colors.accent} />
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
    headerTitle: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.semibold,
        color: Colors.text,
    },
    content: {
        flex: 1,
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
    rowContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    rowLabel: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: Colors.text,
    },
    divider: {
        height: 1,
        backgroundColor: Colors.border,
        marginLeft: Spacing.md,
    },
    bottomSpacer: {
        height: Spacing.xxl,
    },
});
