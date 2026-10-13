/** Math mission problems. 0 = easy (a + b), 1 = medium (a × b + c), 2 = hard (bigger a × b + c). */
export type MathLevel = 0 | 1 | 2;

export interface MathProblem {
  text: string;
  answer: number;
}

const int = (min: number, max: number, rand: () => number) =>
  min + Math.floor(rand() * (max - min + 1));

export function makeProblem(level: MathLevel, rand: () => number = Math.random): MathProblem {
  if (level === 0) {
    const a = int(10, 49, rand);
    const b = int(10, 49, rand);
    return { text: `${a} + ${b}`, answer: a + b };
  }
  const hard = level === 2;
  const a = hard ? int(6, 19, rand) : int(3, 9, rand);
  const b = hard ? int(6, 12, rand) : int(3, 9, rand);
  const c = hard ? int(10, 99, rand) : int(1, 20, rand);
  return { text: `${a} × ${b} + ${c}`, answer: a * b + c };
}
