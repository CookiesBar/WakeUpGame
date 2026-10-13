// Run: node utils/schedule.check.ts
import assert from 'node:assert';
import { dayKey, dayState, nextFire, planTriggers, withPause, type Repeating } from './schedule.ts';

// Monday 13 Oct 2025, 05:00 local.
const mon = new Date(2025, 9, 13, 5, 0);
const weekdays: Repeating = { time: '06:45', days: [1, 2, 3, 4, 5] };

// Plain repeating alarm: all WEEKLY, nothing dated, no rebuild.
let plan = planTriggers(weekdays, mon);
assert.deepStrictEqual(plan.weekly, [1, 2, 3, 4, 5]);
assert.strictEqual(plan.dates.length, 0);
assert.strictEqual(plan.rebuildAt, undefined);
assert.strictEqual(nextFire(weekdays, mon)?.getTime(), new Date(2025, 9, 13, 6, 45).getTime());

// Skip today (Mon), move Tue +45 min.
const changed: Repeating = { ...weekdays, exceptions: { '2025-10-13': 'skip', '2025-10-14': 45 } };
assert.strictEqual(nextFire(changed, mon)?.getTime(), new Date(2025, 9, 14, 7, 30).getTime());
plan = planTriggers(changed, mon);
assert.deepStrictEqual(plan.weekly, [3, 4, 5], 'untouched weekdays stay weekly');
assert.ok(!plan.dates.some((d) => dayKey(d) === '2025-10-13'), 'skipped day has no trigger');
assert.strictEqual(plan.dates[0].getTime(), new Date(2025, 9, 14, 7, 30).getTime(), 'moved time');
assert.strictEqual(plan.dates.filter((d) => d.getDay() === 2).length, 4, 'Tuesday keeps ringing for the horizon');
assert.strictEqual(plan.dates.filter((d) => d.getDay() === 1).length, 3, 'Monday: horizon minus the skip');
assert.strictEqual(plan.rebuildAt, new Date(2025, 9, 14).getTime(), 'rebuild once Monday’s skip is over');

// A move that pushes a past base into the future still rings.
const lateMon = new Date(2025, 9, 13, 7, 0);
const movedToday: Repeating = { ...weekdays, exceptions: { '2025-10-13': 45 } };
assert.strictEqual(nextFire(movedToday, lateMon)?.getTime(), new Date(2025, 9, 13, 7, 30).getTime());

// Pause until Wednesday skips Mon + Tue only.
const paused = withPause(undefined, '2025-10-15', mon);
assert.deepStrictEqual(Object.keys(paused), ['2025-10-13', '2025-10-14']);
assert.strictEqual(nextFire({ ...weekdays, exceptions: paused }, mon)?.getTime(), new Date(2025, 9, 15, 6, 45).getTime());

// One-time alarm: next HH:MM, gone when skipped.
const once: Repeating = { time: '04:00', days: [] };
assert.strictEqual(nextFire(once, mon)?.getTime(), new Date(2025, 9, 14, 4, 0).getTime());
assert.strictEqual(nextFire({ ...once, exceptions: { '2025-10-14': 'skip' } }, mon), null);
assert.deepStrictEqual(planTriggers({ ...once, exceptions: { '2025-10-14': 'skip' } }, mon).dates, []);

// Every 2 weeks, anchored on this week: rings Mon 13 + Mon 27, not Mon 20.
const fortnight: Repeating = { time: '06:45', days: [1], everyWeeks: 2, anchor: '2025-10-15' };
assert.ok(dayState(fortnight, new Date(2025, 9, 27)) && !dayState(fortnight, new Date(2025, 9, 20)));
assert.strictEqual(nextFire(fortnight, new Date(2025, 9, 13, 7, 0))?.getTime(), new Date(2025, 9, 27, 6, 45).getTime());
plan = planTriggers(fortnight, mon);
assert.deepStrictEqual(plan.weekly, [], 'never weekly');
assert.deepStrictEqual(plan.dates.map(dayKey), ['2025-10-13', '2025-10-27']);
assert.strictEqual(plan.rebuildAt, new Date(2025, 9, 14).getTime(), 'rebuild after the next ring');

// Every 12 weeks still finds the next ring, 12 weeks on.
const quarterly: Repeating = { time: '06:45', days: [1], everyWeeks: 12, anchor: '2025-10-06' };
assert.strictEqual(nextFire(quarterly, mon)?.getTime(), new Date(2025, 11, 29, 6, 45).getTime());
assert.deepStrictEqual(planTriggers(quarterly, mon).dates.map(dayKey), ['2025-12-29']);

console.log('schedule ok');
