import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { BUNDLED_SOUNDS, DEFAULT_SOUND_ID, getSoundName, pickCustomSound, previewSound, stopAlarmSound } from '@/utils/sounds';
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
    const params = useLocalSearchParams<{ currentSoundId?: string; alarmId?: string }>();
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
        // Navigate back to alarm edit with the selected sound
        router.replace({
            pathname: '/alarm/[id]',
            params: {
                id: params.alarmId || 'new',
                selectedSoundId: selectedSoundId,
                selectedSoundName: getSoundName(selectedSoundId),
            }
        });
    };

    const handleBack = () => {
        stopAlarmSound();
        router.back();
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={handleBack} style={styles.headerButton}>
                    <Ionicons name="chevron-back" size={24} color={Colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Alarm Sound</Text>
                <Pressable onPress={handleConfirm} style={styles.headerButton}>
                    <Ionicons name="checkmark" size={24} color={Colors.accent} />
                </Pressable>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Custom Sound Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Custom</Text>
                    <View style={styles.listContainer}>
                        <Pressable
                            style={styles.row}
                            onPress={handleSelectCustom}
                        >
                            <View style={styles.rowContent}>
                                <Ionicons name="folder-open-outline" size={22} color={Colors.textSecondary} />
                                <Text style={styles.rowLabel}>
                                    {customSoundUri ? 'Custom Sound' : 'Choose from Files'}
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
                    <Text style={styles.sectionTitle}>Sounds</Text>
                    <View style={styles.listContainer}>
                        {BUNDLED_SOUNDS.map((sound, index) => (
                            <React.Fragment key={sound.id}>
                                <Pressable
                                    style={styles.row}
                                    onPress={() => handleSelectSound(sound.id)}
                                >
                                    <Text style={styles.rowLabel}>{sound.name}</Text>
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
    headerButton: {
        padding: Spacing.sm,
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
