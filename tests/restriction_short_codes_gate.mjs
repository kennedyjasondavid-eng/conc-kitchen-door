// tests/restriction_short_codes_gate.mjs — GF and DF are read on import, and no short word vanishes (2026-10-18, v31-standard.31).
// The resident-list import (parseImportWorkbook → normalizeRestriction) reads each resident's restriction text. It had
// no rule for "GF" (DOOR's own label for gluten-free) or "DF", and its leftover-word pass returned early for any word
// under 3 letters — before the word was recorded as unmatched. So "GF" was read as nothing and nobody was asked: a new
// resident written "GF" arrived as Regular, "GF, No Pork" as No Pork only, and a re-import proposed taking GF off the five
// residents who have it. Found while scoping the tags/anaph/routing audit (plan L1). Jason, 2026-10-18: "yes DF is dairy
// free". Now GF / G/F / No Gluten read as gluten-free, DF / D/F / dairy-free as No Dairy, and an unknown short word is
// asked about like any other; the comma expander's stray "No" and joining words are still not questions.
// Runs the REAL import module (IMPORT_TAG_RULES … handleImportFile) in a vm. Authored to fail on main 9cf22d9.
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
// The import module in a sandbox, with a resident list for the import's diff (as ambiguous_token_confirm_gate does).
function importSandbox(registry) {
  const store = { concLearnedNR: '{}', concDismissedDiffs: '{}', concCustomTagRules: '[]' };
  const REGISTRY_LIST = (registry || []).map(r => ({ ...r })), REGISTRY_MAP = {};
  REGISTRY_LIST.forEach(r => { REGISTRY_MAP[r.room.toLowerCase()] = r; });
  const box = { console, REGISTRY_LIST, REGISTRY_MAP, anaphRooms: [], changesQueue: [], IMPORT_STATE: null, MEAL: { lunch: 'lunch' },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem() {}, removeItem() {} },
    document: { getElementById: () => null, querySelectorAll: () => [] }, showToast() {}, escapeHtml: s => String(s), _escAttr: s => String(s) };
  vm.createContext(box);
  vm.runInContext([bracedConst('TAG_LABELS_MAP'), fn('getRoomBase'), between('const IMPORT_TAG_RULES = [', '\nfunction handleImportFile(')].join('\n'),
    box, { filename: 'index.html#import-module', timeout: 5000 });
  return box;
}
const sb = importSandbox([]);
const parse = (t) => JSON.parse(JSON.stringify(vm.runInContext('normalizeRestriction(' + JSON.stringify(t) + ')', sb)));
const tags = (t) => Object.keys(parse(t).tags).filter(k => parse(t).tags[k]).sort();

test('GF, however it is written, is gluten-free and only gluten-free', () => {
  for (const t of ['GF', 'gf', 'G/F', 'g / f', 'No Gluten', 'Gluten Free', 'gluten-free']) {
    assert.deepEqual(tags(t), ['glutenFree'], t);
    assert.deepEqual(parse(t).unmatched, [], t + ': nothing left to ask');
  }
  assert.deepEqual(tags('GF, No Pork'), ['glutenFree', 'noPork']);
  assert.deepEqual(tags('Halal / GF'), ['glutenFree', 'halal']);
  assert.deepEqual(tags('Halal/GF'), ['glutenFree', 'halal']);
});

test('DF, however it is written, is No Dairy (Jason: "yes DF is dairy free")', () => {
  for (const t of ['DF', 'df', 'D/F', 'dairy-free', 'Dairy Free']) {
    assert.deepEqual(tags(t), ['noDairy'], t);
    assert.deepEqual(parse(t).unmatched, [], t + ': nothing left to ask');
  }
  assert.deepEqual(tags('GF/DF'), ['glutenFree', 'noDairy']);
  assert.deepEqual(tags('GF, DF'), ['glutenFree', 'noDairy']);
  assert.deepEqual(tags('G/F, D/F'), ['glutenFree', 'noDairy']);
});

test('only the whole word: GFS, PDF and a word holding the letters are not read as GF or DF', () => {
  for (const t of ['GFS', 'PDF', 'Gefilte fish', 'Midfield']) {
    const got = tags(t);
    assert.ok(!got.includes('glutenFree') && !got.includes('noDairy'), t + ' → ' + JSON.stringify(got));
  }
});

test('an unknown short word is asked about; the expander\'s stray "No" and joining words are not', () => {
  assert.deepEqual(parse('XQ').unmatched, ['XQ'], 'an unknown short code is a question, not silence');
  assert.deepEqual(parse('Halal / ZZ').unmatched, ['ZZ']);
  for (const [t, expected] of [
    ['No Pork, Diabetic', []], ['No Pork, No Spicy, Soft Meals', []], ['No Pork, Low Sodium, Diabetic', []],
    ['Halal & No Pork', []], ['No Pork or Beef', []], ['w/ rice', ['rice']], ['Diabetic Diet', ['Diet']],
  ]) assert.deepEqual(parse(t).unmatched, expected, t);
});

test('every published restriction parses with nothing to ask, and GF residents now read as GF', () => {
  const residents = json('door_state.json').residents;
  const raws = [...new Set(residents.map(r => r.rawRestriction).filter(Boolean))];
  for (const raw of raws) {
    const p = parse(raw);
    assert.deepEqual([p.unmatched, p.ambiguous], [[], []], raw);
  }
  const gf = residents.filter(r => (r.tags || []).includes('GF'));
  assert.ok(gf.length >= 4, 'GF residents: ' + gf.length);
  for (const r of gf) assert.ok(tags(r.rawRestriction).includes('glutenFree'), r.room + ' ' + r.rawRestriction);
  // Re-parsing every resident now agrees with their stored tags. Re-pinned 2026-10-18: it differed on 1207 and 301a, where
  // "Lactose Intolerant" also read as No Dairy; that implied tag is gone (Jason: "yes, follow your lean";
  // lactose_no_dairy_gate), since every rule reads Lactose Intolerant as No Dairy.
  const labels = (t) => tags(t).map(k => vm.runInContext('TAG_LABELS_MAP', sb)[k] || k).sort();
  const diffs = [];
  for (const r of residents) {
    if (!r.rawRestriction || r.rawRestriction === 'Regular') continue;
    const parsed = labels(r.rawRestriction), stored = (r.tags || []).filter(t => t !== 'Regular').sort();
    const missing = parsed.filter(t => !stored.includes(t)), extra = stored.filter(t => !parsed.includes(t));
    if (missing.length || extra.length) diffs.push(r.room + ': ' + JSON.stringify({ missing, extra }));
  }
  assert.deepEqual(diffs.sort(), []);
});

test('the import\'s diff: a GF resident re-imported as "GF" keeps GF, and a new "GF, DF" resident arrives with both', () => {
  const reg = [
    { room: '613a', tags: ['GF'], section: 'Gluten Free', rawRestriction: 'GF' },
    { room: '912', tags: ['GF', 'No Pork'], section: 'Halal', rawRestriction: 'GF, No Pork' },
  ];
  const box = importSandbox(reg);
  const entries = vm.runInContext("[{ room: '613a', parsed: normalizeRestriction('GF') }, { room: '912', parsed: normalizeRestriction('GF, No Pork') },"
    + " { room: '702', parsed: normalizeRestriction('GF, DF') }]", box);
  const d = JSON.parse(JSON.stringify(vm.runInContext('diffImportAgainstRegistry(' + JSON.stringify(entries) + ')', box)));
  assert.deepEqual(d.updates.map(u => u.room), [], 'no update proposes taking GF off');
  const intake = d.intakes.find(i => i.room === '702');
  assert.ok(intake, 'the new resident is an intake');
  assert.deepEqual(Object.keys(intake.newTags).filter(k => intake.newTags[k]).sort(), ['glutenFree', 'noDairy'], JSON.stringify(intake));
  assert.deepEqual(intake.unmatched, [], 'nothing unmatched');
  assert.deepEqual(d.needsReview.map(x => x.room), [], 'nothing to ask');
});
