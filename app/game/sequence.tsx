import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
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
    TextInput,
    View,
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
    difficulty: Difficulty;
}

interface PickLargestProblem {
    numbers: number[];
    answer: number;
    difficulty: Difficulty;
}

// Generate arithmetic problem based on difficulty
const generateArithmeticProblem = (difficulty: Difficulty): ArithmeticProblem => {
    let a: number, b: number, operator: string, answer: number;

    switch (difficulty) {
        case 'easy':
            a = Math.floor(Math.random() * 9) + 1; // 1-9
            b = Math.floor(Math.random() * 9) + 1;
            if (Math.random() > 0.5) {
                operator = '+';
                answer = a + b;
            } else {
                if (a < b) [a, b] = [b, a]; // Ensure positive result
                operator = '-';
                answer = a - b;
            }
            break;
        case 'medium':
            a = Math.floor(Math.random() * 50) + 10; // 10-59
            b = Math.floor(Math.random() * 40) + 10; // 10-49
            if (Math.random() > 0.5) {
                operator = '+';
                answer = a + b;
            } else {
                if (a < b) [a, b] = [b, a];
                operator = '-';
                answer = a - b;
            }
            break;
        case 'hard':
            a = Math.floor(Math.random() * 12) + 2; // 2-13
            b = Math.floor(Math.random() * 12) + 2;
            if (Math.random() > 0.5) {
                operator = '×';
                answer = a * b;
            } else {
                // Division - ensure clean division
                answer = Math.floor(Math.random() * 10) + 2;
                b = Math.floor(Math.random() * 10) + 2;
                a = answer * b;
                operator = '÷';
            }
            break;
    }

    return {
        question: `${a} ${operator} ${b}`,
        answer,
        difficulty,
    };
};

// Generate pick largest problem based on difficulty
const generatePickLargestProblem = (difficulty: Difficulty): PickLargestProblem => {
    let count: number, max: number;

    switch (difficulty) {
        case 'easy':
            count = 2;
            max = 100;
            break;
        case 'medium':
            count = 3;
            max = 500;
            break;
        case 'hard':
            count = 4;
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
    const [shakeTimeRemaining, setShakeTimeRemaining] = useState(5);
    const [isShaking, setIsShaking] = useState(false);
    const shakeSubscription = useRef<ReturnType<typeof Accelerometer.addListener> | null>(null);
    const lastShakeTime = useRef(0);

    // Arithmetic game state
    const [arithmeticProblems, setArithmeticProblems] = useState<ArithmeticProblem[]>([]);
    const [currentArithmeticIndex, setCurrentArithmeticIndex] = useState(0);
    const [arithmeticInput, setArithmeticInput] = useState('');
    const [arithmeticError, setArithmeticError] = useState(false);

    // Move around state
    const [moveAroundTime, setMoveAroundTime] = useState(5);

    // Pick largest game state
    const [pickLargestProblems, setPickLargestProblems] = useState<PickLargestProblem[]>([]);
    const [currentPickLargestIndex, setCurrentPickLargestIndex] = useState(0);
    const [pickLargestError, setPickLargestError] = useState(false);

    // Turn on light state
    const [turnOnLightTime, setTurnOnLightTime] = useState(5);

    // Confetti
    const [showConfetti, setShowConfetti] = useState(false);
    const confettiRef = useRef<any>(null);

    // Animation
    const progressAnim = useRef(new Animated.Value(0)).current;

    // Audio for correct answers
    const playCorrectSound = useCallback(async () => {
        try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
            console.log('Haptics error:', e);
        }
    }, []);

    const playStageCompleteSound = useCallback(async () => {
        try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
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
    const handleComplete = useCallback(() => {
        stopAlarmSound();
        router.replace('/');
    }, []);

    // ========== SHAKE GAME ==========
    useEffect(() => {
        if (currentStage !== 'shake') return;

        let shakeCount = 0;
        const SHAKE_THRESHOLD = 1.5;
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
                    shakeCount++;
                    setIsShaking(true);
                    setTimeout(() => setIsShaking(false), 100);
                }
            }
        };

        Accelerometer.setUpdateInterval(50);
        shakeSubscription.current = Accelerometer.addListener(handleMotion);

        timerInterval = setInterval(() => {
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
        }, 1000);

        return () => {
            clearInterval(timerInterval);
            shakeSubscription.current?.remove();
        };
    }, [currentStage, advanceToNextStage]);

    // ========== ARITHMETIC GAME ==========
    const handleArithmeticSubmit = useCallback(() => {
        const currentProblem = arithmeticProblems[currentArithmeticIndex];
        if (!currentProblem) return;

        const userAnswer = parseInt(arithmeticInput, 10);
        if (userAnswer === currentProblem.answer) {
            playCorrectSound();
            setArithmeticInput('');
            setArithmeticError(false);

            if (currentArithmeticIndex >= 2) {
                advanceToNextStage();
            } else {
                setCurrentArithmeticIndex(prev => prev + 1);
            }
        } else {
            setArithmeticError(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setTimeout(() => setArithmeticError(false), 500);
        }
    }, [arithmeticInput, arithmeticProblems, currentArithmeticIndex, advanceToNextStage, playCorrectSound]);

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
                <TextInput
                    style={[styles.mathInput, arithmeticError && styles.inputError]}
                    value={arithmeticInput}
                    onChangeText={setArithmeticInput}
                    keyboardType="number-pad"
                    placeholder="Answer"
                    placeholderTextColor={Colors.textMuted}
                    autoFocus
                />
                <Pressable style={styles.submitButton} onPress={handleArithmeticSubmit}>
                    <Text style={styles.submitButtonText}>Submit</Text>
                </Pressable>
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
        backgroundColor: Colors.gameBackground,
    },
    header: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: FontSize.xl,
        fontFamily: FontFamily.bold,
        color: Colors.background,
    },
    progressContainer: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    progressText: {
        fontSize: FontSize.sm,
        fontFamily: FontFamily.medium,
        color: Colors.textMuted,
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
        color: Colors.background,
        marginTop: Spacing.lg,
        marginBottom: Spacing.sm,
        textAlign: 'center',
    },
    stageDescription: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: Colors.textMuted,
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
        fontSize: FontSize.title,
        fontFamily: FontFamily.bold,
        color: Colors.background,
        marginBottom: Spacing.xl,
    },
    mathInput: {
        width: '80%',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        fontSize: FontSize.xl,
        fontFamily: FontFamily.semibold,
        color: Colors.text,
        textAlign: 'center',
        marginBottom: Spacing.md,
    },
    inputError: {
        borderWidth: 2,
        borderColor: Colors.danger,
    },
    submitButton: {
        backgroundColor: Colors.accent,
        paddingHorizontal: Spacing.xxl,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.lg,
    },
    submitButtonText: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.semibold,
        color: Colors.background,
    },
    problemProgress: {
        fontSize: FontSize.sm,
        fontFamily: FontFamily.medium,
        color: Colors.textMuted,
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
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.lg,
        borderRadius: BorderRadius.lg,
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
