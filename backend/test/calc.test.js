const test = require('node:test');
const assert = require('node:assert');
const { round2, alertLevel, calcBudgetStatus, buildSummary } = require('../services/calc');

test('alert levels', () => {
  assert.strictEqual(alertLevel(79.9), 'none');
  assert.strictEqual(alertLevel(80), 'warning');
  assert.strictEqual(alertLevel(100), 'warning');
  assert.strictEqual(alertLevel(100.1), 'over');
  assert.strictEqual(alertLevel(null), 'none');
});

test('round2 avoids floating point noise', () => {
  assert.strictEqual(round2(0.1 + 0.2), 0.3);
});

test('no budget set', () => {
  assert.deepStrictEqual(calcBudgetStatus(null, 250), {
    budget: null, total_spent: 250, remaining: null, percent_used: null, alert: 'none'
  });
});

test('budget statuses', () => {
  assert.deepStrictEqual(calcBudgetStatus(1000, 250), {
    budget: 1000, total_spent: 250, remaining: 750, percent_used: 25, alert: 'none'
  });
  assert.strictEqual(calcBudgetStatus(1000, 800).alert, 'warning');
  assert.strictEqual(calcBudgetStatus(1000, 1000).alert, 'warning');
  
  const over = calcBudgetStatus(1000, 1200);
  assert.strictEqual(over.alert, 'over');
  assert.strictEqual(over.remaining, -200);
  assert.strictEqual(over.percent_used, 120);
});

test('buildSummary shape', () => {
  const s = buildSummary({
    month: '2026-10',
    budget: 1000,
    totalSpent: 300,
    byCategory: [{ category_id: 1, category_name: 'Food', total: '300.00' }],
    daily: [{ date: '2026-10-01', total: 300 }]
  });
  assert.strictEqual(s.month, '2026-10');
  assert.strictEqual(s.by_category[0].total, 300);
  assert.strictEqual(s.daily.length, 1);
});
