// tests/lactose_no_dairy_gate.mjs — Lactose Intolerant is No Dairy too (2026-10-18, v31-standard.31).
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

test('the import: "Lactose intolerant" brings both tags, and its only proposals on today\'s list add No Dairy to 1207 and 301a', () => {
  const state = json('door_state.json');
  const store = { concLearnedNR: '{}', concDismissedDiffs: '{}', concCustomTagRules: '[]' };
  const REGISTRY_LIST = state.residents.map(r => ({ ...r })), REGISTRY_MAP = {};
  REGISTRY_LIST.forEach(r => { REGISTRY_MAP[r.room.toLowerCase()] = r; });
  const box = { console, REGISTRY_LIST, REGISTRY_MAP, anaphRooms: [], changesQueue: [], IMPORT_STATE: null, MEAL: { lunch: 'lunch' },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem() {}, removeItem() {} },
    document: { getElementById: () => null, querySelectorAll: () => [] }, showToast() {}, escapeHtml: s => String(s), _escAttr: s => String(s) };
  vm.createContext(box);
  vm.runInContext([bracedConst('TAG_LABELS_MAP'), fn('getRoomBase'), between('const IMPORT_TAG_RULES = [', '\nfunction handleImportFile(')].join('\n'), box);
  const parsed = out(vm.runInContext("normalizeRestriction('Lactose Intolerant')", box));
  assert.deepEqual(Object.keys(parsed.tags).filter(k => parsed.tags[k]).sort(), ['lactoIntolerant', 'noDairy']);
  const entries = vm.runInContext('REGISTRY_LIST.filter(r => r.rawRestriction).map(r => ({ room: r.room, parsed: normalizeRestriction(r.rawRestriction) }))', box);
  const d = out(vm.runInContext('diffImportAgainstRegistry(' + JSON.stringify(entries) + ')', box));
  const labels = out(vm.runInContext('TAG_LABELS_MAP', box));
  const proposals = d.updates.map(u => {
    const added = Object.keys(u.newTags).filter(k => u.newTags[k] && !u.oldTags[k]).map(k => labels[k]);
    const removed = Object.keys(u.oldTags).filter(k => u.oldTags[k] && !u.newTags[k]).map(k => labels[k]);
    return u.room + ' +' + added.join(',') + (removed.length ? ' -' + removed.join(',') : '');
  }).sort();
  assert.deepEqual(proposals, ['1207 +No Dairy', '301a +No Dairy']);
  for (const room of ['1207', '301a']) assert.ok(state.residents.find(r => r.room === room).tags.includes('Lactose Intolerant'), room);
});
