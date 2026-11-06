/** Math mission problems. 0 = easy (a + b), 2 = hard (one-step university math). Level 1 (medium) is retired. */
export type MathLevel = 0 | 2;

export interface MathProblem {
  text: string;
  answer: number;
}

const int = (min: number, max: number, rand: () => number) =>
  min + Math.floor(rand() * (max - min + 1));

const SUP = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

/**
 * Hard: calculus, linear algebra, limits. Each one is a single known rule plus small mental arithmetic,
 * and every answer is a positive integer (the keypad has no minus or decimal point, max 4 digits).
 */
const HARD: ((rand: () => number) => MathProblem)[] = [
  // Derivative of a quadratic at a point: f′(c) = 2ac + b
  rand => {
    const a = int(2, 6, rand), b = int(1, 9, rand), c = int(2, 5, rand);
    return { text: `f = ${a}x² + ${b}x, f′(${c})`, answer: 2 * a * c + b };
  },
  // Definite integral: ∫₀ⁿ 3k·x² dx = k·n³
  rand => {
    const k = int(1, 3, rand), n = int(2, 5, rand);
    return { text: `∫₀${SUP[n]} ${3 * k}x² dx`, answer: k * n ** 3 };
  },
  // Limit of a difference quotient: lim x→a (x³ − a³)/(x − a) = 3a²
  rand => {
    const a = int(2, 6, rand);
    return { text: `lim x→${a} (x³ − ${a ** 3})/(x − ${a})`, answer: 3 * a * a };
  },
  // 2×2 determinant, ad − bc with ad ≥ 25 > 16 ≥ bc, so it stays positive
  rand => {
    const a = int(5, 9, rand), b = int(1, 4, rand), c = int(1, 4, rand), d = int(5, 9, rand);
    return { text: `det [${a} ${b}; ${c} ${d}]`, answer: a * d - b * c };
  },
  // Arithmetic series, Gauss: n(n + 1)/2
  rand => {
    const n = int(10, 30, rand);
    return { text: `1 + 2 + … + ${n}`, answer: (n * (n + 1)) / 2 };
  },
];

export function makeProblem(level: MathLevel, rand: () => number = Math.random): MathProblem {
  if (level === 2) return HARD[int(0, HARD.length - 1, rand)](rand);
  const a = int(10, 49, rand);
  const b = int(10, 49, rand);
  return { text: `${a} + ${b}`, answer: a + b };
}
