// Run: node utils/time.check.ts
import assert from 'node:assert';
import { clockParts, nextAlarmDate, untilParts } from './time.ts';

const thu2333 = new Date(2026, 10, 5, 23, 33); // Thursday
const weekdays = [false, true, true, true, true, true, false];

assert.equal(nextAlarmDate(6, 45, weekdays, thu2333).getDate(), 6, 'Thu night -> Fri morning');
assert.equal(nextAlarmDate(6, 45, [true, false, false, false, false, false, false], thu2333).getDate(), 8, 'Sunday only');
assert.equal(nextAlarmDate(23, 50, weekdays, thu2333).getDate(), 5, 'later today on a weekday');
assert.equal(nextAlarmDate(6, 45, Array(7).fill(false), thu2333).getDate(), 6, 'one-time, passed today -> tomorrow');
assert.equal(nextAlarmDate(23, 40, Array(7).fill(false), thu2333).getDate(), 5, 'one-time, still ahead today');
const fri = new Date(2026, 10, 6, 6, 45);
assert.equal(nextAlarmDate(6, 45, [false, false, false, false, false, true, false], fri).getDate(), 13, 'exactly now -> next week');

assert.deepEqual(untilParts(new Date(2026, 10, 6, 6, 45), thu2333), { d: 0, h: 7, m: 12 });
assert.deepEqual(untilParts(new Date(2026, 10, 7, 8, 0), thu2333), { d: 1, h: 8, m: 27 });
assert.deepEqual(untilParts(thu2333, new Date(2026, 10, 6)), { d: 0, h: 0, m: 0 }, 'never negative');

assert.deepEqual(clockParts(6, 5, false), { time: '6:05', ap: 'AM' });
assert.deepEqual(clockParts(0, 30, false), { time: '12:30', ap: 'AM' });
assert.deepEqual(clockParts(13, 20, false), { time: '1:20', ap: 'PM' });
assert.deepEqual(clockParts(6, 5, true), { time: '06:05', ap: '' });
console.log('time ok');
