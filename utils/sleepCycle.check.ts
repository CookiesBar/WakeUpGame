// Run: node utils/sleepCycle.check.ts
import assert from 'node:assert';
import { bedtimes } from './sleepCycle.ts';

const alarm = new Date(2026, 9, 15, 7, 0);
const hm = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

const early = bedtimes(alarm, new Date(2026, 9, 14, 20, 0));
assert.deepEqual(early.map(b => hm(b.at)), ['21:45', '23:15', '0:45']);
assert.deepEqual(early.map(b => b.cycles), [6, 5, 4]);
assert.ok(early.every(b => !b.passed));

const late = bedtimes(alarm, new Date(2026, 9, 14, 22, 30));
assert.deepEqual(late.map(b => b.passed), [true, false, false], 'too late for 6 cycles');
console.log('sleepCycle ok');
