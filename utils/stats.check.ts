// Run: node utils/stats.check.ts
import assert from 'node:assert';
import { streak } from './stats.ts';

const now = new Date(2026, 9, 14, 8, 0);
const day = (offset: number) => new Date(2026, 9, 14 + offset, 7, 0).getTime();

assert.equal(streak([], now), 0);
assert.equal(streak([day(0)], now), 1);
assert.equal(streak([day(-2), day(-1), day(0)], now), 3);
assert.equal(streak([day(-2), day(-1)], now), 2, 'today not done yet still counts yesterday');
assert.equal(streak([day(-3), day(-1), day(0)], now), 2, 'gap breaks it');
assert.equal(streak([day(-1), day(0), day(0)], now), 2, 'two wakes in a day count once');
assert.equal(streak([new Date(2026, 9, 1, 7).getTime(), new Date(2026, 8, 30, 7).getTime()], new Date(2026, 9, 1, 9)), 2, 'across a month');
console.log('stats ok');
