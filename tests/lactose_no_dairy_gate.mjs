// tests/lactose_no_dairy_gate.mjs — Lactose Intolerant is No Dairy too (2026-10-18, v31-standard.32).
// Jason, 2026-10-18: "Lactose intolerant should be no dairy too" (the audit plan's L2). Lactose Intolerant already opened
// the No Dairy section like No Dairy, and the import's parser already gives both tags. Two rules still read it apart:
// the conflict check (RESIDENT_TO_MEAL_FLAG had No Dairy only) and the plating-sheet note ("no dairy" vs "dairy-free", so a
// resident with both read it twice). Now every rule that reads No Dairy reads Lactose Intolerant the same way, without
// rewriting a stored record. The import's "add No Dairy" for the two lactose-intolerant residents without it (1207, 301a)
// is now the right proposal; accepting it changes nothing on their plate.
// Runs the REAL tables and functions from index.html in a vm. Authored to fail on main 9cf22d9.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const json = (f) => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'));
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) { return between('function ' + name + '(', '\n}\n') + '\n}\n'; }
function bracedConst(name) {
  const start = html.indexOf('const ' + name + ' =');
  assert.ok(start >= 0, 'missing ' + name);
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}') { depth--; if (depth === 0) break; } }
  return html.slice(start, html.indexOf(';', i) + 1);
}

const c = {};
vm.createContext(c);
vm.runInContext([
  between('const ROUTING_TAGS = new Set([', ']);') + ']);',
  between('const RESIDENT_TO_MEAL_FLAG = {', '\n};\n') + '\n};\n', fn('checkResidentMealConflicts'),
  between('const CONFLICT_MAP = [', '\n];\n') + '\n];\n', fn('getIngredientConflicts'),
  between('const ROUTING_RULES = [', '// ============================================================') + between('function computeSections(', 'let mcWeek ='),
  'this.__T = { R2M: RESIDENT_TO_MEAL_FLAG, CM: CONFLICT_MAP, RR: ROUTING_RULES };',
].join('\n'), c, { filename: 'index.html#lactose', timeout: 5000 });
const out = (v) => JSON.parse(JSON.stringify(v));
const T = out(c.__T);

test('every rule that reads No Dairy reads Lactose Intolerant the same way', () => {
  assert.equal(T.R2M['Lactose Intolerant'], T.R2M['No Dairy'], 'conflict check');
  const rows = (tag) => T.CM.filter(r => r.residentTag === tag).map(r => r.mealFlag + '|' + r.note);
  assert.deepEqual(rows('Lactose Intolerant'), rows('No Dairy'), 'plating-sheet note');
  const rule = (tag) => (T.RR.find(r => r.tags.includes(tag)) || {}).key;
  assert.equal(rule('Lactose Intolerant'), rule('No Dairy'), 'routing section');
  // Lactose intolerance is not anaphylaxis: the anaphylactic picker offers No Dairy, not Lactose Intolerant (unchanged).
  assert.doesNotMatch(fn('populateAnaphTags'), /'Lactose Intolerant'/);
});

test('the conflict check warns a lactose-intolerant resident on a dairy meal, as it does No Dairy', () => {
  const conflicts = (tags, meal) => out(c.checkResidentMealConflicts(meal, { tags })).map(x => x.tag + '|' + x.mealFlag);
  assert.deepEqual(conflicts(['Lactose Intolerant'], { hasDairy: true }), ['Lactose Intolerant|hasDairy']);
  assert.deepEqual(conflicts(['No Dairy'], { hasDairy: true }), ['No Dairy|hasDairy']);
  assert.deepEqual(conflicts(['Lactose Intolerant'], { hasGluten: true }), [], 'not on a meal without dairy');
});

test('the plating-sheet note is "dairy-free", once, for either tag or both', () => {
  const notes = (tags) => [...new Set(out(c.getIngredientConflicts({ hasDairy: true }, [{ room: '1207', tags }])).map(x => x.note))];
  assert.deepEqual(notes(['Lactose Intolerant']), ['dairy-free']);
  assert.deepEqual(notes(['No Dairy']), ['dairy-free']);
  assert.deepEqual(notes(['No Dairy', 'Lactose Intolerant']), ['dairy-free'], 'one note, not two');
});

test('routing is unchanged: the No Dairy section, merged into the vegan plate; an earlier section still wins', () => {
  const seat = (tags, meal) => out(c.computeSections({ ...meal }, [{ room: '1207', tags }])).find(s => s.residents.some(r => r.room === '1207')).rule.key;
  assert.equal(seat(['Lactose Intolerant'], { hasDairy: true }), 'vegan');
  assert.equal(seat(['Lactose Intolerant'], { hasGluten: true }), 'regular');
  assert.equal(seat(['Halal', 'Lactose Intolerant'], { hasPork: true, hasDairy: true }), 'halal');
});

// Re-pinned 2026-10-18 (Jason, on the documentation tier: "yes, follow your lean"): "Lactose intolerant" no longer adds
// No Dairy on import. Every rule already reads it as No Dairy, and the added tag was doc-tier, so a lactose-intolerant row
// needed documentation that Lactose Intolerant alone does not. So today's list makes no proposals (1207 and 301a were the
// two that would have gained No Dairy), and a row that writes "No Dairy" still gets it.
function importBox(residents) {
  const store = { concLearnedNR: '{}', concDismissedDiffs: '{}', concCustomTagRules: '[]' };
  const REGISTRY_LIST = residents.map(r => ({ ...r })), REGISTRY_MAP = {};
  REGISTRY_LIST.forEach(r => { REGISTRY_MAP[r.room.toLowerCase()] = r; });
  const box = { console, REGISTRY_LIST, REGISTRY_MAP, anaphRooms: [], changesQueue: [], IMPORT_STATE: null, MEAL: { lunch: 'lunch' },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem() {}, removeItem() {} },
    document: { getElementById: () => null, querySelectorAll: () => [] }, showToast() {}, escapeHtml: s => String(s), _escAttr: s => String(s) };
  vm.createContext(box);
  vm.runInContext([bracedConst('TAG_LABELS_MAP'), fn('getRoomBase'), between('const IMPORT_TAG_RULES = [', '\nfunction handleImportFile(')].join('\n'), box);
  vm.runInContext(bracedConst('COMPLIANCE_TIERS') + '\n' + fn('requiresDocumentation'), box);
  return box;
}
const parsedLabels = (box, text) => {
  const p = out(vm.runInContext('normalizeRestriction(' + JSON.stringify(text) + ')', box));
  const labels = out(vm.runInContext('TAG_LABELS_MAP', box));
  return Object.keys(p.tags).filter(k => p.tags[k]).map(k => labels[k]).sort();
};

test('the import: "Lactose intolerant" brings Lactose Intolerant only; a written "No Dairy" still brings No Dairy', () => {
  const box = importBox([]);
  assert.deepEqual(parsedLabels(box, 'Lactose Intolerant'), ['Lactose Intolerant']);
  assert.deepEqual(parsedLabels(box, 'lactose free'), ['Lactose Intolerant']);
  assert.deepEqual(parsedLabels(box, 'No Dairy, Lactose Intolerant'), ['Lactose Intolerant', 'No Dairy']);
  assert.deepEqual(parsedLabels(box, 'DF'), ['No Dairy']);
  assert.deepEqual(parsedLabels(box, 'Lactose Intolerance'), ['Lactose Intolerant']);
  // after a comma the expander writes "No Lactose Intolerant": the whole phrase is read, with nothing left to ask
  for (const t of ['GF, Lactose Intolerant', 'No Dairy, No Eggs, Lactose Intolerant', 'Halal / Lactose Intolerant']) {
    const p = out(vm.runInContext('normalizeRestriction(' + JSON.stringify(t) + ')', box));
    assert.deepEqual([p.unmatched, p.ambiguous], [[], []], t);
    assert.ok(parsedLabels(box, t).includes('Lactose Intolerant'), t);
  }
  assert.equal(vm.runInContext('importSectionForTags({ lactoIntolerant: true })', box), 'No Dairy', 'the import\'s section guess');
});

test('documentation: Lactose Intolerant alone needs none, a written No Dairy still does', () => {
  const box = importBox([]);
  const docs = (labels) => vm.runInContext('requiresDocumentation(' + JSON.stringify(labels) + ')', box);
  assert.equal(docs(parsedLabels(box, 'Lactose intolerant')), false, 'a "Lactose intolerant" row is auto-confirmed');
  assert.equal(docs(['Lactose Intolerant']), false);
  assert.equal(docs(parsedLabels(box, 'No Dairy, Lactose Intolerant')), true, 'a written No Dairy keeps its documentation');
  assert.equal(docs(['No Dairy']), true);
});

test('adding Lactose Intolerant on import waits for review, like No Dairy (it changes routing)', () => {
  const set = between('const MODIFIER_AUTO_ROUTING = new Set([', ']);');
  assert.match(set, /'noDairy'/);
  assert.match(set, /'lactoIntolerant'/, 'a routing tag is never auto-applied');
});

test('today\'s list: the import proposes nothing, and every lactose-intolerant resident still eats as No Dairy', () => {
  const state = json('door_state.json');
  const box = importBox(state.residents);
  const entries = vm.runInContext('REGISTRY_LIST.filter(r => r.rawRestriction).map(r => ({ room: r.room, parsed: normalizeRestriction(r.rawRestriction) }))', box);
  const d = out(vm.runInContext('diffImportAgainstRegistry(' + JSON.stringify(entries) + ')', box));
  assert.deepEqual(d.updates.map(u => u.room), [], 'no proposals');
  const li = state.residents.filter(r => (r.tags || []).includes('Lactose Intolerant'));
  assert.deepEqual(li.map(r => r.room).sort(), ['1115a', '1207', '301a', '412']);
  for (const r of li) {
    assert.ok(out(c.checkResidentMealConflicts({ hasDairy: true }, { tags: r.tags })).some(x => x.mealFlag === 'hasDairy'), r.room + ' warned on dairy');
  }
});
