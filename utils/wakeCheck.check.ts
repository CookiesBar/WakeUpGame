// Run: node utils/wakeCheck.check.ts
import assert from 'node:assert';
import { harder, RING_AGAIN_MS, ringAgainEnds, wakeCheckOutcome } from './wakeCheck.ts';

const at = 1_000_000, win = 240_000;
assert.equal(wakeCheckOutcome(at, at - 1, win), 'pending');
assert.equal(wakeCheckOutcome(at, at, win), 'awake');
assert.equal(wakeCheckOutcome(at, at + win - 1, win), 'awake');
assert.equal(wakeCheckOutcome(at, at + win, win), 'missed');

// Ring-again lasts the AlarmKit re-arm span, or one notification burst
assert.equal(ringAgainEnds(at, win, true), at + RING_AGAIN_MS);
assert.equal(ringAgainEnds(at, win, false), at + win);

// Defaults (math 1, 50 steps) → math 2 → 100 steps → maxed
assert.deepEqual(harder({}), { mathLevel: 2 });
assert.deepEqual(harder({ mathLevel: 2 }), { mathLevel: 2, steps: 100 });
assert.deepEqual(harder({ mathLevel: 2, steps: 20 }), { mathLevel: 2, steps: 50 });
assert.equal(harder({ mathLevel: 2, steps: 100 }), null);
console.log('wakeCheck ok');
