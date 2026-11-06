// Run: node utils/math.check.ts
// Re-derives every answer from the problem text alone (numeric calculus, not the generator's formulas).
import assert from 'node:assert';
import { makeProblem } from './math.ts';

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const h = 1e-4;

function solve(text: string): number {
  let m: RegExpMatchArray | null;
  if ((m = text.match(/^(\d+) \+ (\d+)$/))) return +m[1] + +m[2];
  if ((m = text.match(/^f = (\d+)x² \+ (\d+)x, f′\((\d+)\)$/))) {
    const f = (x: number) => +m![1] * x * x + +m![2] * x;
    return (f(+m[3] + h) - f(+m[3] - h)) / (2 * h);
  }
  if ((m = text.match(/^∫₀(.) (\d+)x² dx$/))) {
    const n = SUP.indexOf(m[1]), steps = 1000, dx = n / steps; // Simpson's rule
    let sum = 0;
    for (let i = 0; i <= steps; i++) sum += (i === 0 || i === steps ? 1 : i % 2 ? 4 : 2) * +m[2] * (i * dx) ** 2;
    return (sum * dx) / 3;
  }
  if ((m = text.match(/^lim x→(\d+) \(x³ − (\d+)\)\/\(x − (\d+)\)$/))) {
    assert.strictEqual(+m[2], Number(m[1]) ** 3, `0/0 form: ${text}`);
    assert.strictEqual(m[3], m[1], `0/0 form: ${text}`);
    const x = +m[1] + 1e-6;
    return (x ** 3 - +m[2]) / (x - +m[3]);
  }
  if ((m = text.match(/^det \[(\d+) (\d+); (\d+) (\d+)\]$/))) return +m[1] * +m[4] - +m[2] * +m[3];
  if ((m = text.match(/^1 \+ 2 \+ … \+ (\d+)$/))) {
    let s = 0;
    for (let k = 1; k <= +m[1]; k++) s += k;
    return s;
  }
  throw new Error(`unknown problem: ${text}`);
}

const kinds = new Set<string>();
for (const level of [0, 2] as const) {
  for (let i = 0; i < 5000; i++) {
    const p = makeProblem(level);
    assert.ok(Number.isInteger(p.answer), `integer answer: ${p.text} = ${p.answer}`);
    assert.ok(p.answer > 0 && p.answer <= 9999, `fits the 4-digit keypad: ${p.text} = ${p.answer}`);
    assert.ok(Math.abs(solve(p.text) - p.answer) < 1e-3, `correct: ${p.text} = ${p.answer}, got ${solve(p.text)}`);
    assert.ok(p.text.length <= 26, `short enough for one line: ${p.text}`);
    if (level === 2) kinds.add(p.text[0]);
  }
}
assert.strictEqual(kinds.size, 5, 'every hard kind shows up');
assert.strictEqual(makeProblem(0, () => 0).text, '10 + 10');
console.log('math ok');
