// Run: node utils/updateFlow.check.ts
import assert from 'node:assert';
import { RATE_COOLDOWN_MS, reviewDue, whatsNewDue } from './updateFlow.ts';

assert.equal(whatsNewDue(true, null, '3.0.0'), true); // 2.x user updating: no key yet
assert.equal(whatsNewDue(true, '3', '3.0.1'), false); // already shown for 3
assert.equal(whatsNewDue(true, '3', '4.0.0'), true);
assert.equal(whatsNewDue(false, null, '3.0.0'), false); // fresh install: onboarding instead
assert.equal(whatsNewDue(true, null, undefined), false); // no version read: never guess

const now = 10 * RATE_COOLDOWN_MS;
assert.equal(reviewDue(null, now), true);
assert.equal(reviewDue(String(now - 1000), now), false);
assert.equal(reviewDue(String(now - RATE_COOLDOWN_MS), now), true);
console.log('updateFlow ok');
