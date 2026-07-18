const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { buildDataset, parseNpcTemplate, parseReferencePrices } = require('../tools/import_shop_templates');

const appData = {
  items: {
    '3003': { name: 'rope', category: 'Tools' },
    '3350': { name: 'bow', category: 'Distance' },
    '9000': { name: 'quest token', category: 'Others' }
  }
};
const exclusions = { ids: [], namePatterns: ['\\btoken\\b'] };

function npcSource({ currency = '', items = '' } = {}) {
  return `
local internalNpcName = "Test Merchant"
local npcConfig = {}
npcConfig.currency = ${currency || 'nil'}
npcConfig.outfit = { lookType = 128, lookHead = 10 }
npcConfig.shop = {
${items}
}
npcHandler:setMessage(MESSAGE_GREET, "Welcome, |PLAYERNAME|.")
npcHandler:setMessage(MESSAGE_FAREWELL, "Goodbye.")
`;
}

test('imports only catalogued gold shop entries and static identity fields', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shop-template-'));
  const filename = path.join(directory, 'merchant.lua');
  fs.writeFileSync(filename, npcSource({
    items: [
      '  { itemName = "rope", clientId = 3003, buy = 50, sell = 15 },',
      '  { itemName = "quest token", clientId = 9000, sell = 100 },',
      '  { itemName = "missing", clientId = 9999, buy = 1 },'
    ].join('\n')
  }).replace('npcConfig.currency = nil\n', ''));

  const result = parseNpcTemplate(filename, appData, exclusions);

  assert.equal(result.template.name, 'Test Merchant');
  assert.deepEqual(result.template.outfit, [128, 10, 0, 0, 0, 0, 0]);
  assert.deepEqual(result.template.items, [[3003, 50, 15, 0]]);
  assert.equal(result.template.greet, 'Welcome, |PLAYERNAME|.');
  assert.equal(result.excludedItems, 2);
});

test('rejects shops that declare an alternative currency', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shop-template-'));
  const filename = path.join(directory, 'token-shop.lua');
  fs.writeFileSync(filename, npcSource({
    currency: '9000',
    items: '  { itemName = "rope", clientId = 3003, buy = 50 },'
  }));

  assert.deepEqual(parseNpcTemplate(filename, appData, exclusions), { excludedCurrency: true });
});

test('drops quest-oriented greetings while retaining the commercial shop', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shop-template-'));
  const filename = path.join(directory, 'merchant.lua');
  const source = npcSource({
    items: '  { itemName = "rope", clientId = 3003, buy = 50 },'
  }).replace('npcConfig.currency = nil\n', '')
    .replace('Welcome, |PLAYERNAME|.', 'I have a quest reward for your mission.');
  fs.writeFileSync(filename, source);
  const result = parseNpcTemplate(filename, appData, {
    ...exclusions,
    messagePatterns: ['\\bquest\\b', '\\bmission\\b', '\\breward\\b']
  });

  assert.equal(result.template.greet, '');
  assert.equal(result.template.items.length, 1);
});

test('deduplicates NPC names and builds best Tibia RL reference prices', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shop-template-'));
  fs.writeFileSync(path.join(directory, 'first.lua'), npcSource({
    items: '  { itemName = "bow", clientId = 3350, buy = 400, sell = 100 },'
  }).replace('npcConfig.currency = nil\n', ''));
  fs.writeFileSync(path.join(directory, 'second.lua'), npcSource({
    items: [
      '  { itemName = "bow", clientId = 3350, buy = 350, sell = 120 },',
      '  { itemName = "rope", clientId = 3003, buy = 50 },'
    ].join('\n')
  }).replace('npcConfig.currency = nil\n', ''));

  const dataset = buildDataset(directory, appData, exclusions);

  assert.equal(dataset.templates.length, 1);
  assert.deepEqual(dataset.references['3350'], [350, 120]);
  assert.deepEqual(dataset.references['3003'], [50, 0]);
});

test('uses the primary RL price table while retaining missing NPC reference sides', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shop-template-'));
  const filename = path.join(directory, 'prices.lua');
  fs.writeFileSync(filename, [
    '{ itemName = "bow", clientId = 3350, buy = 400 },',
    '{ itemName = "quest token", clientId = 9000, sell = 500 }'
  ].join('\n'));
  fs.writeFileSync(path.join(directory, 'merchant.lua'), npcSource({
    items: '  { itemName = "bow", clientId = 3350, buy = 350, sell = 120 },'
  }).replace('npcConfig.currency = nil\n', ''));
  const primary = parseReferencePrices(filename, appData, exclusions);
  const dataset = buildDataset(directory, appData, exclusions, primary);

  assert.deepEqual(primary, [{ id: '3350', name: 'bow', buy: 400, sell: 0, count: 0 }]);
  assert.deepEqual(dataset.references['3350'], [400, 120]);
  assert.equal(dataset.meta.primaryPriceItems, 1);
});
