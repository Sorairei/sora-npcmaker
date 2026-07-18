const fs = require('node:fs');
const path = require('node:path');

function parseArguments(argv) {
  const options = {
    data: 'data.js',
    exclusions: path.join('tools', 'shop_template_exclusions.json'),
    output: 'shop_templates.js',
    prices: ''
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--npc-dir') options.npcDir = argv[++index];
    else if (argument === '--data') options.data = argv[++index];
    else if (argument === '--exclusions') options.exclusions = argv[++index];
    else if (argument === '--output') options.output = argv[++index];
    else if (argument === '--prices') options.prices = argv[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.npcDir) throw new Error('--npc-dir is required.');
  return options;
}

function listLuaFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listLuaFiles(filename));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.lua')) files.push(filename);
  }
  return files;
}

function readAppData(filename) {
  const source = fs.readFileSync(filename, 'utf8').trim();
  const start = source.indexOf('{');
  const end = source.lastIndexOf('};');
  if (start < 0 || end < start) throw new Error('Could not locate APP_DATA in data.js.');
  return JSON.parse(source.slice(start, end + 1));
}

function extractTable(source, assignment) {
  const marker = new RegExp(`${assignment.replace('.', '\\.') }\\s*=\\s*\\{`).exec(source);
  if (!marker) return null;
  const start = marker.index + marker[0].lastIndexOf('{');
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start + 1, index);
    }
  }
  return null;
}

function luaString(value) {
  if (!value) return '';
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function readString(source, pattern) {
  const match = pattern.exec(source);
  return match ? luaString(match[1]) : '';
}

function readNumber(source, key, fallback = 0) {
  const match = new RegExp(`\\b${key}\\s*=\\s*(\\d+)`).exec(source || '');
  return match ? Number(match[1]) : fallback;
}

function parseShopEntries(shopSource) {
  const entries = [];
  const entryPattern = /\{([^{}]*\bitemName\s*=\s*"((?:\\.|[^"\\])*)"[^{}]*\bclientId\s*=\s*(\d+)[^{}]*)\}/g;
  for (const match of shopSource.matchAll(entryPattern)) {
    const body = match[1];
    const buy = readNumber(body, 'buy', 0);
    const sell = readNumber(body, 'sell', 0);
    if (!buy && !sell) continue;
    entries.push({
      id: match[3],
      name: luaString(match[2]),
      buy,
      sell,
      count: readNumber(body, 'count', 0)
    });
  }
  return entries;
}

function classifyTemplate(entries, items) {
  const scores = { Equipment: 0, Weapons: 0, Magic: 0, Supplies: 0, Food: 0, Loot: 0 };
  const equipment = new Set(['Amulets', 'Armors', 'Boots', 'Helmets', 'Legs', 'Rings', 'Shields']);
  const weapons = new Set(['Ammunition', 'Axe', 'Club', 'Distance', 'Exercise', 'Fist', 'Sword']);
  const magic = new Set(['Potions', 'Rods', 'Runes', 'Spellbooks', 'Wands']);
  const supplies = new Set(['Containers', 'Tools']);
  for (const entry of entries) {
    const category = items[entry.id]?.category;
    if (equipment.has(category)) scores.Equipment += 1;
    if (weapons.has(category)) scores.Weapons += 1;
    if (magic.has(category)) scores.Magic += 1;
    if (supplies.has(category)) scores.Supplies += 1;
    if (category === 'Food') scores.Food += 1;
    if (!entry.buy && entry.sell) scores.Loot += 0.45;
  }
  const sorted = Object.entries(scores).sort((left, right) => right[1] - left[1]);
  return sorted[0][1] > 0 ? sorted[0][0] : 'General';
}

function parseNpcTemplate(filename, appData, exclusions) {
  const source = fs.readFileSync(filename, 'utf8');
  if (/npcConfig\.currency\s*=/.test(source)) return { excludedCurrency: true };
  const shopSource = extractTable(source, 'npcConfig.shop');
  const outfitSource = extractTable(source, 'npcConfig.outfit');
  if (!shopSource || !outfitSource) return null;

  const excludedIds = new Set((exclusions.ids || []).map(String));
  const namePatterns = (exclusions.namePatterns || []).map((pattern) => new RegExp(pattern, 'i'));
  let excludedItems = 0;
  const merged = new Map();
  for (const entry of parseShopEntries(shopSource)) {
    if (!appData.items[entry.id] || excludedIds.has(entry.id) || namePatterns.some((pattern) => pattern.test(entry.name))) {
      excludedItems += 1;
      continue;
    }
    const previous = merged.get(entry.id + ':' + entry.count);
    if (previous) {
      if (entry.buy) previous.buy = previous.buy ? Math.min(previous.buy, entry.buy) : entry.buy;
      if (entry.sell) previous.sell = Math.max(previous.sell, entry.sell);
    } else {
      merged.set(entry.id + ':' + entry.count, { ...entry });
    }
  }
  const entries = Array.from(merged.values()).sort((left, right) => Number(left.id) - Number(right.id));
  if (!entries.length) return { excludedItems };

  const name = readString(source, /local internalNpcName\s*=\s*"((?:\\.|[^"\\])*)"/);
  if (!name) return null;
  const npcNamePatterns = (exclusions.npcNamePatterns || []).map((pattern) => new RegExp(pattern, 'i'));
  if (npcNamePatterns.some((pattern) => pattern.test(name))) return { excludedItems: entries.length };
  const messagePatterns = (exclusions.messagePatterns || []).map((pattern) => new RegExp(pattern, 'i'));
  const safeMessage = (message) => messagePatterns.some((pattern) => pattern.test(message)) ? '' : message;
  return {
    template: {
      id: path.basename(filename, '.lua').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      name,
      type: classifyTemplate(entries, appData.items),
      outfit: [
        readNumber(outfitSource, 'lookType', 128),
        readNumber(outfitSource, 'lookHead', 0),
        readNumber(outfitSource, 'lookBody', 0),
        readNumber(outfitSource, 'lookLegs', 0),
        readNumber(outfitSource, 'lookFeet', 0),
        readNumber(outfitSource, 'lookAddons', 0),
        readNumber(outfitSource, 'lookMount', 0)
      ],
      greet: safeMessage(readString(source, /setMessage\(MESSAGE_GREET,\s*"((?:\\.|[^"\\])*)"/)),
      farewell: safeMessage(readString(source, /setMessage\(MESSAGE_FAREWELL,\s*"((?:\\.|[^"\\])*)"/)),
      walkaway: safeMessage(readString(source, /setMessage\(MESSAGE_WALKAWAY,\s*"((?:\\.|[^"\\])*)"/)),
      items: entries.map((entry) => [Number(entry.id), entry.buy, entry.sell, entry.count])
    },
    excludedItems
  };
}

function parseReferencePrices(filename, appData, exclusions) {
  if (!filename) return [];
  const excludedIds = new Set((exclusions.ids || []).map(String));
  const namePatterns = (exclusions.namePatterns || []).map((pattern) => new RegExp(pattern, 'i'));
  const entries = parseShopEntries(fs.readFileSync(filename, 'utf8')).filter((entry) => (
    appData.items[entry.id] && !excludedIds.has(entry.id) && !namePatterns.some((pattern) => pattern.test(entry.name))
  ));
  const merged = new Map();
  for (const entry of entries) {
    const previous = merged.get(entry.id);
    if (!previous) merged.set(entry.id, { ...entry });
    else {
      if (entry.buy) previous.buy = previous.buy ? Math.min(previous.buy, entry.buy) : entry.buy;
      if (entry.sell) previous.sell = Math.max(previous.sell, entry.sell);
    }
  }
  return Array.from(merged.values());
}

function buildDataset(npcDirectory, appData, exclusions, referenceEntries = []) {
  const candidates = [];
  let excludedCurrencies = 0;
  let excludedItems = 0;
  for (const filename of listLuaFiles(npcDirectory)) {
    const result = parseNpcTemplate(filename, appData, exclusions);
    if (result?.excludedCurrency) excludedCurrencies += 1;
    if (result?.template) candidates.push(result.template);
    excludedItems += result?.excludedItems || 0;
  }

  const byName = new Map();
  for (const template of candidates) {
    const key = template.name.toLowerCase();
    const previous = byName.get(key);
    const score = template.items.length * 10 + Boolean(template.greet) + Boolean(template.farewell);
    const previousScore = previous
      ? previous.items.length * 10 + Boolean(previous.greet) + Boolean(previous.farewell)
      : -1;
    if (score > previousScore) byName.set(key, template);
  }
  const templates = Array.from(byName.values()).sort((left, right) => left.name.localeCompare(right.name));
  const references = {};
  for (const template of templates) {
    for (const [id, buy, sell] of template.items) {
      const reference = references[id] || [0, 0];
      if (buy) reference[0] = reference[0] ? Math.min(reference[0], buy) : buy;
      if (sell) reference[1] = Math.max(reference[1], sell);
      references[id] = reference;
    }
  }
  const referenceSourceIds = new Set();
  for (const entry of referenceEntries) {
    const reference = references[entry.id] || [0, 0];
    if (entry.buy) reference[0] = entry.buy;
    if (entry.sell) reference[1] = entry.sell;
    references[entry.id] = reference;
    referenceSourceIds.add(entry.id);
  }
  return {
    version: 1,
    meta: {
      templates: templates.length,
      entries: templates.reduce((total, template) => total + template.items.length, 0),
      referenceItems: Object.keys(references).length,
      primaryPriceItems: referenceSourceIds.size,
      excludedCurrencies,
      excludedItems
    },
    templates,
    references
  };
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const appData = readAppData(options.data);
  const exclusions = JSON.parse(fs.readFileSync(options.exclusions, 'utf8'));
  const referenceEntries = parseReferencePrices(options.prices, appData, exclusions);
  const dataset = buildDataset(options.npcDir, appData, exclusions, referenceEntries);
  const output = `// Generated gold-only NPC shop templates.\nwindow.SHOP_TEMPLATE_DATA=${JSON.stringify(dataset)};\n`;
  fs.writeFileSync(options.output, output);
  console.log(JSON.stringify({ ...dataset.meta, bytes: Buffer.byteLength(output) }, null, 2));
}

if (require.main === module) main();

module.exports = { buildDataset, extractTable, parseNpcTemplate, parseReferencePrices, parseShopEntries };
