const test = require('node:test');
const assert = require('node:assert/strict');

const { categoryFor, isRelevant } = require('../tools/import_items');

test('maps primary item types to the existing catalog categories', () => {
  assert.equal(categoryFor({ name: 'crypt splitter', attributes: { primarytype: 'axe weapons' } }), 'Axe');
  assert.equal(categoryFor({ name: 'stag spellbook', attributes: { primarytype: 'spellbooks' } }), 'Spellbooks');
  assert.equal(categoryFor({ name: 'gold tooth', attributes: { primarytype: 'creature products' } }), 'Products');
});

test('uses weaponType when primarytype is absent', () => {
  assert.equal(categoryFor({ name: 'staff', attributes: { weapontype: 'club' } }), 'Club');
  assert.equal(categoryFor({ name: 'bow', attributes: { weapontype: 'distance' } }), 'Distance');
});

test('recognizes fist weapons and keeps ambiguous items in Others', () => {
  assert.equal(categoryFor({ name: 'crypt strike', attributes: { weapontype: 'fist' } }), 'Fist');
  assert.equal(categoryFor({ name: 'bounty talisman', attributes: { slottype: 'ammo' } }), 'Others');
});

test('recognizes conservative name and slot fallbacks', () => {
  assert.equal(categoryFor({ name: 'charred mask', attributes: { slottype: 'head' } }), 'Helmets');
  assert.equal(categoryFor({ name: 'superior mana potion', attributes: {} }), 'Potions');
  assert.equal(categoryFor({ name: 'pirate cook soul core', attributes: {} }), 'Soul Core');
});

test('excludes decaying corpse states from the catalog', () => {
  assert.equal(isRelevant({
    name: 'dead goblin scavenger',
    attributes: { containersize: '48', decayto: '52752', duration: '600' }
  }), false);
  assert.equal(isRelevant({ name: 'deadly fangs', attributes: {} }), true);
});
