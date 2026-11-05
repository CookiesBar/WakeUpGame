// Run: node utils/alarmKitId.check.ts
import assert from 'node:assert';
import { alarmKitId } from './alarmKitId.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/;
const id = alarmKitId('lq3x9abc', 0);
assert.match(id, UUID);
assert.equal(alarmKitId('lq3x9abc', 0), id); // same key → same id, so cancel finds it
const ids = new Set(['lq3x9abc', 'check-lq3x9abc', 'other'].flatMap(k => [0, 1, 2, 3].map(i => alarmKitId(k, i))));
assert.equal(ids.size, 12); // every link of every chain is distinct
console.log('alarmKitId ok');
