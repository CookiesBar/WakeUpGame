import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Dummy plan data - will be replaced with RevenueCat integration
const PLANS = [
    {
        id: 'free',
        name: 'Free',
        price: '$0',
        period: 'forever',
        features: [
            'Up to 3 alarms',
            'Basic wake-up games',
            'Standard sounds',
        ],
        isCurrent: true,
        isPopular: false,
    },
    {
        id: 'pro_monthly',
        name: 'Pro Monthly',
        price: '$2.99',
        period: '/month',
        features: [
            'Unlimited alarms',
            'All wake-up games',
            'Premium sounds',
            'No ads',
            'Priority support',
        ],
        isCurrent: false,
        isPopular: true,
    },
    {
        id: 'pro_yearly',
        name: 'Pro Yearly',
        price: '$19.99',
        period: '/year',
        features: [
            'Unlimited alarms',
            'All wake-up games',
            'Premium sounds',
            'No ads',
            'Priority support',
            'Save 44%',
        ],
        isCurrent: false,
        isPopular: false,
    },
];

interface PlanCardProps {
    plan: typeof PLANS[0];
    onSelect: () => void;
}

function PlanCard({ plan, onSelect }: PlanCardProps) {
    return (
        <Pressable
            style={[
                styles.planCard,
                plan.isCurrent && styles.planCardCurrent,
                plan.isPopular && styles.planCardPopular,
            ]}
            onPress={onSelect}
        >
            {plan.isPopular && (
                <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>Most Popular</Text>
                </View>
            )}

            <View style={styles.planHeader}>
                <Text style={styles.planName}>{plan.name}</Text>
                <View style={styles.priceRow}>
                    <Text style={styles.planPrice}>{plan.price}</Text>
                    <Text style={styles.planPeriod}>{plan.period}</Text>
                </View>
            </View>

            <View style={styles.featuresContainer}>
                {plan.features.map((feature, index) => (
                    <View key={index} style={styles.featureRow}>
                        <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color={plan.isPopular ? Colors.accent : Colors.primary}
                        />
                        <Text style={styles.featureText}>{feature}</Text>
                    </View>
                ))}
            </View>

            <Pressable
                style={[
                    styles.selectButton,
                    plan.isCurrent && styles.selectButtonCurrent,
                    plan.isPopular && styles.selectButtonPopular,
                ]}
                onPress={onSelect}
            >
                <Text
                    style={[
                        styles.selectButtonText,
                        plan.isCurrent && styles.selectButtonTextCurrent,
                    ]}
                >
                    {plan.isCurrent ? 'Current Plan' : 'Select Plan'}
                </Text>
            </Pressable>
        </Pressable>
    );
}

export default function PlansScreen() {
    const handleSelectPlan = (planId: string) => {
        // TODO: Connect to RevenueCat for actual purchase flow
        console.log('Selected plan:', planId);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.title}>Plans</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.heroSection}>
                    <Ionicons name="rocket" size={48} color={Colors.primary} />
                    <Text style={styles.heroTitle}>Upgrade to Pro</Text>
                    <Text style={styles.heroSubtitle}>
                        Unlock all features and wake up better every day
                    </Text>
                </View>

                {PLANS.map((plan) => (
                    <PlanCard
                        key={plan.id}
                        plan={plan}
                        onSelect={() => handleSelectPlan(plan.id)}
                    />
                ))}

                <Text style={styles.disclaimer}>
                    Payment will be charged to your App Store account. Subscription
                    automatically renews unless cancelled at least 24 hours before the end
                    of the current period.
                </Text>

                {/* Legal Links */}
                <View style={styles.legalLinks}>
                    <Pressable
                        onPress={() => Linking.openURL('https://resonant-stock-52e.notion.site/Wakey-Privacy-Policy-43a8162e83de4eb58b61ee67a8dddcd2?pvs=74')}
                    >
                        <Text style={styles.legalLinkText}>Privacy Policy</Text>
                    </Pressable>
                    <Text style={styles.legalSeparator}>•</Text>
                    <Pressable
                        onPress={() => Linking.openURL('https://resonant-stock-52e.notion.site/Wakey-Terms-of-Service-c39428cc979341029bd53c207a7cb06f')}
                    >
                        <Text style={styles.legalLinkText}>Terms of Service</Text>
                    </Pressable>
                </View>
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
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    title: {
        fontSize: FontSize.xxl,
        fontFamily: FontFamily.bold,
        color: Colors.text,
    },
    content: {
        padding: Spacing.md,
        paddingBottom: Spacing.xxl,
    },
    heroSection: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
        marginBottom: Spacing.lg,
    },
    heroTitle: {
        fontSize: FontSize.xl,
        fontFamily: FontFamily.bold,
        color: Colors.text,
        marginTop: Spacing.md,
    },
    heroSubtitle: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginTop: Spacing.xs,
        paddingHorizontal: Spacing.xl,
    },
    planCard: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    planCardCurrent: {
        borderColor: Colors.primary,
        borderWidth: 2,
    },
    planCardPopular: {
        borderColor: Colors.accent,
        borderWidth: 2,
    },
    popularBadge: {
        position: 'absolute',
        top: -12,
        right: Spacing.lg,
        backgroundColor: Colors.accent,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
    },
    popularText: {
        fontSize: FontSize.xs,
        fontFamily: FontFamily.semibold,
        color: Colors.background,
    },
    planHeader: {
        marginBottom: Spacing.md,
    },
    planName: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.semibold,
        color: Colors.text,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginTop: Spacing.xs,
    },
    planPrice: {
        fontSize: FontSize.title,
        fontFamily: FontFamily.bold,
        color: Colors.text,
    },
    planPeriod: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: Colors.textSecondary,
        marginLeft: Spacing.xs,
    },
    featuresContainer: {
        marginBottom: Spacing.lg,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    featureText: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: Colors.text,
        marginLeft: Spacing.sm,
    },
    selectButton: {
        backgroundColor: Colors.primary,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
    },
    selectButtonCurrent: {
        backgroundColor: Colors.surfaceAlt,
    },
    selectButtonPopular: {
        backgroundColor: Colors.accent,
    },
    selectButtonText: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.semibold,
        color: Colors.background,
    },
    selectButtonTextCurrent: {
        color: Colors.textSecondary,
    },
    disclaimer: {
        fontSize: FontSize.xs,
        fontFamily: FontFamily.regular,
        color: Colors.textMuted,
        textAlign: 'center',
        marginTop: Spacing.lg,
        paddingHorizontal: Spacing.md,
        lineHeight: 18,
    },
    legalLinks: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: Spacing.md,
        marginBottom: Spacing.lg,
    },
    legalLinkText: {
        fontSize: FontSize.sm,
        fontFamily: FontFamily.regular,
        color: Colors.primary,
        textDecorationLine: 'underline',
    },
    legalSeparator: {
        fontSize: FontSize.sm,
        color: Colors.textMuted,
        marginHorizontal: Spacing.sm,
    },
});
