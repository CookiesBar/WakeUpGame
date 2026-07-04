import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Accelerometer, type AccelerometerMeasurement } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { stopAlarmSound } from '@/utils/sounds';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Stage = 'shake' | 'arithmetic' | 'pickLargest' | 'complete';
const STAGES: Stage[] = ['shake', 'arithmetic', 'pickLargest', 'complete'];
const SHAKE_SECONDS = 12;

type Difficulty = 'easy' | 'medium' | 'hard';
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

interface MathProblem {
  question: string;
  answer: number;
  choices: number[];
  difficulty: Difficulty;
}
interface LargestProblem {
  numbers: number[];
  answer: number;
  difficulty: Difficulty;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function wrongAnswers(correct: number, count: number): number[] {
  const used = new Set<number>([correct]);
  const out: number[] = [];
  while (out.length < count) {
    const variance = Math.max(8, Math.abs(correct) * 0.3);
    let w = correct + Math.floor((Math.random() - 0.5) * 2 * variance);
    if (w <= 0) w = Math.abs(w) + 1;
    if (!used.has(w)) {
      used.add(w);
      out.push(w);
    }
  }
  return out;
}

function makeMathProblem(difficulty: Difficulty): MathProblem {
  let question: string;
  let answer: number;
  if (difficulty === 'easy') {
    const a = Math.floor(Math.random() * 20) + 5;
    const b = Math.floor(Math.random() * 15) + 2;
    if (Math.random() < 0.5) {
      question = `${a} + ${b}`;
      answer = a + b;
    } else {
      const [lo, hi] = a > b ? [b, a] : [a, b];
      question = `${hi} − ${lo}`;
      answer = hi - lo;
    }
  } else if (difficulty === 'medium') {
    const a = Math.floor(Math.random() * 10) + 2;
    const b = Math.floor(Math.random() * 10) + 2;
    const c = Math.floor(Math.random() * 20) + 5;
    question = `${a} × ${b} + ${c}`;
    answer = a * b + c;
  } else {
    const a = Math.floor(Math.random() * 15) + 5;
    const b = Math.floor(Math.random() * 15) + 5;
    const c = Math.floor(Math.random() * 6) + 2;
    question = `(${a} + ${b}) × ${c}`;
    answer = (a + b) * c;
  }
  return { question, answer, choices: shuffle([answer, ...wrongAnswers(answer, 3)]), difficulty };
}

function makeLargestProblem(difficulty: Difficulty): LargestProblem {
  const max = difficulty === 'easy' ? 100 : difficulty === 'medium' ? 500 : 1000;
  const nums: number[] = [];
  while (nums.length < 4) {
    const n = Math.floor(Math.random() * max) + 1;
    if (!nums.includes(n)) nums.push(n);
  }
  return { numbers: nums, answer: Math.max(...nums), difficulty };
}

const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  easy: Colors.success,
  medium: Colors.warning,
  hard: Colors.danger,
};

export default function GameScreen() {
  const [stageIdx, setStageIdx] = useState(0);
  const stage = STAGES[stageIdx];

  const [shakeRemaining, setShakeRemaining] = useState(SHAKE_SECONDS);
  const [isShaking, setIsShaking] = useState(false);
  const lastShakeAt = useRef(0);

  const [mathProblems] = useState<MathProblem[]>(() => DIFFICULTIES.map(makeMathProblem));
  const [mathIdx, setMathIdx] = useState(0);
  const [mathPick, setMathPick] = useState<number | null>(null);
  const [mathError, setMathError] = useState(false);

  const [largestProblems] = useState<LargestProblem[]>(() =>
    DIFFICULTIES.map(makeLargestProblem)
  );
  const [largestIdx, setLargestIdx] = useState(0);
  const [largestError, setLargestError] = useState(false);

  const [confetti, setConfetti] = useState(false);

  const celebrate = useCallback(async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Vibration.vibrate([0, 200, 100, 200]);
    } catch {
      /* haptics unavailable */
    }
  }, []);

  const tapOk = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      /* ignore */
    }
  }, []);

  const advance = useCallback(() => {
    celebrate();
    setConfetti(true);
    setTimeout(() => {
      setConfetti(false);
      setStageIdx((i) => i + 1);
    }, 1400);
  }, [celebrate]);

  const finish = useCallback(() => {
    stopAlarmSound();
    router.replace('/');
  }, []);

  // Shake stage
  useEffect(() => {
    if (stage !== 'shake') return;
    const THRESHOLD = 1.5;
    const WINDOW_MS = 400;
    let done = false;

    const onMotion = (d: AccelerometerMeasurement) => {
      if (done) return;
      const total = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z);
      if (total > THRESHOLD) {
        lastShakeAt.current = Date.now();
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 120);
      }
    };

    Accelerometer.setUpdateInterval(50);
    const sub = Accelerometer.addListener(onMotion);

    const timer = setInterval(() => {
      if (Date.now() - lastShakeAt.current <= WINDOW_MS) {
        setShakeRemaining((prev) => {
          if (prev <= 1) {
            done = true;
            clearInterval(timer);
            sub.remove();
            setTimeout(advance, 400);
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [stage, advance]);

  // Complete stage
  useEffect(() => {
    if (stage !== 'complete') return;
    setConfetti(true);
    const t = setTimeout(finish, 2200);
    return () => clearTimeout(t);
  }, [stage, finish]);

  const onMathPick = (choice: number) => {
    const problem = mathProblems[mathIdx];
    setMathPick(choice);
    if (choice === problem.answer) {
      tapOk();
      setMathError(false);
      setTimeout(() => {
        setMathPick(null);
        if (mathIdx >= DIFFICULTIES.length - 1) advance();
        else setMathIdx((i) => i + 1);
      }, 280);
    } else {
      setMathError(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setTimeout(() => {
        setMathError(false);
        setMathPick(null);
      }, 450);
    }
  };

  const onLargestPick = (n: number) => {
    const problem = largestProblems[largestIdx];
    if (n === problem.answer) {
      tapOk();
      setLargestError(false);
      if (largestIdx >= DIFFICULTIES.length - 1) advance();
      else setLargestIdx((i) => i + 1);
    } else {
      setLargestError(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setTimeout(() => setLargestError(false), 450);
    }
  };

  const totalSteps = STAGES.length - 1;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Wake Up Challenge</Text>
      </View>

      {stage !== 'complete' && (
        <View style={styles.progressWrap}>
          <Text style={styles.progressText}>
            Step {stageIdx + 1} of {totalSteps}
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${((stageIdx + 1) / totalSteps) * 100}%` }]}
            />
          </View>
        </View>
      )}

      <View style={styles.content}>
        {stage === 'shake' && (
          <View style={styles.stage}>
            <Ionicons
              name="phone-portrait-outline"
              size={80}
              color={isShaking ? Colors.success : Colors.textSecondary}
            />
            <Text style={styles.stageTitle}>Shake your phone!</Text>
            <Text style={styles.stageDesc}>Keep shaking to wake yourself up</Text>
            <View style={styles.timerCircle}>
              <Text style={styles.timerText}>{shakeRemaining}</Text>
            </View>
            {isShaking && <Text style={styles.shakeOn}>Shaking!</Text>}
          </View>
        )}

        {stage === 'arithmetic' &&
          (() => {
            const p = mathProblems[mathIdx];
            return (
              <View style={styles.stage}>
                <View style={[styles.badge, { backgroundColor: DIFFICULTY_COLOR[p.difficulty] }]}>
                  <Text style={styles.badgeText}>{p.difficulty.toUpperCase()}</Text>
                </View>
                <Text style={styles.stageTitle}>Quick math</Text>
                <Text style={styles.problem}>{p.question} = ?</Text>
                <View style={styles.choicesGrid}>
                  {p.choices.map((choice, i) => {
                    const selected = mathPick === choice;
                    const correct = choice === p.answer;
                    return (
                      <Pressable
                        key={`${choice}-${i}`}
                        style={[
                          styles.choice,
                          selected && correct && styles.choiceCorrect,
                          selected && !correct && mathError && styles.choiceWrong,
                        ]}
                        disabled={mathPick !== null}
                        onPress={() => onMathPick(choice)}
                      >
                        <Text
                          style={[
                            styles.choiceText,
                            selected && (correct || mathError) && styles.choiceTextSelected,
                          ]}
                        >
                          {choice}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.subProgress}>
                  Problem {mathIdx + 1} of {DIFFICULTIES.length}
                </Text>
              </View>
            );
          })()}

        {stage === 'pickLargest' &&
          (() => {
            const p = largestProblems[largestIdx];
            return (
              <View style={styles.stage}>
                <View style={[styles.badge, { backgroundColor: DIFFICULTY_COLOR[p.difficulty] }]}>
                  <Text style={styles.badgeText}>{p.difficulty.toUpperCase()}</Text>
                </View>
                <Text style={styles.stageTitle}>Pick the largest</Text>
                <Text style={styles.stageDesc}>Tap the biggest number</Text>
                <View style={styles.choicesGrid}>
                  {p.numbers.map((n, i) => (
                    <Pressable
                      key={`${n}-${i}`}
                      style={[styles.choice, largestError && styles.choiceWrongOutline]}
                      onPress={() => onLargestPick(n)}
                    >
                      <Text style={styles.choiceText}>{n}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.subProgress}>
                  Problem {largestIdx + 1} of {DIFFICULTIES.length}
                </Text>
              </View>
            );
          })()}

        {stage === 'complete' && (
          <View style={styles.stage}>
            <Ionicons name="checkmark-circle" size={100} color={Colors.success} />
            <Text style={styles.stageTitle}>You're awake!</Text>
            <Text style={styles.stageDesc}>Alarm off. Have a great day.</Text>
          </View>
        )}
      </View>

      {confetti && (
        <ConfettiCannon
          count={120}
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
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.bold,
    color: Colors.text,
  },
  progressWrap: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  progressText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.medium,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: BorderRadius.full },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  stage: { alignItems: 'center', width: '100%' },
  stageTitle: {
    fontSize: FontSize.xxl,
    fontFamily: FontFamily.bold,
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  stageDesc: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  timerCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  timerText: { fontSize: FontSize.title, fontFamily: FontFamily.bold, color: Colors.onAccent },
  shakeOn: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.semibold,
    color: Colors.success,
    marginTop: Spacing.lg,
  },
  badge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.sm,
  },
  badgeText: { fontSize: FontSize.xs, fontFamily: FontFamily.bold, color: Colors.onAccent },
  problem: {
    fontSize: FontSize.xxl,
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
  choice: {
    width: '44%',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceCorrect: { backgroundColor: Colors.success, borderColor: Colors.success },
  choiceWrong: { backgroundColor: Colors.danger, borderColor: Colors.danger },
  choiceWrongOutline: { borderColor: Colors.danger, borderWidth: 2 },
  choiceText: { fontSize: FontSize.xl, fontFamily: FontFamily.bold, color: Colors.text },
  choiceTextSelected: { color: Colors.onAccent },
  subProgress: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.medium,
    color: Colors.textSecondary,
  },
});
