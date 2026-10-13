// Run: node utils/routines.check.ts
import assert from 'node:assert';
import { splitByDay } from './routines.ts';
import type { Alarm, Routine } from './storage';

const routine = (r: Partial<Routine>): Routine =>
  ({ id: 'r', name: 'Mornings', enabled: true, days: [], exceptions: {}, levelUp: true, createdAt: 0, ...r });
const alarm = (a: Partial<Alarm>): Alarm =>
  ({ id: 'a', time: '06:45', label: '', enabled: true, days: [], soundId: null, createdAt: 0, ...a });

let n = 0;
const newId = () => `new${n++}`;

// Nothing shared: nothing to do.
assert.strictEqual(splitByDay([routine({ days: [1] })], [], newId), null);

// Mon + Tue with two alarms and a skip on Tue 14 Oct 2025.
const out = splitByDay(
  [routine({ days: [1, 2], exceptions: { '2025-10-13': 30, '2025-10-14': 'skip' } })],
  [alarm({ id: 'a1', routineId: 'r', days: [1, 2] }), alarm({ id: 'a2', routineId: 'r', time: '07:00', days: [1, 2] }), alarm({ id: 'x' })],
  newId
)!;
assert.deepStrictEqual(out.routines.map((r) => [r.id, r.days]), [['r', [1]], ['new0', [2]]]);
assert.deepStrictEqual(out.routines[0].exceptions, { '2025-10-13': 30 }, 'Monday keeps only its own change');
assert.deepStrictEqual(out.routines[1].exceptions, { '2025-10-14': 'skip' });
assert.deepStrictEqual(
  out.alarms.map((a) => [a.id, a.routineId, a.days]),
  [['x', undefined, []], ['a1', 'r', [1]], ['a2', 'r', [1]], ['new1', 'new0', [2]], ['new2', 'new0', [2]]],
  'alarms copied per day; the first day keeps the ids'
);

console.log('routines ok');
