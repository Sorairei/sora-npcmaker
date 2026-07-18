#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PRIMARY_TYPE_CATEGORIES = {
  ammunition: 'Ammunition',
  amulets: 'Amulets',
  'amulets and necklaces': 'Amulets',
  armors: 'Armors',
  'attack runes': 'Runes',
  'axe weapons': 'Axe',
  books: 'Books',
  boots: 'Boots',
  'club weapons': 'Club',
  containers: 'Containers',
  'creature products': 'Products',
  decoration: 'Household',
  'distance weapons': 'Distance',
  'documents and papers': 'Books',
  'dolls and bears': 'Household',
  'exercise weapons': 'Exercise',
  food: 'Food',
  'floor decorations': 'Household',
  flowers: 'Household',
  furniture: 'Household',
  'game tokens': 'Valuables',
  'healing runes': 'Runes',
  helmets: 'Helmets',
  keys: 'Tools',
  'kitchen tools': 'Tools',
  legs: 'Legs',
  'light sources': 'Household',
  liquids: 'Potions',
  metals: 'Products',
  'musical instruments': 'Household',
  'natural products': 'Products',
  'painting equipment': 'Tools',
  'party items': 'Household',
  quivers: 'Containers',
  'fist weapons': 'Fist',
  rings: 'Rings',
  rods: 'Rods',
  runes: 'Runes',
  shields: 'Shields',
  'soul cores': 'Soul Core',
  spellbooks: 'Spellbooks',
  'support runes': 'Runes',
  'sword weapons': 'Sword',
  'taming items': 'Tools',
  tools: 'Tools',
  'tools (objects)': 'Tools',
  'training weapons': 'Exercise',
  trophies: 'Household',
  valuables: 'Valuables',
  'wall hangings': 'Household',
  wands: 'Wands'
};

const WEAPON_TYPE_CATEGORIES = {
  ammunition: 'Ammunition',
  ammo: 'Ammunition',
  axe: 'Axe',
  club: 'Club',
  distance: 'Distance',
  fist: 'Fist',
  missile: 'Distance',
  shield: 'Shields',
  spellbook: 'Spellbooks',
  sword: 'Sword'
};

function decodeXml(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function parseTagAttributes(tag) {
  const result = {};
  const pattern = /([\w:-]+)\s*=\s*(["'])(.*?)\2/gs;
  let match;
  while ((match = pattern.exec(tag))) {
    result[match[1].toLowerCase()] = decodeXml(match[3]);
  }
  return result;
}

function readXmlText(filename) {
  const bytes = fs.readFileSync(filename);
  const declaration = bytes.subarray(0, 160).toString('ascii');
  const encoding = /encoding=["'](?:ISO-8859-1|latin-?1)["']/i.test(declaration)
    ? 'latin1'
    : 'utf8';
  return bytes.toString(encoding);
}

function parseItemsXml(filename) {
  const xml = readXmlText(filename);
  const items = new Map();
  const itemPattern = /<item\b([^>]*?)(?:\/>|>([\s\S]*?)<\/item>)/gi;
  let match;

  while ((match = itemPattern.exec(xml))) {
    const itemAttributes = parseTagAttributes(match[1]);
    const attributes = {};
    const body = match[2] || '';
    const attributePattern = /<attribute\b([^>]*?)\/>/gi;
    let attributeMatch;
    while ((attributeMatch = attributePattern.exec(body))) {
      const parsed = parseTagAttributes(attributeMatch[1]);
      if (parsed.key) attributes[parsed.key.toLowerCase()] = parsed.value || '';
    }

    const from = Number(itemAttributes.fromid || itemAttributes.id);
    const to = Number(itemAttributes.toid || itemAttributes.id);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from > to) continue;

    for (let id = from; id <= to; id += 1) {
      items.set(String(id), {
        name: itemAttributes.name || `Item ${id}`,
        attributes
      });
    }
  }

  return items;
}

function parseOtbTree(bytes) {
  let offset = 4; // Four-byte OTB file signature.

  function readNode() {
    if (bytes[offset++] !== 0xfe) throw new Error(`Invalid OTB node at byte ${offset - 1}.`);
    const type = bytes[offset++];
    const data = [];
    const children = [];

    while (offset < bytes.length) {
      const value = bytes[offset++];
      if (value === 0xfd) {
        if (offset >= bytes.length) throw new Error('Truncated OTB escape sequence.');
        data.push(bytes[offset++]);
      } else if (value === 0xfe) {
        offset -= 1;
        children.push(readNode());
      } else if (value === 0xff) {
        return { type, data: Buffer.from(data), children };
      } else {
        data.push(value);
      }
    }
    throw new Error('Unterminated OTB node.');
  }

  const root = readNode();
  if (offset !== bytes.length) throw new Error('Unexpected bytes after the OTB root node.');
  return root;
}

function parseItemsOtb(filename) {
  const root = parseOtbTree(fs.readFileSync(filename));
  const items = new Map();

  for (const node of root.children) {
    if (node.data.length < 4) continue;
    const flags = node.data.readUInt32LE(0);
    const attributes = {};
    let offset = 4;
    while (offset + 3 <= node.data.length) {
      const type = node.data[offset++];
      const length = node.data.readUInt16LE(offset);
      offset += 2;
      if (offset + length > node.data.length) throw new Error('Truncated OTB item attribute.');
      const value = node.data.subarray(offset, offset + length);
      offset += length;
      if (type === 0x10 && length === 2) attributes.serverId = value.readUInt16LE(0);
      else if (type === 0x11 && length === 2) attributes.clientId = value.readUInt16LE(0);
    }

    if (!attributes.serverId) continue;
    items.set(String(attributes.serverId), {
      serverId: attributes.serverId,
      clientId: attributes.clientId || 0,
      group: node.type,
      flags,
      usable: Boolean(flags & (1 << 4)),
      pickupable: Boolean(flags & (1 << 5)),
      movable: Boolean(flags & (1 << 6)),
      stackable: Boolean(flags & (1 << 7)),
      deprecated: node.type === 14
    });
  }
  return items;
}

function categoryEvidenceFor(item) {
  const attributes = item.attributes || {};
  const primaryType = (attributes.primarytype || '').trim().toLowerCase();
  if (PRIMARY_TYPE_CATEGORIES[primaryType]) return PRIMARY_TYPE_CATEGORIES[primaryType];

  const weaponType = (attributes.weapontype || '').trim().toLowerCase();
  if (weaponType === 'wand') {
    if (/\brod\b/i.test(item.name)) return 'Rods';
    if (/\bwand\b/i.test(item.name)) return 'Wands';
    return null;
  }
  if (WEAPON_TYPE_CATEGORIES[weaponType]) return WEAPON_TYPE_CATEGORIES[weaponType];

  if ((attributes.slottype || '').toLowerCase() === 'head') return 'Helmets';
  return null;
}

function categoryFor(item) {
  const evidence = categoryEvidenceFor(item);
  if (evidence) return evidence;

  if (/\bsoul core$/i.test(item.name)) return 'Soul Core';
  if (/\bpotion\b/i.test(item.name)) return 'Potions';
  if (/\bbook\b/i.test(item.name)) return 'Books';
  return 'Others';
}

function isRelevant(item) {
  const attributes = item.attributes || {};
  const isCorpseState = attributes.containersize || attributes.decayto || attributes.duration;
  return !(/^dead\b/i.test(item.name) && isCorpseState);
}

function parseArguments(argv) {
  const options = {
    xml: [], data: 'data.js', items: 'items', overrides: null, dryRun: false,
    gitChanged: false, gitUntracked: false, orderFromRef: null, replaceSelected: false,
    auditExisting: false, otb: null, pruneNonPickupable: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--xml') options.xml.push(argv[++index]);
    else if (argument === '--data') options.data = argv[++index];
    else if (argument === '--items') options.items = argv[++index];
    else if (argument === '--overrides') options.overrides = argv[++index];
    else if (argument === '--dry-run') options.dryRun = true;
    else if (argument === '--git-changed') options.gitChanged = true;
    else if (argument === '--git-untracked') options.gitUntracked = true;
    else if (argument === '--order-from-ref') options.orderFromRef = argv[++index];
    else if (argument === '--replace-selected') options.replaceSelected = true;
    else if (argument === '--audit-existing') options.auditExisting = true;
    else if (argument === '--otb') options.otb = argv[++index];
    else if (argument === '--prune-non-pickupable') options.pruneNonPickupable = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.xml.length) throw new Error('At least one --xml file is required.');
  return options;
}

function readItemsObject(source) {
  const startMarker = '  "items":';
  const start = source.indexOf(startMarker);
  const jsonStart = source.indexOf('{', start + startMarker.length);
  const endMatch = /\r?\n  },\r?\n  "categories": \[/.exec(source.slice(jsonStart));
  if (start < 0 || !endMatch) throw new Error('Could not locate APP_DATA.items in data.js.');
  const end = jsonStart + endMatch.index;
  const closing = /^(\r?\n  })/.exec(source.slice(end));
  const jsonEnd = end + closing[1].length;
  const objectSource = source.slice(jsonStart, jsonEnd);
  return {
    start: start + startMarker.length,
    end: jsonEnd,
    items: JSON.parse(objectSource),
    order: Array.from(objectSource.matchAll(/^    "(\d+)": \{/gm), (match) => match[1])
  };
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const xmlItems = new Map();
  for (const filename of options.xml) {
    for (const [id, item] of parseItemsXml(filename)) xmlItems.set(id, item);
  }

  const overrides = options.overrides
    ? JSON.parse(fs.readFileSync(options.overrides, 'utf8'))
    : {};
  const otbItems = options.otb ? parseItemsOtb(options.otb) : null;
  let spriteIds = fs.readdirSync(options.items)
    .map((filename) => /^(\d+)\.gif$/i.exec(filename))
    .filter(Boolean)
    .map((match) => match[1]);
  if (options.gitChanged || options.gitUntracked) {
    const changed = new Set(
      execFileSync('git', ['status', '--porcelain=v1'], { encoding: 'utf8' })
        .split(/\r?\n/)
        .filter((line) => options.gitChanged || line.startsWith('?? '))
        .map((line) => /items\/(\d+)\.gif$/i.exec(line))
        .filter(Boolean)
        .map((match) => match[1])
    );
    spriteIds = spriteIds.filter((id) => changed.has(id));
  }

  const source = fs.readFileSync(options.data, 'utf8');
  const section = readItemsObject(source);
  let itemOrder = section.order;
  if (options.orderFromRef) {
    const repositoryPath = path.relative(process.cwd(), options.data).replace(/\\/g, '/');
    const baseSource = execFileSync(
      'git', ['show', `${options.orderFromRef}:${repositoryPath}`], { encoding: 'utf8' }
    );
    const baseOrder = readItemsObject(baseSource).order;
    const baseIds = new Set(baseOrder);
    itemOrder = baseOrder.concat(section.order.filter((id) => !baseIds.has(id)));
  }
  const added = [];
  const unresolved = [];
  const excluded = [];
  const audited = [];
  const pruned = [];
  const otbCoverage = otbItems ? {
    total: otbItems.size,
    catalog: Object.keys(section.items).filter((id) => otbItems.has(id)).length,
    sprites: spriteIds.filter((id) => otbItems.has(id)).length
  } : null;

  if (options.auditExisting) {
    for (const [id, catalogItem] of Object.entries(section.items)) {
      const xmlItem = xmlItems.get(id);
      if (!xmlItem) continue;
      const category = categoryEvidenceFor(xmlItem);
      if (!category || category === catalogItem.category) continue;
      audited.push({ id, name: xmlItem.name, from: catalogItem.category, to: category });
      catalogItem.category = category;
    }
  }

  if (options.pruneNonPickupable) {
    if (!otbItems) throw new Error('--prune-non-pickupable requires --otb.');
    for (const [id, catalogItem] of Object.entries(section.items)) {
      const otbItem = otbItems.get(id);
      if (!otbItem || otbItem.pickupable) continue;
      pruned.push({ id, name: catalogItem.name, reason: 'not pickupable in items.otb' });
      delete section.items[id];
    }
    const prunedIds = new Set(pruned.map((item) => item.id));
    itemOrder = itemOrder.filter((id) => !prunedIds.has(id));
  }

  if (options.replaceSelected) {
    const selected = new Set(spriteIds);
    for (const id of selected) delete section.items[id];
    itemOrder = itemOrder.filter((id) => !selected.has(id));
  }

  for (const id of spriteIds) {
    if (section.items[id]) continue;
    const xmlItem = xmlItems.get(id);
    const override = overrides[id];
    if (!xmlItem && !override) {
      unresolved.push(id);
      continue;
    }
    if (xmlItem && !isRelevant(xmlItem)) {
      excluded.push({ id, name: xmlItem.name, reason: 'corpse state' });
      continue;
    }
    const item = {
      name: override?.name || xmlItem?.name || `Item ${id}`,
      category: override?.category || categoryFor(xmlItem || { name: override.name, attributes: {} })
    };
    section.items[id] = item;
    itemOrder.push(id);
    added.push({ id, ...item });
  }

  const orderedEntries = itemOrder.map((id) => [id, section.items[id]]);
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const replacement = (' {' + '\n' + orderedEntries.map(([id, item]) => (
    `    ${JSON.stringify(id)}: ${JSON.stringify(item, null, 2).replace(/\n/g, '\n    ')}`
  )).join(',\n') + '\n  }')
    .replace(/\n/g, newline);
  const output = source.slice(0, section.start) + replacement + source.slice(section.end);
  if (!options.dryRun) fs.writeFileSync(options.data, output);

  const counts = {};
  for (const item of added) counts[item.category] = (counts[item.category] || 0) + 1;
  const auditCounts = {};
  for (const item of audited) {
    const change = `${item.from} -> ${item.to}`;
    auditCounts[change] = (auditCounts[change] || 0) + 1;
  }
  console.log(JSON.stringify({
    added: added.length,
    counts,
    audited: audited.length,
    auditCounts,
    otbCoverage,
    pruned,
    excluded,
    unresolved
  }, null, 2));
}

if (require.main === module) main();

module.exports = {
  categoryEvidenceFor, categoryFor, isRelevant, parseItemsOtb, parseItemsXml, readItemsObject
};
