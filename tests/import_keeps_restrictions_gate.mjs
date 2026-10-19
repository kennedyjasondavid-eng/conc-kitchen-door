// tests/import_keeps_restrictions_gate.mjs — the resident-list import never takes off a restriction it can't account for
// (2026-10-19). Found by the plating review (DOOR vs the kitchen's manual sheets): the Sep 11 roster catch-up import took
// No Fish and No Shellfish off 613a and 613b ("Gluten Free / No Sea Food", "Halal / No Sea Foods"), No Tree Nuts off
// 1207 ("… No Almond …") and No Brassicas and No Nightshades off 1215b ("No Caulilower/ Tomatoes / Cucumber /
// Broccoli"). DOOR couldn't read those words; a Needs Review answer had mapped them once, but the learned store kept only
// that they had an answer, so the next import stayed quiet, read the rows without the tags and proposed taking them
// off, every change already ticked. DOOR has served 613a and 613b fish since. Jason, 2026-10-19: "Fix import".
//   1. "No Sea Food(s)" / "No Seafood" read as No Fish and No Shellfish; a tree nut named by its kind reads as No Tree Nuts
//   2. the Sep 11 replay: the four keep their restrictions, and 808 ("Regular" now) still starts ticked to lose No Pork
//   3. an allergen never starts ticked to come off, even on a row DOOR reads in full; another tag on such a row does
//   4. a Needs Review answer keeps the tags it gave, and the next import reads the row with them
//   5. a reassignment keeps the moved resident's allergens; the import screen says why a removal waits
// Authored to fail on main fdb907d (1–5). Env: IMPORT_KEEPS_HTML (another index.html, e.g. main's).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(process.env.IMPORT_KEEPS_HTML || new URL('../index.html', import.meta.url), 'utf8');
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) { return between('function ' + name + '(', '\n}\n') + '\n}\n'; }
const has = (name) => html.includes('function ' + name + '(');
function bracedConst(name) {
  const start = html.indexOf('const ' + name + ' =');
  assert.ok(start >= 0, 'missing ' + name);
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}') { depth--; if (depth === 0) break; } }
  return html.slice(start, html.indexOf(';', i) + 1);
}
// The import module in a sandbox with a resident list and a learned store (as restriction_short_codes_gate does), plus
// the allergen rule and the default ticks.
function importSandbox(registry, learned) {
  const store = { concLearnedNR: JSON.stringify(learned || {}), concDismissedDiffs: '{}', concCustomTagRules: '[]' };
  const REGISTRY_LIST = (registry || []).map((r) => ({ ...r })), REGISTRY_MAP = {};
  REGISTRY_LIST.forEach((r) => { REGISTRY_MAP[r.room.toLowerCase()] = r; });
  const box = { console, REGISTRY_LIST, REGISTRY_MAP, anaphRooms: [], changesQueue: [], IMPORT_STATE: null, MEAL: { lunch: 'lunch' },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem() {} },
    document: { getElementById: () => null, querySelectorAll: () => [] }, showToast() {}, escapeHtml: (s) => String(s), _escAttr: (s) => String(s) };
  vm.createContext(box);
  const src = [bracedConst('TAG_LABELS_MAP'), fn('getRoomBase'), between('const ALLERGEN_TAGS = new Set([', '\nfunction migrateResidentTiers('),
    between('const IMPORT_TAG_RULES = [', '\nfunction handleImportFile(')];
  for (const f of ['doorImportRemovalHeld', 'doorImportDefaultSelections']) if (has(f)) src.push(fn(f));
  vm.runInContext(src.join('\n'), box, { filename: 'index.html#import-module', timeout: 5000 });
  box.__store = store;
  return box;
}
const out = (v) => JSON.parse(JSON.stringify(v));
const parseIn = (sb, t) => out(vm.runInContext('normalizeRestriction(' + JSON.stringify(t) + ')', sb));
const on = (tags) => Object.keys(tags).filter((k) => tags[k]).sort();
// The starting ticks for one room's update: { tagKey: ticked }.
function ticksFor(sb, rows, room) {
  vm.runInContext('__entries = ' + JSON.stringify(rows.map(([r, t]) => ({ room: r, text: t }))) + '.map(e => ({ room: e.room, parsed: normalizeRestriction(e.text) }));'
    + '__diff = diffImportAgainstRegistry(__entries);', sb);
  assert.equal(typeof sb.doorImportDefaultSelections, 'function', 'doorImportDefaultSelections');
  const upd = out(sb.__diff.updates.find((u) => u.room === room) || null);
  const sel = vm.runInContext('doorImportDefaultSelections(__diff)', sb).updates.get(room);
  return { upd, ticks: sel ? out(sel) : null };
}

// As door_state.json published them on Sep 11 at 08:37, before the catch-up import (git 86f2f0c).
const SEP11 = () => [
  { room: '613a', tags: ['GF', 'No Fish', 'No Shellfish'], section: 'Gluten Free' },
  { room: '613b', tags: ['Halal', 'No Fish', 'No Shellfish'], section: 'Halal' },
  { room: '1207', tags: ['GF', 'No Shellfish', 'Lactose Intolerant', 'No Tree Nuts'], section: 'Gluten Free' },
  { room: '1215b', tags: ['No Brassicas', 'No Nightshades'], section: 'Regular' },
  { room: '808', tags: ['No Pork'], section: 'Regular' },
];
// Their rows on the meal list (unchanged since; Oct 19's list), 808 since it became Regular.
const ROWS = [
  ['613a', 'Gluten Free / No Sea Food'],
  ['613b', 'Halal / No Sea Foods'],
  ['1207', 'lactose Intoleran/, No Wheat/No shellfish/ No Almond /Soy Milk only'],
  ['1215b', 'No Caulilower/ Tomatoes / Cucumber / Broccoli'],
  ['808', 'Regular'],
];

test('1. "No Sea Food" is fish and shellfish; a tree nut named by its kind is No Tree Nuts', () => {
  const sb = importSandbox([]);
  for (const [t, want] of [
    ['Gluten Free / No Sea Food', ['glutenFree', 'noFish', 'noShellfish']], ['Halal / No Sea Foods', ['halal', 'noFish', 'noShellfish']],
    ['No Seafood', ['noFish', 'noShellfish']], ['No sea-food', ['noFish', 'noShellfish']],
  ]) {
    const p = parseIn(sb, t);
    assert.deepEqual([on(p.tags), p.unmatched], [want, []], t + ': ' + JSON.stringify(p));
  }
  for (const t of ['No Almond', 'No Almonds', 'No cashews', 'No Walnuts', 'No pecans', 'No pistachio', 'No Hazelnuts', 'No macadamia', 'No Brazil nuts'])
    assert.deepEqual(on(parseIn(sb, t).tags), ['noTreeNuts'], t);
  assert.ok(on(parseIn(sb, ROWS[2][1]).tags).includes('noTreeNuts'), '1207 reads No Tree Nuts');
  // Not over-read: "Sea Salt" and "Fish sauce on the side" are not seafood rules.
  assert.deepEqual(on(parseIn(sb, 'Low Sodium / No Sea Salt').tags), ['lowSodium']);
});

test('2. the Sep 11 replay: 613a, 613b, 1207 and 1215b keep their restrictions; 808 still starts ticked to lose No Pork', () => {
  const sb = importSandbox(SEP11());
  for (const room of ['613a', '613b', '1207']) assert.equal(ticksFor(sb, ROWS, room).upd, null, room + ': the import reads it in full, nothing to change');
  const r1215 = ticksFor(sb, ROWS, '1215b');
  assert.deepEqual(r1215.ticks, { noBrassicas: false, noNightshades: false }, '1215b: both wait for a tick (the list has words DOOR can’t read)');
  const r808 = ticksFor(sb, ROWS, '808');
  assert.deepEqual(r808.ticks, { noPork: true }, '808: a row read in full still starts ticked');
});

test('3. an allergen never starts ticked to come off; another tag on a row read in full does', () => {
  const sb = importSandbox([{ room: '700', tags: ['GF', 'No Fish', 'No Pork', 'No Peanuts', 'Low Sodium'], section: 'Gluten Free' }]);
  const r = ticksFor(sb, [['700', 'GF']], '700');
  assert.deepEqual(r.ticks, { noFish: false, noPeanuts: false, noPork: true, lowSodium: true }, JSON.stringify(r.ticks));
  assert.equal(vm.runInContext('doorImportRemovalHeld(__diff.updates[0], "noFish")', sb), 'an allergen');
  // An added tag always starts ticked.
  const sb2 = importSandbox([{ room: '701', tags: ['Halal'], section: 'Halal' }]);
  assert.deepEqual(ticksFor(sb2, [['701', 'Halal / No Peanuts']], '701').ticks, { noPeanuts: true });
});

test('4. a Needs Review answer keeps the tags it gave, and the next import reads the row with them', () => {
  assert.match(fn('nrDoneReview'), /learned\[roomKey\]\['_tags'\] = pending\.filter\(d => d\.action === 'map' && d\.value && TAG_LABELS_MAP\[d\.value\]\)\.map\(d => d\.value\)/,
    'the answer stores its tags');
  const learned = { '1215b': { _resolved_text: 'no caulilower/ tomatoes / cucumber / broccoli', _tags: ['noBrassicas', 'noNightshades'],
    'no caulilower': { action: 'map' }, tomatoes: { action: 'map' }, cucumber: { action: 'map' }, broccoli: { action: 'map' } } };
  const sb = importSandbox(SEP11(), learned);
  assert.equal(ticksFor(sb, ROWS, '1215b').upd, null, '1215b reads with its answered tags: nothing to change');
  // A new resident in another room with the same words is not given them; the room's answer is the room's.
  const sb2 = importSandbox([], learned);
  vm.runInContext('__e = [{ room: "1216", parsed: normalizeRestriction("No Caulilower/ Tomatoes / Cucumber / Broccoli") }]; diffImportAgainstRegistry(__e);', sb2);
  assert.deepEqual(on(out(sb2.__e[0].parsed.tags)), [], 'another room: not given 1215b’s tags');
  // An old answer with no tags (learned before this fix) adds nothing, and the removal still waits (test 2).
  const sb3 = importSandbox(SEP11(), { '1215b': { _resolved_text: 'no caulilower/ tomatoes / cucumber / broccoli', 'no caulilower': { action: 'map' } } });
  assert.deepEqual(ticksFor(sb3, ROWS, '1215b').ticks, { noBrassicas: false, noNightshades: false });
});

test('5. a reassignment keeps the moved resident’s allergens; the import screen says why a removal waits', () => {
  const commit = fn('commitImportToQueue');
  assert.match(commit, /const movedTags = \{ \.\.\.p\.newTags \};[\s\S]{0,400}doorIsAnaphAllergenTag\(label\)\) movedTags\[key\] = true;[\s\S]{0,300}tags: movedTags/, 'reassign keeps allergens');
  assert.match(html, /const held = doorImportRemovalHeld\(u, k\);[\s\S]{0,200}Stays unless you tick it: ' \+ held/, 'the row says why');
  assert.match(fn('recomputeImportDiff'), /const selections = doorImportDefaultSelections\(diff\);/, 'the screen uses the same ticks');
});
