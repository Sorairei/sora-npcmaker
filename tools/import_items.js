#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PRIMARY_TYPE_CATEGORIES = {
  ammunition: 'Ammunition',
  amulets: 'Amulets',
  armors: 'Armors',
  'axe weapons': 'Axe',
  books: 'Books',
  boots: 'Boots',
  'club weapons': 'Club',
  containers: 'Containers',
  'creature products': 'Products',
  'distance weapons': 'Distance',
  food: 'Food',
  helmets: 'Helmets',
  legs: 'Legs',
  'fist weapons': 'Fist',
  rings: 'Rings',
  rods: 'Rods',
  runes: 'Runes',
  shields: 'Shields',
  'soul cores': 'Soul Core',
  spellbooks: 'Spellbooks',
  'sword weapons': 'Sword',
  tools: 'Tools',
  valuables: 'Valuables',
  wands: 'Wands'
};

const WEAPON_TYPE_CATEGORIES = {
  ammunition: 'Ammunition',
  axe: 'Axe',
  club: 'Club',
  distance: 'Distance',
  fist: 'Fist',
  sword: 'Sword',
  wand: 'Wands'
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

function categoryFor(item) {
  const attributes = item.attributes || {};
  const primaryType = (attributes.primarytype || '').trim().toLowerCase();
  if (PRIMARY_TYPE_CATEGORIES[primaryType]) return PRIMARY_TYPE_CATEGORIES[primaryType];

  const weaponType = (attributes.weapontype || '').trim().toLowerCase();
  if (WEAPON_TYPE_CATEGORIES[weaponType]) return WEAPON_TYPE_CATEGORIES[weaponType];

  if ((attributes.slottype || '').toLowerCase() === 'head') return 'Helmets';
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
    gitChanged: false, gitUntracked: false, orderFromRef: null, replaceSelected: false
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
  console.log(JSON.stringify({ added: added.length, counts, excluded, unresolved }, null, 2));
}

if (require.main === module) main();

module.exports = { categoryFor, isRelevant, parseItemsXml, readItemsObject };
