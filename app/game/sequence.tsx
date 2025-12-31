import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { recordAlarmCompletion } from '@/utils/rating';
import { stopAlarmSound } from '@/utils/sounds';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Accelerometer, AccelerometerMeasurement } from 'expo-sensors';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Pressable,
    StyleSheet,
    Text,
    Vibration,
    View
} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Game stages in order
type GameStage = 'shake' | 'arithmetic' | 'moveAround' | 'pickLargest' | 'turnOnLight' | 'complete';

const STAGES: GameStage[] = ['shake', 'arithmetic', 'moveAround', 'pickLargest', 'turnOnLight', 'complete'];

// Difficulty levels for arithmetic and pick largest
type Difficulty = 'easy' | 'medium' | 'hard';

interface ArithmeticProblem {
    question: string;
    answer: number;
    choices: number[];
    difficulty: Difficulty;
}

interface PickLargestProblem {
    numbers: number[];
    answer: number;
    difficulty: Difficulty;
}

// Generate wrong answers that are close to the correct answer
const generateWrongAnswers = (correctAnswer: number, count: number): number[] => {
    const wrongAnswers: number[] = [];
    const usedAnswers = new Set<number>([correctAnswer]);

    while (wrongAnswers.length < count) {
        // Generate wrong answer within a reasonable range of the correct answer
        const variance = Math.max(10, Math.abs(correctAnswer) * 0.3);
        let wrong = correctAnswer + Math.floor((Math.random() - 0.5) * 2 * variance);

        // Ensure wrong answer is different and positive
        if (wrong <= 0) wrong = Math.abs(wrong) + 1;
        if (!usedAnswers.has(wrong)) {
            usedAnswers.add(wrong);
            wrongAnswers.push(wrong);
        }
    }

    return wrongAnswers;
};

// Shuffle array using Fisher-Yates algorithm
const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

// Generate arithmetic problem based on difficulty with complex algebra
const generateArithmeticProblem = (difficulty: Difficulty): ArithmeticProblem => {
    let question: string;
    let answer: number;

    switch (difficulty) {
        case 'easy': {
            // Simple two-number operations: a + b or a - b or a × b
            const a = Math.floor(Math.random() * 20) + 5; // 5-24
            const b = Math.floor(Math.random() * 15) + 2; // 2-16
            const op = Math.random();
            if (op < 0.33) {
                question = `${a} + ${b}`;
                answer = a + b;
            } else if (op < 0.66) {
                const [large, small] = a > b ? [a, b] : [b, a];
                question = `${large} - ${small}`;
                answer = large - small;
            } else {
                const x = Math.floor(Math.random() * 9) + 2; // 2-10
                const y = Math.floor(Math.random() * 9) + 2;
                question = `${x} × ${y}`;
                answer = x * y;
            }
            break;
        }
        case 'medium': {
            // Three operations: a × b + c or a + b × c or (a + b) × c
            const patterns = [
                () => {
                    const a = Math.floor(Math.random() * 10) + 2;
                    const b = Math.floor(Math.random() * 10) + 2;
                    const c = Math.floor(Math.random() * 20) + 5;
                    return { q: `${a} × ${b} + ${c}`, a: a * b + c };
                },
                () => {
                    const a = Math.floor(Math.random() * 30) + 10;
                    const b = Math.floor(Math.random() * 8) + 2;
                    const c = Math.floor(Math.random() * 8) + 2;
                    return { q: `${a} + ${b} × ${c}`, a: a + b * c };
                },
                () => {
                    const a = Math.floor(Math.random() * 15) + 5;
                    const b = Math.floor(Math.random() * 15) + 5;
                    const c = Math.floor(Math.random() * 6) + 2;
                    return { q: `(${a} + ${b}) × ${c}`, a: (a + b) * c };
                },
                () => {
                    const divisor = Math.floor(Math.random() * 8) + 2;
                    const quotient = Math.floor(Math.random() * 15) + 5;
                    const a = divisor * quotient;
                    const c = Math.floor(Math.random() * 20) + 5;
                    return { q: `${a} ÷ ${divisor} + ${c}`, a: quotient + c };
                },
            ];
            const pattern = patterns[Math.floor(Math.random() * patterns.length)]();
            question = pattern.q;
            answer = pattern.a;
            break;
        }
        case 'hard': {
            // Complex algebra: 120*(4/2)+12+2, with parentheses and multiple operations
            const patterns = [
                () => {
                    const base = Math.floor(Math.random() * 100) + 50; // 50-149
                    const divTop = Math.floor(Math.random() * 6) + 2; // 2-7
                    const divBot = Math.floor(Math.random() * 3) + 1; // 1-3
                    const mult = divTop / divBot;
                    const add1 = Math.floor(Math.random() * 20) + 5;
                    const add2 = Math.floor(Math.random() * 10) + 1;
                    return {
                        q: `${base} × (${divTop * divBot}/${divBot}) + ${add1} + ${add2}`,
                        a: base * (divTop) + add1 + add2
                    };
                },
                () => {
                    const a = Math.floor(Math.random() * 50) + 30;
                    const b = Math.floor(Math.random() * 30) + 10;
                    const c = Math.floor(Math.random() * 6) + 2;
                    const d = Math.floor(Math.random() * 5) + 2;
                    return { q: `(${a} + ${b}) ÷ ${c} × ${d}`, a: Math.floor((a + b) / c) * d };
                },
                () => {
                    const mult = Math.floor(Math.random() * 15) + 5;
                    const divisor = Math.floor(Math.random() * 4) + 2;
                    const dividend = divisor * (Math.floor(Math.random() * 10) + 2);
                    const add = Math.floor(Math.random() * 50) + 20;
                    const sub = Math.floor(Math.random() * 15) + 5;
                    return {
                        q: `${mult} × (${dividend}/${divisor}) + ${add} - ${sub}`,
                        a: mult * (dividend / divisor) + add - sub
                    };
                },
                () => {
                    const a = Math.floor(Math.random() * 8) + 2;
                    const b = Math.floor(Math.random() * 8) + 2;
                    const c = Math.floor(Math.random() * 20) + 10;
                    const d = Math.floor(Math.random() * 10) + 5;
                    return { q: `${a} × ${b} + ${c} × ${d}`, a: a * b + c * d };
                },
                () => {
                    const base = Math.floor(Math.random() * 80) + 40;
                    const mult = Math.floor(Math.random() * 5) + 2;
                    const div = Math.floor(Math.random() * 4) + 2;
                    const innerMult = div * (Math.floor(Math.random() * 5) + 2);
                    const add = Math.floor(Math.random() * 30) + 10;
                    return {
                        q: `${base} × (${innerMult}/${div}) + ${add}`,
                        a: base * (innerMult / div) + add
                    };
                },
            ];
            const pattern = patterns[Math.floor(Math.random() * patterns.length)]();
            question = pattern.q;
            answer = Math.round(pattern.a); // Ensure integer answer
            break;
        }
    }

    // Generate 3 wrong answers and shuffle with correct answer
    const wrongAnswers = generateWrongAnswers(answer, 3);
    const choices = shuffleArray([answer, ...wrongAnswers]);

    return {
        question,
        answer,
        choices,
        difficulty,
    };
};

// Generate pick largest problem based on difficulty - always 4 choices
const generatePickLargestProblem = (difficulty: Difficulty): PickLargestProblem => {
    let max: number;
    const count = 4; // Always 4 choices

    switch (difficulty) {
        case 'easy':
            max = 100;
            break;
        case 'medium':
            max = 500;
            break;
        case 'hard':
            max = 1000;
            break;
    }

    const numbers: number[] = [];
    while (numbers.length < count) {
        const num = Math.floor(Math.random() * max) + 1;
        if (!numbers.includes(num)) {
            numbers.push(num);
        }
    }

    return {
        numbers,
        answer: Math.max(...numbers),
        difficulty,
    };
};

export default function SequenceGame() {
    // Stage management
    const [currentStageIndex, setCurrentStageIndex] = useState(0);
    const currentStage = STAGES[currentStageIndex];

    // Shake game state
    const [shakeTimeRemaining, setShakeTimeRemaining] = useState(20);
    const [isShaking, setIsShaking] = useState(false);
    const shakeSubscription = useRef<ReturnType<typeof Accelerometer.addListener> | null>(null);
    const lastShakeTime = useRef(0);
    const lastShakeDetectedTime = useRef(0); // Track when last shake was detected for countdown logic

    // Arithmetic game state
    const [arithmeticProblems, setArithmeticProblems] = useState<ArithmeticProblem[]>([]);
    const [currentArithmeticIndex, setCurrentArithmeticIndex] = useState(0);
    const [selectedArithmeticChoice, setSelectedArithmeticChoice] = useState<number | null>(null);
    const [arithmeticError, setArithmeticError] = useState(false);

    // Move around state
    const [moveAroundTime, setMoveAroundTime] = useState(15);

    // Pick largest game state
    const [pickLargestProblems, setPickLargestProblems] = useState<PickLargestProblem[]>([]);
    const [currentPickLargestIndex, setCurrentPickLargestIndex] = useState(0);
    const [pickLargestError, setPickLargestError] = useState(false);

    // Turn on light state
    const [turnOnLightTime, setTurnOnLightTime] = useState(15);

    // Confetti
    const [showConfetti, setShowConfetti] = useState(false);
    const confettiRef = useRef<any>(null);

    // Animation
    const progressAnim = useRef(new Animated.Value(0)).current;

    // Haptic feedback for correct answers
    const playCorrectSound = useCallback(async () => {
        try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Vibration.vibrate(100); // Short vibration pulse
        } catch (e) {
            console.log('Haptics error:', e);
        }
    }, []);

    const playStageCompleteSound = useCallback(async () => {
        try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            // Vibration pattern: vibrate 200ms, pause 100ms, vibrate 200ms
            Vibration.vibrate([0, 200, 100, 200]);
        } catch (e) {
            console.log('Haptics error:', e);
        }
    }, []);

    // Initialize problems on mount
    useEffect(() => {
        const arithmeticProbs: ArithmeticProblem[] = [
            generateArithmeticProblem('easy'),
            generateArithmeticProblem('medium'),
            generateArithmeticProblem('hard'),
        ];
        setArithmeticProblems(arithmeticProbs);

        const pickLargestProbs: PickLargestProblem[] = [
            generatePickLargestProblem('easy'),
            generatePickLargestProblem('medium'),
            generatePickLargestProblem('hard'),
        ];
        setPickLargestProblems(pickLargestProbs);

        return () => {
            if (shakeSubscription.current) {
                shakeSubscription.current.remove();
            }
        };
    }, []);

    // Move to next stage
    const advanceToNextStage = useCallback(() => {
        playStageCompleteSound();
        setShowConfetti(true);
        setTimeout(() => {
            setShowConfetti(false);
            setCurrentStageIndex(prev => prev + 1);
        }, 1500);
    }, [playStageCompleteSound]);

    // Complete all games
    const handleComplete = useCallback(async () => {
        stopAlarmSound();
        // Record completion for rating dialog
        await recordAlarmCompletion();
        router.replace('/');
    }, []);

    // ========== SHAKE GAME ==========
    useEffect(() => {
        if (currentStage !== 'shake') return;

        const SHAKE_THRESHOLD = 1.5;
        const SHAKE_WINDOW_MS = 300; // Time window to consider as "still shaking"
        let timerInterval: ReturnType<typeof setInterval>;
        let isComplete = false;

        const handleMotion = (data: AccelerometerMeasurement) => {
            if (isComplete) return;

            const totalAcceleration = Math.sqrt(
                data.x * data.x + data.y * data.y + data.z * data.z
            );

            if (totalAcceleration > SHAKE_THRESHOLD) {
                const now = Date.now();
                if (now - lastShakeTime.current > 100) {
                    lastShakeTime.current = now;
                    lastShakeDetectedTime.current = now; // Update last shake detected time
                    setIsShaking(true);
                    setTimeout(() => setIsShaking(false), 100);
                }
            }
        };

        Accelerometer.setUpdateInterval(50);
        shakeSubscription.current = Accelerometer.addListener(handleMotion);

        timerInterval = setInterval(() => {
            const now = Date.now();
            const timeSinceLastShake = now - lastShakeDetectedTime.current;

            // Only countdown if user is actively shaking (shook within the last SHAKE_WINDOW_MS)
            if (timeSinceLastShake <= SHAKE_WINDOW_MS) {
                setShakeTimeRemaining(prev => {
                    if (prev <= 1) {
                        isComplete = true;
                        clearInterval(timerInterval);
                        shakeSubscription.current?.remove();
                        setTimeout(() => advanceToNextStage(), 500);
                        return 0;
                    }
                    return prev - 1;
                });
            }
            // If not shaking, timer pauses (does not decrement)
        }, 1000);

        return () => {
            clearInterval(timerInterval);
            shakeSubscription.current?.remove();
        };
    }, [currentStage, advanceToNextStage]);

    // ========== ARITHMETIC GAME ==========
    const handleArithmeticChoice = useCallback((selectedAnswer: number) => {
        const currentProblem = arithmeticProblems[currentArithmeticIndex];
        if (!currentProblem) return;

        setSelectedArithmeticChoice(selectedAnswer);

        if (selectedAnswer === currentProblem.answer) {
            playCorrectSound();
            setArithmeticError(false);

            setTimeout(() => {
                setSelectedArithmeticChoice(null);
                if (currentArithmeticIndex >= 2) {
                    advanceToNextStage();
                } else {
                    setCurrentArithmeticIndex(prev => prev + 1);
                }
            }, 300);
        } else {
            setArithmeticError(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setTimeout(() => {
                setArithmeticError(false);
                setSelectedArithmeticChoice(null);
            }, 500);
        }
    }, [arithmeticProblems, currentArithmeticIndex, advanceToNextStage, playCorrectSound]);

    // ========== MOVE AROUND (STATIC) ==========
    useEffect(() => {
        if (currentStage !== 'moveAround') return;

        const interval = setInterval(() => {
            setMoveAroundTime(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    setTimeout(() => advanceToNextStage(), 500);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [currentStage, advanceToNextStage]);

    // ========== PICK LARGEST GAME ==========
    const handlePickLargest = useCallback((selectedNumber: number) => {
        const currentProblem = pickLargestProblems[currentPickLargestIndex];
        if (!currentProblem) return;

        if (selectedNumber === currentProblem.answer) {
            playCorrectSound();
            setPickLargestError(false);

            if (currentPickLargestIndex >= 2) {
                advanceToNextStage();
            } else {
                setCurrentPickLargestIndex(prev => prev + 1);
            }
        } else {
            setPickLargestError(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setTimeout(() => setPickLargestError(false), 500);
        }
    }, [pickLargestProblems, currentPickLargestIndex, advanceToNextStage, playCorrectSound]);

    // ========== TURN ON LIGHT (STATIC) ==========
    useEffect(() => {
        if (currentStage !== 'turnOnLight') return;

        const interval = setInterval(() => {
            setTurnOnLightTime(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    // Show final confetti and complete
                    setShowConfetti(true);
                    setTimeout(() => {
                        handleComplete();
                    }, 2000);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [currentStage, handleComplete]);

    // Render progress indicator
    const renderProgress = () => {
        const stageNumber = currentStageIndex + 1;
        const totalStages = STAGES.length - 1; // Exclude 'complete'

        return (
            <View style={styles.progressContainer}>
                <Text style={styles.progressText}>
                    Step {stageNumber} of {totalStages}
                </Text>
                <View style={styles.progressBar}>
                    <View
                        style={[
                            styles.progressFill,
                            { width: `${(stageNumber / totalStages) * 100}%` }
                        ]}
                    />
                </View>
            </View>
        );
    };

    // ========== RENDER STAGES ==========
    const renderShakeStage = () => (
        <View style={styles.stageContainer}>
            <Ionicons
                name="phone-portrait-outline"
                size={80}
                color={isShaking ? Colors.success : Colors.textSecondary}
            />
            <Text style={styles.stageTitle}>Shake Your Phone!</Text>
            <Text style={styles.stageDescription}>
                Keep shaking for {shakeTimeRemaining} seconds
            </Text>
            <View style={styles.timerCircle}>
                <Text style={styles.timerText}>{shakeTimeRemaining}</Text>
            </View>
            {isShaking && (
                <Text style={styles.shakingIndicator}>🔔 Shaking!</Text>
            )}
        </View>
    );

    const renderArithmeticStage = () => {
        const currentProblem = arithmeticProblems[currentArithmeticIndex];
        if (!currentProblem) return null;

        const difficultyColors = {
            easy: Colors.success,
            medium: Colors.warning,
            hard: Colors.danger,
        };

        return (
            <View style={styles.stageContainer}>
                <View style={[styles.difficultyBadge, { backgroundColor: difficultyColors[currentProblem.difficulty] }]}>
                    <Text style={styles.difficultyText}>
                        {currentProblem.difficulty.toUpperCase()}
                    </Text>
                </View>
                <Text style={styles.stageTitle}>Quick Math</Text>
                <Text style={styles.problemText}>{currentProblem.question} = ?</Text>
                <View style={styles.choicesGrid}>
                    {currentProblem.choices.map((choice, index) => {
                        const isSelected = selectedArithmeticChoice === choice;
                        const isCorrect = choice === currentProblem.answer;
                        const showCorrect = isSelected && isCorrect;
                        const showError = isSelected && !isCorrect && arithmeticError;

                        return (
                            <Pressable
                                key={index}
                                style={[
                                    styles.choiceCard,
                                    showCorrect && styles.choiceCardCorrect,
                                    showError && styles.choiceCardError,
                                ]}
                                onPress={() => handleArithmeticChoice(choice)}
                                disabled={selectedArithmeticChoice !== null}
                            >
                                <Text style={[
                                    styles.choiceText,
                                    (showCorrect || showError) && styles.choiceTextSelected,
                                ]}>
                                    {choice}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
                <Text style={styles.problemProgress}>
                    Problem {currentArithmeticIndex + 1} of 3
                </Text>
            </View>
        );
    };

    const renderMoveAroundStage = () => (
        <View style={styles.stageContainer}>
            <Ionicons name="walk-outline" size={80} color={Colors.accent} />
            <Text style={styles.stageTitle}>Get Up & Move!</Text>
            <Text style={styles.stageDescription}>
                Move around your room to wake yourself up
            </Text>
            <View style={styles.timerCircle}>
                <Text style={styles.timerText}>{moveAroundTime}</Text>
            </View>
        </View>
    );

    const renderPickLargestStage = () => {
        const currentProblem = pickLargestProblems[currentPickLargestIndex];
        if (!currentProblem) return null;

        const difficultyColors = {
            easy: Colors.success,
            medium: Colors.warning,
            hard: Colors.danger,
        };

        return (
            <View style={styles.stageContainer}>
                <View style={[styles.difficultyBadge, { backgroundColor: difficultyColors[currentProblem.difficulty] }]}>
                    <Text style={styles.difficultyText}>
                        {currentProblem.difficulty.toUpperCase()}
                    </Text>
                </View>
                <Text style={styles.stageTitle}>Pick the Largest</Text>
                <Text style={styles.stageDescription}>
                    Tap the largest number
                </Text>
                <View style={styles.numbersGrid}>
                    {currentProblem.numbers.map((num, index) => (
                        <Pressable
                            key={index}
                            style={[styles.numberButton, pickLargestError && styles.numberButtonError]}
                            onPress={() => handlePickLargest(num)}
                        >
                            <Text style={styles.numberButtonText}>{num}</Text>
                        </Pressable>
                    ))}
                </View>
                <Text style={styles.problemProgress}>
                    Problem {currentPickLargestIndex + 1} of 3
                </Text>
            </View>
        );
    };

    const renderTurnOnLightStage = () => (
        <View style={styles.stageContainer}>
            <Ionicons name="bulb-outline" size={80} color={Colors.warning} />
            <Text style={styles.stageTitle}>Turn On the Light!</Text>
            <Text style={styles.stageDescription}>
                Turn on the light in your room
            </Text>
            <View style={styles.timerCircle}>
                <Text style={styles.timerText}>{turnOnLightTime}</Text>
            </View>
        </View>
    );

    const renderCurrentStage = () => {
        switch (currentStage) {
            case 'shake':
                return renderShakeStage();
            case 'arithmetic':
                return renderArithmeticStage();
            case 'moveAround':
                return renderMoveAroundStage();
            case 'pickLargest':
                return renderPickLargestStage();
            case 'turnOnLight':
                return renderTurnOnLightStage();
            case 'complete':
                return null;
            default:
                return null;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Wake Up Challenge</Text>
            </View>

            {renderProgress()}

            <View style={styles.content}>
                {renderCurrentStage()}
            </View>

            {showConfetti && (
                <ConfettiCannon
                    ref={confettiRef}
                    count={100}
                    origin={{ x: SCREEN_WIDTH / 2, y: 0 }}
                    autoStart
                    fadeOut
                    explosionSpeed={350}
                    fallSpeed={2500}
                />
            )}
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
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    headerTitle: {
        fontSize: FontSize.xl,
        fontFamily: FontFamily.bold,
        color: Colors.text,
    },
    progressContainer: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    progressText: {
        fontSize: FontSize.sm,
        fontFamily: FontFamily.medium,
        color: Colors.textSecondary,
        marginBottom: Spacing.xs,
        textAlign: 'center',
    },
    progressBar: {
        height: 6,
        backgroundColor: Colors.surfaceAlt,
        borderRadius: BorderRadius.full,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: Colors.accent,
        borderRadius: BorderRadius.full,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
    },
    stageContainer: {
        alignItems: 'center',
        width: '100%',
    },
    stageTitle: {
        fontSize: FontSize.xxl,
        fontFamily: FontFamily.bold,
        color: Colors.text,
        marginTop: Spacing.lg,
        marginBottom: Spacing.sm,
        textAlign: 'center',
    },
    stageDescription: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginBottom: Spacing.xl,
    },
    timerCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: Colors.accent,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: Spacing.lg,
    },
    timerText: {
        fontSize: FontSize.title,
        fontFamily: FontFamily.bold,
        color: Colors.background,
    },
    shakingIndicator: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.semibold,
        color: Colors.success,
        marginTop: Spacing.lg,
    },
    difficultyBadge: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
        marginBottom: Spacing.sm,
    },
    difficultyText: {
        fontSize: FontSize.xs,
        fontFamily: FontFamily.bold,
        color: Colors.background,
    },
    problemText: {
        fontSize: FontSize.xl,
        fontFamily: FontFamily.bold,
        color: Colors.text,
        marginBottom: Spacing.xl,
        textAlign: 'center',
    },
    choicesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        width: '100%',
        gap: Spacing.md,
        marginBottom: Spacing.lg,
    },
    choiceCard: {
        width: '45%',
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    choiceCardCorrect: {
        backgroundColor: Colors.success,
        borderColor: Colors.success,
    },
    choiceCardError: {
        backgroundColor: Colors.danger,
        borderColor: Colors.danger,
    },
    choiceText: {
        fontSize: FontSize.xl,
        fontFamily: FontFamily.semibold,
        color: Colors.text,
    },
    choiceTextSelected: {
        color: Colors.background,
    },
    problemProgress: {
        fontSize: FontSize.sm,
        fontFamily: FontFamily.medium,
        color: Colors.textSecondary,
    },
    numbersGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: Spacing.md,
        marginBottom: Spacing.lg,
    },
    numberButton: {
        minWidth: 100,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.lg,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
    },
    numberButtonError: {
        borderWidth: 2,
        borderColor: Colors.danger,
    },
    numberButtonText: {
        fontSize: FontSize.xxl,
        fontFamily: FontFamily.bold,
        color: Colors.text,
    },
});
