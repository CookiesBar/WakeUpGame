// Run: node utils/stats.check.ts
import assert from 'node:assert';
import { streak, streakV2 } from './stats.ts';

const now = new Date(2026, 9, 14, 8, 0); // Wednesday
const day = (offset: number) => new Date(2026, 9, 14 + offset, 7, 0).getTime();

assert.equal(streak([], now), 0);
assert.equal(streak([day(0)], now), 1);
assert.equal(streak([day(-2), day(-1), day(0)], now), 3);
assert.equal(streak([day(-2), day(-1)], now), 2, 'today not done yet still counts yesterday');
assert.equal(streak([day(-1), day(0), day(0)], now), 2, 'two wakes in a day count once');
assert.equal(streak([new Date(2026, 9, 1, 7).getTime(), new Date(2026, 8, 30, 7).getTime()], new Date(2026, 9, 1, 9)), 2, 'across a month');

// Streak v2: one rest day per week, between two done mornings.
assert.equal(streak([day(-3), day(-1), day(0)], now), 3, 'Monday missed: rest day keeps it (Sun, Tue, Wed)');
const fri = new Date(2026, 9, 16, 8, 0);
assert.equal(streak([day(-2), day(0), day(2)], fri), 2, 'Tue and Thu missed in one week: the second miss breaks it');
assert.equal(streak([day(-4), day(-2), day(0)], now), 3, 'Sun and Tue missed: different weeks, both forgiven');
assert.equal(streak([day(-2), day(0)], now), 2, 'rest day needs a done day before it');
assert.equal(streak([day(-3), day(-2)], now), 2, 'yesterday missed but today open: the streak stands at 2');
assert.equal(streak([day(-9), day(-7), day(-5), day(-4), day(-3), day(-2), day(-1), day(0)], now), 7, 'one rest day in each of two weeks');

const info = streakV2([day(-2), day(-1), day(0)], now);
assert.deepEqual(info.week, ['done', 'done', 'done', 'open', 'open', 'open', 'open'], 'Mon..Sun, today Wednesday');
assert.equal(info.today, 2);
assert.equal(info.nextMilestone, 7);
const rest = streakV2([day(-3), day(-1)], now);
assert.deepEqual(rest.week, ['rest', 'done', 'open', 'open', 'open', 'open', 'open'], 'Monday shown as the rest day');
assert.equal(streakV2([], now).week[0], 'missed', 'a missed past day reads as missed');
assert.equal(streakV2(Array.from({ length: 70 }, (_, i) => day(-i)), now).nextMilestone, null, 'past the last badge');
console.log('stats ok');
