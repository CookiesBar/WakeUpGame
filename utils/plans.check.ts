// Run: node utils/plans.check.ts
import assert from 'node:assert';
import { perMonth, yearlySaving } from './plans.ts';

assert.equal(yearlySaving(19.99, 1.99), 80, '$19.99/yr vs $1.99/wk = 80.7%, rounded down');
assert.equal(yearlySaving(19.99, 2.99), 87, 'vs $2.99/wk');
assert.equal(yearlySaving(200, 1.99), 0, 'never negative');
assert.equal(yearlySaving(19.99, 0), 0, 'no weekly');
assert.equal(perMonth(19.99, 'USD', 'en-US'), '$1.67');
assert.equal(perMonth(19.99, 'EUR', 'de-DE'), '1,67 €');
console.log('plans ok');
