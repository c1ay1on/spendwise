const test = require('node:test');
const assert = require('node:assert');
const { isValidMonth, isValidDate, monthRange } = require('../utils/dates');
const { parseAmount, parseId } = require('../utils/validate');

test('month validation', () => {
  assert.ok(isValidMonth('2026-10'));
  assert.ok(!isValidMonth('2026-13'));
  assert.ok(!isValidMonth('2026-1'));
});

test('date validation', () => {
  assert.ok(isValidDate('2026-02-28'));
  assert.ok(!isValidDate('2026-02-30'));
  assert.ok(!isValidDate('28-02-2026'));
});

test('monthRange handles December', () => {
  assert.deepStrictEqual(monthRange('2026-12'), { start: '2026-12-01', end: '2027-01-01' });
  assert.deepStrictEqual(monthRange('2026-10'), { start: '2026-10-01', end: '2026-11-01' });
});

test('parseAmount', () => {
  assert.strictEqual(parseAmount(250.5), 250.5);
  assert.strictEqual(parseAmount('12.50'), 12.5);
  assert.strictEqual(parseAmount(0), null);
  assert.strictEqual(parseAmount(-5), null);
  assert.strictEqual(parseAmount(1.234), null);
  assert.strictEqual(parseAmount('abc'), null);
});

test('parseId', () => {
  assert.strictEqual(parseId('7'), 7);
  assert.strictEqual(parseId('0'), null);
  assert.strictEqual(parseId('x'), null);
});
