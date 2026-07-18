const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  categoryEvidenceFor, categoryFor, isRelevant, parseItemsOtb
} = require('../tools/import_items');

test('maps primary item types to the existing catalog categories', () => {
  assert.equal(categoryFor({ name: 'crypt splitter', attributes: { primarytype: 'axe weapons' } }), 'Axe');
  assert.equal(categoryFor({ name: 'stag spellbook', attributes: { primarytype: 'spellbooks' } }), 'Spellbooks');
  assert.equal(categoryFor({ name: 'gold tooth', attributes: { primarytype: 'creature products' } }), 'Products');
});

test('uses weaponType when primarytype is absent', () => {
  assert.equal(categoryFor({ name: 'staff', attributes: { weapontype: 'club' } }), 'Club');
  assert.equal(categoryFor({ name: 'bow', attributes: { weapontype: 'distance' } }), 'Distance');
  assert.equal(categoryFor({ name: 'pair of iron fists', attributes: { weapontype: 'fist' } }), 'Fist');
  assert.equal(categoryFor({ name: 'shield', attributes: { weapontype: 'shield' } }), 'Shields');
  assert.equal(categoryFor({ name: 'rod of destruction', attributes: { weapontype: 'wand' } }), 'Rods');
  assert.equal(categoryFor({ name: 'wand of vortex', attributes: { weapontype: 'wand' } }), 'Wands');
});

test('uses canonical primarytype before conflicting engine weapon types', () => {
  assert.equal(categoryFor({
    name: 'crypt strike',
    attributes: { primarytype: 'fist weapons', weapontype: 'club' }
  }), 'Fist');
  assert.equal(categoryFor({
    name: 'stag spellbook',
    attributes: { primarytype: 'spellbooks', weapontype: 'shield' }
  }), 'Spellbooks');
});

test('keeps ambiguous items in Others without positive category evidence', () => {
  assert.equal(categoryFor({ name: 'bounty talisman', attributes: { slottype: 'ammo' } }), 'Others');
  assert.equal(categoryEvidenceFor({ name: 'quest token', attributes: { primarytype: 'quest items' } }), null);
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

test('reads IDs and structural flags from an items.otb tree', (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'npcmaker-otb-'));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const filename = path.join(directory, 'items.otb');
  const serverId = 17828;
  const bytes = Buffer.from([
    0, 0, 0, 0,
    0xfe, 0, 0, 0, 0, 0,
    0xfe, 0, 0x70, 0, 0, 0,
    0x10, 2, 0, serverId & 0xff, serverId >> 8,
    0x11, 2, 0, serverId & 0xff, serverId >> 8,
    0xff, 0xff
  ]);
  fs.writeFileSync(filename, bytes);

  const item = parseItemsOtb(filename).get(String(serverId));
  assert.equal(item.serverId, serverId);
  assert.equal(item.clientId, serverId);
  assert.equal(item.usable, true);
  assert.equal(item.pickupable, true);
  assert.equal(item.movable, true);
});
