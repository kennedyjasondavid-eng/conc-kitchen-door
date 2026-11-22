// Seed registry labels (2026-11-22, v31-standard.136). The resident-list import "Load everyone" button runs
// seedRegistryFromRoster(IMPORT_STATE.entries), which read tagLabels without ever defining it (a local of other
// functions), so pressing it threw a ReferenceError and set up nothing. The labels now come from each entry parsed
// tags through importTagLabels, the way commitImportToQueue does, and each record goes through the compliance-docs
// writer as a new person (doorApplyDocTags, C1). Red on main 13e0aa2 (SR-1, SR-2, SR-3) and ed97d83 (SR-1, SR-2, SR-3, SR-5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function fnSrc(name) {
  const i = html.indexOf('function ' + name + '(');
  assert.ok(i >= 0, name);
  const j = html.indexOf('\n}\n', i);
  return html.slice(i, j + 2);
}
function coreSrc(name) {
  const a = html.indexOf('/* DOOR_TESTABLE_CORE_START ' + name + ' */');
  const b = html.indexOf('/* DOOR_TESTABLE_CORE_END ' + name + ' */');
  assert.ok(a >= 0 && b > a, name);
  return html.slice(a, b);
}
function constSrc(name) {
  const i = html.indexOf('const ' + name + ' = {');
  assert.ok(i >= 0, name);
  const j = html.indexOf('\n};\n', i);
  return html.slice(i, j + 3);
}

function sandbox(guardOk = true) {
  const store = {};
  const c = {
    REGISTRY_LIST: [], REGISTRY_MAP: {}, IMPORT_STATE: { fileName: 'list.xlsx' }, calls: [],
    localStorage: { setItem: (k, v) => { store[k] = String(v); }, getItem: (k) => store[k] ?? null },
    document: { querySelector: () => null, getElementById: () => null },
    console,
  };
  vm.createContext(c);
  const stubs = ['saveRegistryState', 'setRegistryProvenance', 'logMenuEvent', 'closeImportDialog', 'renderRegistry',
    'updateSyncBar', 'updateDailyImportPrompt', 'publishAndSync', 'showScreen', 'buildReview', 'showToast', 'doorIcon']
    .map(n => 'function ' + n + '(){ calls.push(' + JSON.stringify(n) + '); return ""; }').join('\n');
  vm.runInContext([
    'function doorSiteGuard(){ return ' + guardOk + '; }',
    stubs,
    constSrc('TAG_LABELS_MAP'), constSrc('COMPLIANCE_TIERS'),
    fnSrc('importTagLabels'), fnSrc('importSectionForTags'), coreSrc('compliance-docs'),
    fnSrc('seedRegistryFromRoster'),
  ].join('\n'), c);
  return { c, store };
}

const entries = [
  { room: '101A', parsed: { tags: {}, rawText: '' } },
  { room: '102B', parsed: { tags: { halal: true }, rawText: 'halal' } },
  { room: '103C', parsed: { tags: { glutenFree: true, noPork: true }, rawText: 'celiac, no pork' } },
];

test('SR-1 Load everyone sets up the resident list without throwing', () => {
  const { c, store } = sandbox();
  c.entries = entries;
  assert.doesNotThrow(() => vm.runInContext('seedRegistryFromRoster(entries)', c));
  assert.equal(c.REGISTRY_LIST.length, 3);
  assert.equal(store.concLastImportCount, '3');
  assert.ok(c.calls.includes('saveRegistryState'));
  assert.ok(c.calls.includes('publishAndSync'));
});

test('SR-2 each resident gets the labels and confirm state of their parsed tags', () => {
  const { c } = sandbox();
  c.entries = entries;
  vm.runInContext('seedRegistryFromRoster(entries)', c);
  const by = Object.fromEntries(c.REGISTRY_LIST.map(r => [r.room, r]));
  assert.deepEqual([...by['101A'].tags], ['Regular']);
  assert.equal(by['101A'].section, 'Regular');
  assert.equal(by['101A'].confirm, 'N/A');
  assert.deepEqual([...by['102B'].tags], ['Halal']);
  assert.equal(by['102B'].section, 'Halal');
  assert.equal(by['102B'].confirm, 'Confirmed');
  assert.equal(by['102B'].confirmBy, 'Auto');
  assert.deepEqual([...by['103C'].tags].sort(), ['GF', 'No Pork']);
  assert.equal(by['103C'].section, 'Gluten Free');
  assert.equal(by['103C'].confirm, 'Provisional');
  assert.equal(by['103C'].confirmBy, '—');
  assert.equal(c.REGISTRY_MAP['103c'], by['103C']);
});

test('SR-3 the labels are read from the entry parsed tags', () => {
  const src = fnSrc('seedRegistryFromRoster');
  assert.match(src, /const tagLabels = importTagLabels\(e\.parsed\.tags\)/);
});

test('SR-4 the site guard stays first and another site sets up nothing', () => {
  const src = fnSrc('seedRegistryFromRoster');
  const firstLine = src.split('\n')[1].trim();
  assert.match(firstLine, /^if \(typeof doorSiteGuard === 'function' && !doorSiteGuard\(\)\) return false;/);
  const { c } = sandbox(false);
  c.entries = entries;
  assert.equal(vm.runInContext('seedRegistryFromRoster(entries)', c), false);
  assert.equal(c.REGISTRY_LIST.length, 0);
});

test('SR-5 each seeded record goes through the compliance-docs writer as a new person', () => {
  const src = fnSrc('seedRegistryFromRoster');
  assert.match(src, /doorApplyDocTags\(r, r\.tags, \{ newPerson: true \}\)/);
  const { c } = sandbox();
  c.entries = entries;
  vm.runInContext('seedRegistryFromRoster(entries)', c);
  for (const r of c.REGISTRY_LIST) {
    assert.equal(r.docs, undefined, r.room + ' starts with no answers');
    assert.equal(r.complianceResolved, '', r.room + ' carries no resolved mark');
  }
});
