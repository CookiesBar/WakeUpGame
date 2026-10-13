// Run: node utils/math.check.ts
import assert from 'node:assert';
import { makeProblem, type MathLevel } from './math.ts';

const evaluate = (text: string) => Function(`return ${text.replace('×', '*')}`)() as number;

for (const level of [0, 1, 2] as MathLevel[]) {
  for (let i = 0; i < 1000; i++) {
    const p = makeProblem(level);
    assert.strictEqual(p.answer, evaluate(p.text), `answer matches text: ${p.text}`);
    assert.ok(p.answer > 0 && p.answer < 400, `answer in a sane range: ${p.text}`);
  }
}
// Range edges: rand() = 0 gives the smallest operands, rand() → 1 the largest.
assert.strictEqual(makeProblem(0, () => 0).text, '10 + 10');
assert.strictEqual(makeProblem(2, () => 0.999).text, '19 × 12 + 99');
console.log('math ok');
