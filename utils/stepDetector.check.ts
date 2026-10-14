// Run: node utils/stepDetector.check.ts
import assert from 'node:assert';
import { createStepDetector } from './stepDetector.ts';

/** Simulated walk: 1 g at rest plus a 0.5 g bump every `periodMs`, sampled at 50 ms. */
function count(periodMs: number, durationMs: number, bump = 0.5): number {
  const detect = createStepDetector();
  let steps = 0;
  for (let t = 0; t < durationMs; t += 50) {
    const z = 1 + (t % periodMs < 100 ? bump : -0.1);
    if (detect(0, 0, z, t)) steps++;
  }
  return steps;
}

assert.strictEqual(count(500, 10_000), 20, 'normal walk: 2 steps/s for 10 s');
assert.strictEqual(count(500, 10_000, 0.05), 0, 'phone lying still / tiny jitter');
assert.ok(count(100, 10_000) <= 10_000 / 280 + 1, 'frantic shaking is capped by cadence');
assert.strictEqual(createStepDetector()(0, 0, 1, 0), false, 'gravity alone is not a step');
console.log('stepDetector ok');
