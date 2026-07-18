const assert = require('node:assert/strict');
const test = require('node:test');
const tools = require('../shop_tools');

test('expands compact template entries with catalog names and subtypes', () => {
  const items = tools.expandTemplateItems({ items: [[3003, 50, 15, 7]] }, {
    '3003': { name: 'rope' }
  });
  assert.deepEqual(items, [{ id: '3003', name: 'rope', buy: 50, sell: 15, count: 7 }]);
});

test('merges only missing item and subtype combinations', () => {
  const current = [{ id: '3003', name: 'rope', buy: 99, sell: 0, count: 0 }];
  const incoming = [
    { id: '3003', name: 'rope', buy: 50, sell: 15, count: 0 },
    { id: '3003', name: 'rope', buy: 50, sell: 15, count: 1 }
  ];
  assert.deepEqual(tools.mergeTradeItems(current, incoming), [current[0], incoming[1]]);
});

test('finds duplicates, self-trade loops, and reference-price deviations', () => {
  const report = tools.analyzeEconomy([
    { id: '3350', name: 'bow', buy: 100, sell: 120 },
    { id: '3350', name: 'bow', buy: 350, sell: 100 }
  ], { '3350': [350, 100] });

  assert.deepEqual(report.summary, { items: 2, warnings: 1, duplicates: 1, loops: 1, referenced: 2 });
  assert.equal(report.results[0].severity, 'danger');
  assert.equal(report.results[0].loop, true);
  assert.equal(report.results[1].duplicate, true);
});
