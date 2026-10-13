// Run: node utils/stats.check.ts
import assert from 'node:assert';
import { firstRing, streak, type Wake } from './stats.ts';

const now = new Date(2025, 9, 15, 7, 0); // Wed
const on = (d: number, late = false): Wake => ({ at: new Date(2025, 9, d, 6, 50).getTime(), late });

assert.strictEqual(streak([], now), 0);
assert.strictEqual(streak([on(13), on(14), on(15)], now), 3, 'Mon–Wed');
assert.strictEqual(streak([on(13), on(14)], now), 2, 'not up yet today: streak still counts to yesterday');
assert.strictEqual(streak([on(12), on(14)], now), 1, 'gap breaks it');
assert.strictEqual(streak([on(14), on(14), on(15)], now), 2, 'two wakes in a day count once');

assert.deepStrictEqual(firstRing([on(1), on(14, true), on(15)], now), { onTime: 1, total: 2 }, '1 Oct is outside 14 days');
console.log('stats ok');
