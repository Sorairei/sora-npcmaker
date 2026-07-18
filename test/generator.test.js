const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const generatorSource = fs.readFileSync(path.join(__dirname, '..', 'generator.js'), 'utf8');
const context = { window: {} };
vm.runInNewContext(generatorSource, context, { filename: 'generator.js' });
const generateLUA = context.window.generateLUA;

function createState(overrides = {}) {
  return {
    name: '',
    health: null,
    walkInterval: null,
    walkRadius: null,
    outfit: {
      lookType: 128,
      lookHead: 0,
      lookBody: 0,
      lookLegs: 0,
      lookFeet: 0,
      lookAddons: 0,
      mount: 0
    },
    dialogue: {
      greet: 'Hello |PLAYERNAME|.',
      farewell: 'Farewell.',
      walkaway: 'How rude!'
    },
    keywords: [],
    tradeItems: [],
    ...overrides
  };
}

test('generates a valid default NPC configuration', () => {
  const lua = generateLUA(createState());

  assert.match(lua, /local internalNpcName = "Default NPC"/);
  assert.match(lua, /npcConfig\.health = 100/);
  assert.match(lua, /npcConfig\.walkInterval = 2000/);
  assert.match(lua, /npcConfig\.walkRadius = 2/);
  assert.match(lua, /npcType:register\(npcConfig\)\n$/);
});

test('preserves a stationary NPC walk radius of zero', () => {
  const lua = generateLUA(createState({ walkRadius: 0 }));

  assert.match(lua, /npcConfig\.walkRadius = 0/);
});

test('falls back from invalid numeric configuration values', () => {
  const lua = generateLUA(createState({ health: -5, walkInterval: 'invalid', walkRadius: -1 }));

  assert.match(lua, /npcConfig\.health = 100/);
  assert.match(lua, /npcConfig\.walkInterval = 2000/);
  assert.match(lua, /npcConfig\.walkRadius = 2/);
});

test('escapes user-provided Lua strings', () => {
  const lua = generateLUA(createState({
    name: 'The "Mage"\\Keeper',
    dialogue: {
      greet: 'First\r\nSecond\t"quoted"',
      farewell: 'Farewell.',
      walkaway: 'How rude!'
    },
    keywords: [{ trigger: 'spell"book', response: 'C:\\runes\nready' }]
  }));

  assert.match(lua, /The \\"Mage\\"\\\\Keeper/);
  assert.match(lua, /First\\r\\nSecond\\t\\"quoted\\"/);
  assert.match(lua, /spell\\"book/);
  assert.match(lua, /C:\\\\runes\\nready/);
});

test('includes configured shop prices and callbacks', () => {
  const lua = generateLUA(createState({
    tradeItems: [{ id: 2160, name: 'crystal coin', buy: 10000, sell: 9500 }]
  }));

  assert.match(lua, /itemName = "crystal coin", clientId = 2160, buy = 10000, sell = 9500/);
  assert.match(lua, /npcType\.onBuyItem/);
  assert.match(lua, /npcType\.onSellItem/);
});

test('sanitizes numeric outfit and shop values before emitting Lua', () => {
  const lua = generateLUA(createState({
    outfit: {
      lookType: 'invalid',
      lookHead: -1,
      lookBody: '22px',
      lookLegs: 33.8,
      lookFeet: Infinity,
      lookAddons: -2,
      mount: 'not-a-mount'
    },
    tradeItems: [
      { id: '3043', name: 'crystal coin', buy: '10000.9', sell: Infinity },
      { id: 'invalid', name: 'broken item', buy: 100, sell: 0 },
      { id: 3031, name: 'gold coin', buy: 0, sell: 0 }
    ]
  }));

  assert.match(lua, /lookType = 128/);
  assert.match(lua, /lookHead = 0/);
  assert.match(lua, /lookBody = 22/);
  assert.match(lua, /lookLegs = 33/);
  assert.match(lua, /lookFeet = 0/);
  assert.match(lua, /lookAddons = 0/);
  assert.doesNotMatch(lua, /lookMount/);
  assert.match(lua, /clientId = 3043, buy = 10000/);
  assert.doesNotMatch(lua, /broken item|gold coin|Infinity|NaN/);
});
