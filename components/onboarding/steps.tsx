// The onboarding steps, in order: build the alarm, try the game, tune it, then the
// story, and the notification ask last, once they're invested. Each setting gets its own step.
import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps, type JSX, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { MathMission, WalkMission } from '@/app/ring';
import Mascot from '@/components/Mascot';
import Pressable from '@/components/Pressable';
import WheelPicker from '@/components/WheelPicker';
import { BorderRadius, Colors, FontFamily, FontSize, Shadow, Spacing } from '@/constants/wakeyTheme';
import { useLocale } from '@/contexts/LocaleContext';
import { strings } from '@/i18n';
import { posthog } from '@/utils/analytics';
import { makeProblem, type MathLevel } from '@/utils/math';
import { requestNotificationPermissions } from '@/utils/notifications';
import { bedtimes } from '@/utils/sleepCycle';
import { BUNDLED_SOUNDS, getSoundName, previewSound, stopAlarmSound } from '@/utils/sounds';
import { DEFAULT_STEPS, MATH_LEVELS, STEP_OPTIONS } from '@/utils/wakeCheck';
import { Cta, enter, Grow, Option, Page, styles as kit, tap, TextButton, Title } from './kit';

export const STEPS = [
    'welcome', 'time', 'days', 'game', 'steps', 'math', 'sound', 'check', 'label',
    'goal', 'pains', 'spiral', 'result', 'compare', 'notify',
] as const;
export type StepId = (typeof STEPS)[number];

export interface Draft {
    hours: number;
    minutes: number;
    days: boolean[]; // [Sun … Sat], all off = once
    steps: number;
    mathLevel: MathLevel;
    soundId: string;
    wakeCheck: boolean;
    label: string;
}

export interface Answers {
    goal: string | null;
    pains: string[];
}

export interface StepProps {
    draft: Draft;
    set: (patch: Partial<Draft>) => void;
    answers: Answers;
    setAnswers: (patch: Partial<Answers>) => void;
    next: () => void;
    finish: () => Promise<void>;
}

const GOALS = [
    ['snooze', '😴'], ['late', '⏰'], ['routine', '🌅'], ['groggy', '⚡'], ['move', '🏃'],
] as const;
const PAINS = [
    ['snooze', '🔁'], ['off', '📴'], ['sleep', '🔇'], ['back', '🛌'], ['groggy', '🥱'],
] as const;

const pad = (n: number) => String(n).padStart(2, '0');
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function daysText(days: boolean[], t: (k: string) => string): string {
    const on = days.map((d, i) => (d ? strings().days.short[i] : null)).filter(Boolean);
    if (on.length === 0) return t('onboarding.days.once');
    if (on.length === 7) return t('edit.everyDay');
    if (days.join() === [false, true, true, true, true, true, false].join()) return t('edit.weekdays');
    if (days.join() === [true, false, false, false, false, false, true].join()) return t('edit.weekends');
    return on.join(', ');
}

/* ───────────── Story ───────────── */

function Welcome({ next }: StepProps) {
    const { t } = useLocale();
    return (
        <Page footer={<Cta label={t('onboarding.welcome.cta')} onPress={next} />}>
            <View style={s.hero}>
                <Animated.View entering={enter(0)} style={s.heroGlow}>
                    <Mascot mood="happy" size={230} />
                </Animated.View>
            </View>
            <Animated.Text entering={enter(2)} style={[kit.title, s.center, s.big]}>
                {t('onboarding.welcome.title')}
            </Animated.Text>
            <Animated.Text entering={enter(3)} style={[kit.sub, s.center]}>
                {t('onboarding.welcome.body')}
            </Animated.Text>
        </Page>
    );
}

function Goal({ answers, setAnswers, next }: StepProps) {
    const { t } = useLocale();
    return (
        <Page footer={<Cta label={t('onboarding.continue')} onPress={next} disabled={!answers.goal} />}>
            <Title title={t('onboarding.goal.title')} />
            {GOALS.map(([id, emoji], i) => (
                <Option
                    key={id}
                    index={i}
                    emoji={emoji}
                    label={t(`onboarding.goal.${id}`)}
                    selected={answers.goal === id}
                    onPress={() => setAnswers({ goal: id })}
                />
            ))}
        </Page>
    );
}

function Pains({ answers, setAnswers, next }: StepProps) {
    const { t } = useLocale();
    const toggle = (id: string) =>
        setAnswers({ pains: answers.pains.includes(id) ? answers.pains.filter(p => p !== id) : [...answers.pains, id] });
    return (
        <Page footer={<Cta label={t('onboarding.continue')} onPress={next} disabled={answers.pains.length === 0} />}>
            <Title title={t('onboarding.pains.title')} sub={t('onboarding.pains.body')} />
            {PAINS.map(([id, emoji], i) => (
                <Option
                    key={id}
                    index={i}
                    multi
                    emoji={emoji}
                    label={t(`onboarding.pains.${id}`)}
                    selected={answers.pains.includes(id)}
                    onPress={() => toggle(id)}
                />
            ))}
        </Page>
    );
}

/** Pain graphic: minutes of broken sleep piling up with each 9-minute snooze. */
function Spiral({ answers, next }: StepProps) {
    const { t } = useLocale();
    const snoozes = [1, 2, 3, 4, 5];
    return (
        <Page footer={<Cta label={t('onboarding.continue')} onPress={next} />}>
            <Title title={t('onboarding.spiral.title')} />
            <Animated.View entering={enter(1)} style={s.card}>
                <Animated.Text entering={enter(7)} style={s.bigStat}>
                    {t('onboarding.spiral.total', { m: 45 })}
                </Animated.Text>
                <Animated.Text entering={enter(7)} style={s.statCaption}>
                    {t('onboarding.spiral.caption')}
                </Animated.Text>
                <View style={s.columns}>
                    {snoozes.map(n => (
                        <View key={n} style={s.column}>
                            <View style={s.columnTrack}>
                                <Grow
                                    axis="height"
                                    to={n / 5}
                                    delay={250 + n * 140}
                                    style={[s.columnFill, n === 5 && { backgroundColor: Colors.danger }]}
                                />
                            </View>
                            <Text style={s.columnLabel}>{`${n}×`}</Text>
                        </View>
                    ))}
                </View>
            </Animated.View>
            <Animated.Text entering={enter(3)} style={[kit.sub, s.gapTop]}>
                {t('onboarding.spiral.body')}
            </Animated.Text>
            {answers.pains.length > 0 && (
                <Animated.View entering={enter(4)} style={s.gapTop}>
                    <Text style={s.eyebrow}>{t('onboarding.spiral.youSaid')}</Text>
                    {answers.pains.slice(0, 3).map(p => (
                        <Text key={p} style={s.quote}>“{t(`onboarding.pains.${p}`)}”</Text>
                    ))}
                </Animated.View>
            )}
        </Page>
    );
}

type Icon = ComponentProps<typeof Ionicons>['name'];

/** Result graphic: the whole wake-up as a timeline, line drawing down as each beat appears. */
function Result({ next }: StepProps) {
    const { t } = useLocale();
    const beats: [Icon, string, string, string][] = [
        ['alarm', t('onboarding.result.ring'), t('onboarding.result.ringNote'), '0:00'],
        ['footsteps', t('onboarding.result.walk', { count: DEFAULT_STEPS }), t('onboarding.result.walkNote'), '0:40'],
        ['calculator', t('onboarding.result.math'), t('onboarding.result.mathNote'), '1:40'],
        ['sunny', t('onboarding.result.up'), t('onboarding.result.upNote'), '2:00'],
    ];
    return (
        <Page footer={<Cta label={t('onboarding.continue')} onPress={next} />}>
            <Title title={t('onboarding.result.title')} />
            <View style={s.timeline}>
                <View style={s.lineTrack}>
                    <Grow axis="height" to={1} delay={200} style={s.lineFill} />
                </View>
                {beats.map(([icon, title, note, at], i) => {
                    const last = i === beats.length - 1;
                    return (
                        <Animated.View key={icon} entering={enter(1 + i * 2)} style={s.beat}>
                            <View style={[s.beatDot, last && s.beatDotLast]}>
                                <Ionicons name={icon} size={20} color={last ? Colors.onAccent : Colors.white} />
                            </View>
                            <View style={s.beatText}>
                                <Text style={s.beatTitle}>{title}</Text>
                                <Text style={s.beatNote}>{note}</Text>
                            </View>
                            <Text style={s.beatAt}>{at}</Text>
                        </Animated.View>
                    );
                })}
            </View>
        </Page>
    );
}

type Mark = 'yes' | 'some' | 'no';
const COMPARE: [string, Mark, Mark, Mark][] = [
    ['snooze', 'no', 'some', 'yes'],
    ['bed', 'no', 'some', 'yes'],
    ['brain', 'no', 'yes', 'yes'],
    ['check', 'no', 'some', 'yes'],
    ['harder', 'no', 'no', 'yes'],
];
const score = (col: 1 | 2 | 3) =>
    COMPARE.reduce((sum, row) => sum + (row[col] === 'yes' ? 1 : row[col] === 'some' ? 0.5 : 0), 0) / COMPARE.length;

function MarkIcon({ mark }: { mark: Mark }) {
    if (mark === 'yes') return <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />;
    if (mark === 'some') return <Ionicons name="contrast" size={18} color={Colors.ink400} />;
    return <Ionicons name="close" size={18} color={Colors.ink200} />;
}

/** Comparison: score bars (from the table below), then the feature table. */
function Compare({ next }: StepProps) {
    const { t } = useLocale();
    const apps = [
        { name: t('onboarding.compare.phone'), score: score(1), color: Colors.ink200 },
        { name: t('onboarding.compare.others'), score: score(2), color: Colors.blue200 },
        { name: t('onboarding.compare.wakey'), score: score(3), color: Colors.primary },
    ];
    return (
        <Page footer={<Cta label={t('onboarding.continue')} onPress={next} />}>
            <Title title={t('onboarding.compare.title')} />
            <Animated.View entering={enter(1)} style={s.card}>
                <Text style={s.eyebrow}>{t('onboarding.compare.chart')}</Text>
                {apps.map((app, i) => (
                    <View key={app.name} style={s.hRow}>
                        <Text style={[s.hLabel, i === 2 && s.hLabelWakey]}>{app.name}</Text>
                        <View style={s.hTrack}>
                            <Grow to={Math.max(app.score, 0.04)} delay={300 + i * 180} style={[s.hFill, { backgroundColor: app.color }]} />
                        </View>
                    </View>
                ))}
            </Animated.View>

            <Animated.View entering={enter(3)} style={[s.card, s.table]}>
                <View style={s.wakeyCol} />
                <View style={s.tRow}>
                    <View style={s.tFeature} />
                    {apps.map((app, i) => (
                        <Text key={app.name} style={[s.tHead, i === 2 && s.tHeadWakey]} numberOfLines={3}>
                            {app.name}
                        </Text>
                    ))}
                </View>
                {COMPARE.map(([id, ...marks], r) => (
                    <Animated.View key={id} entering={enter(4 + r)} style={[s.tRow, r > 0 && s.tDivider]}>
                        <Text style={s.tFeature}>{t(`onboarding.compare.${id}`)}</Text>
                        {marks.map((m, i) => (
                            <View key={i} style={s.tCell}>
                                <MarkIcon mark={m} />
                            </View>
                        ))}
                    </Animated.View>
                ))}
            </Animated.View>
            <Text style={s.footnote}>{t('onboarding.compare.note')}</Text>
        </Page>
    );
}

/** Try the real game: 10 steps, then one sum. */
function Game({ next }: StepProps) {
    const { t } = useLocale();
    const [phase, setPhase] = useState<'intro' | 'walk' | 'math' | 'won'>('intro');

    if (phase === 'walk' || phase === 'math') {
        return (
            <View style={kit.page}>
                <Animated.View entering={FadeIn.duration(300)} style={s.gamePanel}>
                    <Animated.View key={phase} entering={enter(0)} style={s.gameBody}>
                        {phase === 'walk' ? (
                            <WalkMission goal={10} onFirstStep={() => {}} onDone={() => setPhase('math')} />
                        ) : (
                            <MathMission level={0} count={1} onDone={() => setPhase('won')} />
                        )}
                    </Animated.View>
                </Animated.View>
                {/* People trying it in bed left here; let them go straight to the sum. */}
                {phase === 'walk' && (
                    <View style={s.skipWalk}>
                        <TextButton
                            label={t('onboarding.game.skipWalk')}
                            onPress={() => {
                                posthog.capture('onboarding_walk_skipped');
                                setPhase('math');
                            }}
                        />
                    </View>
                )}
            </View>
        );
    }

    const won = phase === 'won';
    return (
        <Page
            footer={
                won ? (
                    <Cta label={t('onboarding.continue')} onPress={next} />
                ) : (
                    <Cta label={t('onboarding.game.start')} onPress={() => setPhase('walk')} />
                )
            }
        >
            <Title title={won ? t('onboarding.game.win') : t('onboarding.game.title')} sub={won ? t('onboarding.game.winBody') : t('onboarding.game.body')} />
            <Animated.View key={phase} entering={enter(2)} style={s.bluePanel}>
                <Mascot mood={won ? 'happy' : 'shake'} size={170} />
                {!won && (
                    <View style={s.gameSteps}>
                        <View style={s.gamePill}>
                            <Ionicons name="footsteps" size={15} color={Colors.white} />
                            <Text style={s.gamePillText}>10</Text>
                        </View>
                        <Ionicons name="arrow-forward" size={16} color={Colors.blue200} />
                        <View style={s.gamePill}>
                            <Ionicons name="calculator" size={15} color={Colors.white} />
                            <Text style={s.gamePillText}>1</Text>
                        </View>
                    </View>
                )}
            </Animated.View>
            {!won && (
                <Animated.View entering={enter(3)} style={s.note}>
                    <Ionicons name="phone-portrait-outline" size={18} color={Colors.ink500} />
                    <Text style={s.noteText}>{t('onboarding.game.motion')}</Text>
                </Animated.View>
            )}
        </Page>
    );
}

/* ───────────── One setting per step ───────────── */

const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad(i));

function Time({ draft, set, next }: StepProps) {
    const { t } = useLocale();
    const at = new Date();
    at.setHours(draft.hours, draft.minutes, 0, 0);
    if (at <= new Date()) at.setDate(at.getDate() + 1);
    const beds = bedtimes(at, new Date());
    const suggested = beds.find(b => !b.passed);
    return (
        <Page footer={<Cta label={t('onboarding.continue')} onPress={next} />}>
            <Title title={t('onboarding.time.title')} />
            <Animated.View entering={enter(1)} style={s.wheels}>
                <View style={s.band} pointerEvents="none" />
                <WheelPicker data={HOURS} selectedIndex={draft.hours} onIndexChange={hours => set({ hours })} style={s.wheel} />
                <Text style={s.colon}>:</Text>
                <WheelPicker data={MINUTES} selectedIndex={draft.minutes} onIndexChange={minutes => set({ minutes })} style={s.wheel} />
            </Animated.View>
            <Animated.View entering={enter(2)} style={s.card}>
                <Text style={[s.eyebrow, s.center]}>{t('edit.bedBy')}</Text>
                <View style={s.beds}>
                    {beds.map(b => (
                        <View key={b.cycles} style={[s.bed, b === suggested && s.bedOn, b.passed && s.faded]}>
                            <Text style={[s.bedTime, b === suggested && s.bedTimeOn]}>{hm(b.at)}</Text>
                            <Text style={s.bedHours}>{t('edit.sleepHours', { h: b.cycles * 1.5 })}</Text>
                        </View>
                    ))}
                </View>
            </Animated.View>
        </Page>
    );
}

const PRESETS: [string, boolean[]][] = [
    ['edit.weekdays', [false, true, true, true, true, true, false]],
    ['edit.everyDay', Array(7).fill(true)],
    ['edit.weekends', [true, false, false, false, false, false, true]],
];

function Days({ draft, set, next }: StepProps) {
    const { t } = useLocale();
    // Monday first.
    const order = [1, 2, 3, 4, 5, 6, 0];
    return (
        <Page footer={<Cta label={t('onboarding.continue')} onPress={next} />}>
            <Title title={t('onboarding.days.title')} sub={daysText(draft.days, t)} />
            <Animated.View entering={enter(2)} style={s.dayRow}>
                {order.map(i => {
                    const on = draft.days[i];
                    return (
                        <Pressable
                            key={i}
                            onPress={() => {
                                tap();
                                set({ days: draft.days.map((d, j) => (j === i ? !d : d)) });
                            }}
                            style={[s.day, on && s.dayOn]}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: on }}
                            accessibilityLabel={strings().days.short[i]}
                        >
                            <Text style={[s.dayText, on && s.dayTextOn]}>{strings().days.letter[i]}</Text>
                        </Pressable>
                    );
                })}
            </Animated.View>
            <Animated.View entering={enter(3)} style={s.chips}>
                {PRESETS.map(([key, days]) => {
                    const on = draft.days.join() === days.join();
                    return (
                        <Pressable
                            key={key}
                            onPress={() => {
                                tap();
                                set({ days });
                            }}
                            style={[s.chip, on && s.chipOn]}
                            accessibilityRole="button"
                            accessibilityState={{ selected: on }}
                        >
                            <Text style={[s.chipText, on && s.chipTextOn]}>{t(key)}</Text>
                        </Pressable>
                    );
                })}
            </Animated.View>
        </Page>
    );
}

function Steps({ draft, set, next }: StepProps) {
    const { t } = useLocale();
    return (
        <Page footer={<Cta label={t('onboarding.continue')} onPress={next} />}>
            <Title title={t('onboarding.steps.title')} />
            {STEP_OPTIONS.map((n, i) => (
                <Option
                    key={n}
                    index={i}
                    emoji="👣"
                    label={t('edit.stepsValue', { count: n })}
                    note={t(`onboarding.steps.note${n}`)}
                    badge={n === DEFAULT_STEPS ? t('onboarding.steps.recommended') : undefined}
                    selected={draft.steps === n}
                    onPress={() => set({ steps: n })}
                />
            ))}
        </Page>
    );
}

function MathStep({ draft, set, next }: StepProps) {
    const { t } = useLocale();
    const examples = useMemo(() => MATH_LEVELS.map(l => makeProblem(l).text), []);
    return (
        <Page footer={<Cta label={t('onboarding.continue')} onPress={next} />}>
            <Title title={t('onboarding.math.title')} />
            {MATH_LEVELS.map((level, i) => (
                <Option
                    key={level}
                    index={i}
                    emoji={level === 2 ? '🤯' : '🙂'}
                    label={t(`edit.mathLevel_${level}`)}
                    note={t('onboarding.math.example', { problem: examples[i] })}
                    selected={draft.mathLevel === level}
                    onPress={() => set({ mathLevel: level })}
                />
            ))}
        </Page>
    );
}

function Sound({ draft, set, next }: StepProps) {
    const { t } = useLocale();
    useEffect(() => () => void stopAlarmSound(), []);
    return (
        <Page footer={<Cta label={t('onboarding.continue')} onPress={next} />}>
            <Title title={t('onboarding.sound.title')} sub={t('onboarding.sound.body')} />
            {BUNDLED_SOUNDS.map((sound, i) => (
                <Option
                    key={sound.id}
                    index={i}
                    emoji="🔔"
                    label={getSoundName(sound.id)}
                    selected={draft.soundId === sound.id}
                    onPress={() => {
                        set({ soundId: sound.id });
                        previewSound(sound.id);
                    }}
                    right={
                        <Ionicons
                            name={draft.soundId === sound.id ? 'volume-high' : 'play-circle-outline'}
                            size={24}
                            color={draft.soundId === sound.id ? Colors.primary : Colors.ink400}
                        />
                    }
                />
            ))}
        </Page>
    );
}

function Check({ draft, set, next }: StepProps) {
    const { t } = useLocale();
    return (
        <Page footer={<Cta label={t('onboarding.continue')} onPress={next} />}>
            <Title title={t('onboarding.check.title')} sub={t('onboarding.check.body')} />
            <Option index={0} emoji="✅" label={t('onboarding.check.yes')} badge={t('onboarding.steps.recommended')} selected={draft.wakeCheck} onPress={() => set({ wakeCheck: true })} />
            <Option index={1} emoji="🙅" label={t('onboarding.check.no')} selected={!draft.wakeCheck} onPress={() => set({ wakeCheck: false })} />
        </Page>
    );
}

function Label({ draft, set, next }: StepProps) {
    const { t } = useLocale();
    return (
        <Page footer={<Cta label={t('onboarding.continue')} onPress={next} />}>
            <Title title={t('onboarding.label.title')} />
            <Animated.View entering={enter(1)}>
                <TextInput
                    value={draft.label}
                    onChangeText={label => set({ label: label.slice(0, 16) })}
                    maxLength={16}
                    placeholder={t('edit.labelPlaceholder')}
                    placeholderTextColor={Colors.ink400}
                    style={s.input}
                    returnKeyType="done"
                    onSubmitEditing={next}
                    accessibilityLabel={t('edit.label')}
                />
            </Animated.View>
            <Animated.View entering={enter(2)} style={s.chips}>
                {strings().onboarding.label.suggestions.map(name => (
                    <Pressable
                        key={name}
                        onPress={() => {
                            tap();
                            set({ label: name });
                        }}
                        style={[s.chip, draft.label === name && s.chipOn]}
                        accessibilityRole="button"
                    >
                        <Text style={[s.chipText, draft.label === name && s.chipTextOn]}>{name}</Text>
                    </Pressable>
                ))}
            </Animated.View>
        </Page>
    );
}

/** Last step: either button saves the alarm and moves on to the personalizing screen. */
function Notify({ finish }: StepProps) {
    const { t } = useLocale();
    const [asking, setAsking] = useState(false);
    const allow = async () => {
        setAsking(true);
        await requestNotificationPermissions();
        await finish();
    };
    const bullets: [Icon, string][] = [
        ['alarm-outline', t('onboarding.notify.b1')],
        ['repeat', t('onboarding.notify.b2')],
        ['shield-checkmark-outline', t('onboarding.notify.b3')],
    ];
    return (
        <Page
            footer={
                <>
                    <Cta label={t('onboarding.notify.allow')} onPress={allow} loading={asking} />
                    <TextButton label={t('onboarding.notify.notNow')} onPress={finish} />
                </>
            }
        >
            <Animated.View entering={enter(0)} style={s.hero}>
                <Mascot mood="alarm" size={150} />
            </Animated.View>
            <Title title={t('onboarding.notify.title')} />
            {bullets.map(([icon, text], i) => (
                <Animated.View key={icon} entering={enter(2 + i)} style={s.bullet}>
                    <View style={s.bulletIcon}>
                        <Ionicons name={icon} size={18} color={Colors.primary} />
                    </View>
                    <Text style={s.bulletText}>{text}</Text>
                </Animated.View>
            ))}
        </Page>
    );
}

export const VIEWS: Record<StepId, (p: StepProps) => JSX.Element> = {
    welcome: Welcome,
    goal: Goal,
    pains: Pains,
    spiral: Spiral,
    result: Result,
    compare: Compare,
    game: Game,
    time: Time,
    days: Days,
    steps: Steps,
    math: MathStep,
    sound: Sound,
    check: Check,
    label: Label,
    notify: Notify,
};

// Keep the page exit in one place so every step leaves the same way.
export const pageExit = FadeOut.duration(140);

const s = StyleSheet.create({
    center: { textAlign: 'center' },
    big: { fontSize: 34, lineHeight: 40, marginBottom: Spacing.md },
    gapTop: { marginTop: Spacing.xl },
    faded: { opacity: 0.4 },

    hero: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl },
    heroGlow: {
        width: 280,
        height: 280,
        borderRadius: 140,
        backgroundColor: Colors.blue50,
        alignItems: 'center',
        justifyContent: 'center',
    },

    card: {
        backgroundColor: Colors.white,
        borderRadius: BorderRadius.xl,
        padding: Spacing.xl,
        ...Shadow.md,
    },
    eyebrow: {
        fontFamily: FontFamily.bodyBlack,
        fontSize: FontSize.xs,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: Colors.ink400,
        marginBottom: Spacing.md,
    },
    quote: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.ink700, marginBottom: Spacing.xs },

    bigStat: { fontFamily: FontFamily.displayBold, fontSize: 52, letterSpacing: -1.5, color: Colors.danger },
    statCaption: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.ink500, marginBottom: Spacing.xl },
    columns: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.md, height: 150 },
    column: { flex: 1, height: '100%', alignItems: 'center', gap: Spacing.sm },
    columnTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', borderRadius: BorderRadius.sm, backgroundColor: Colors.ink100, overflow: 'hidden' },
    columnFill: { width: '100%', borderRadius: BorderRadius.sm, backgroundColor: Colors.blue300 },
    columnLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.ink500 },

    timeline: { paddingLeft: 2 },
    lineTrack: { position: 'absolute', left: 22, top: 22, bottom: 70, width: 3, borderRadius: 2, backgroundColor: Colors.ink100 },
    lineFill: { width: '100%', borderRadius: 2, backgroundColor: Colors.primary },
    beat: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, marginBottom: Spacing['5xl'] },
    beatDot: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        ...Shadow.blue,
    },
    beatDotLast: { backgroundColor: Colors.accent },
    beatText: { flex: 1, gap: 2 },
    beatTitle: { fontFamily: FontFamily.bodyBlack, fontSize: FontSize.lg, color: Colors.ink900 },
    beatNote: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.ink500 },
    beatAt: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.ink400, fontVariant: ['tabular-nums'] },

    hRow: { marginBottom: Spacing.md, gap: 6 },
    hLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.ink500 },
    hLabelWakey: { color: Colors.primary, fontFamily: FontFamily.bodyBlack },
    hTrack: { height: 14, borderRadius: 7, backgroundColor: Colors.ink100, overflow: 'hidden' },
    hFill: { height: '100%', borderRadius: 7 },

    table: { marginTop: Spacing.lg, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    wakeyCol: {
        position: 'absolute',
        right: Spacing.lg - 4,
        top: 6,
        bottom: 6,
        width: 64,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.blue50,
    },
    tRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
    tDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.ink200 },
    tFeature: { flex: 1, fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.ink700, paddingRight: Spacing.sm },
    tHead: { width: 56, textAlign: 'center', fontFamily: FontFamily.bodyBold, fontSize: 11, lineHeight: 13, color: Colors.ink400 },
    tHeadWakey: { color: Colors.primary, fontFamily: FontFamily.bodyBlack, fontSize: FontSize.sm },
    tCell: { width: 56, alignItems: 'center' },
    footnote: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.ink400, marginTop: Spacing.md, textAlign: 'center' },

    bluePanel: {
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius['2xl'],
        alignItems: 'center',
        paddingVertical: Spacing['3xl'],
        gap: Spacing.lg,
        ...Shadow.blue,
    },
    gameSteps: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    gamePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
        borderRadius: BorderRadius.pill,
        backgroundColor: 'rgba(255,255,255,0.16)',
    },
    gamePillText: { fontFamily: FontFamily.bodyBlack, fontSize: FontSize.sm, color: Colors.white },
    gamePanel: {
        flex: 1,
        margin: Spacing.md,
        marginTop: 0,
        borderRadius: BorderRadius['2xl'],
        backgroundColor: '#F3F5F8', // the white wake-up flow's Mist (constants/white.ts)
        paddingBottom: Spacing.md,
        overflow: 'hidden',
    },
    gameBody: { flex: 1, justifyContent: 'space-between' },
    skipWalk: { paddingBottom: Spacing.md },
    note: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xl, paddingHorizontal: Spacing.xs },
    noteText: { flex: 1, fontFamily: FontFamily.body, fontSize: FontSize.sm, lineHeight: 20, color: Colors.ink500 },

    wheels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginBottom: Spacing.xxl },
    wheel: { width: 96 },
    band: { position: 'absolute', left: 0, right: 0, top: '50%', height: 44, marginTop: -22, borderRadius: 12, backgroundColor: Colors.ink100 },
    colon: { fontFamily: FontFamily.displayBold, fontSize: 40, color: Colors.ink900 },
    beds: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm },
    bed: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderRadius: BorderRadius.md },
    bedOn: { backgroundColor: Colors.blue50 },
    bedTime: { fontFamily: FontFamily.bodyBlack, fontSize: FontSize.lg, color: Colors.ink700, fontVariant: ['tabular-nums'] },
    bedTimeOn: { color: Colors.primary },
    bedHours: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.ink400 },

    dayRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xxl },
    day: {
        width: 42,
        height: 42,
        borderRadius: 21,
        borderWidth: 1.5,
        borderColor: Colors.ink100,
        backgroundColor: Colors.white,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    dayText: { fontFamily: FontFamily.bodyBlack, fontSize: FontSize.md, color: Colors.ink500 },
    dayTextOn: { color: Colors.white },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm + 2,
        borderRadius: BorderRadius.pill,
        borderWidth: 1.5,
        borderColor: Colors.ink100,
        backgroundColor: Colors.white,
    },
    chipOn: { borderColor: Colors.primary, backgroundColor: Colors.blue50 },
    chipText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.ink700 },
    chipTextOn: { color: Colors.blue700 },

    input: {
        fontFamily: FontFamily.displayBold,
        fontSize: 28,
        letterSpacing: -0.5,
        color: Colors.ink900,
        paddingVertical: Spacing.md,
        borderBottomWidth: 2,
        borderBottomColor: Colors.primary,
        marginBottom: Spacing.xl,
    },

    bullet: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
    bulletIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.blue50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bulletText: { flex: 1, fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, lineHeight: 22, color: Colors.ink700 },

});
