// tests/door_rules_plates_d2b_gate.mjs — D2b: DOOR's plate rules, editable by named leads, protection-only
// (2026-11-10, v31-standard.66). Jason, 2026-11-10: "go ahead with D2b". A lead may add a meal mark that opens a
// protective plate, a restriction that joins one, or a plating-line note; never remove or reorder anything, never the
// halal plate, the meat marks, always-made plates or anaphylactic containment. An added rule only seats a resident the
// built-in rules leave on the regular plate, and the proof (doorPlateProveHere, the REAL computeSections and
// computePlatingData over the published menu) refuses one that moves anyone off a plate they get.
// Runs the real engine, line notes, import guess, routing file builder and the door-rules core and shell in a vm, on
// MADE-UP residents only (no resident data from the repository). Authored to fail on 24a0040 (no plate rules).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
const json = (f) => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'));
function between(src, a, b) { const s = src.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = src.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return src.slice(s, e); }
const fnIn = (src, name) => between(src, 'function ' + name + '(', '\n}\n') + '\n}\n';
const fnOptIn = (src, name) => (src.includes('function ' + name + '(') ? fnIn(src, name) : '');
const lineIn = (src, prefix) => { const s = src.indexOf(prefix); assert.ok(s >= 0, 'missing ' + prefix); return src.slice(s, src.indexOf('\n', s)) + '\n'; };
const MENU = json('menu_current.json').menu;
const CORE_S = '/* DOOR_TESTABLE_CORE_START door-rules */', CORE_E = '/* DOOR_TESTABLE_CORE_END door-rules */';

// Made-up residents: rooms 1-24, one or two tags each. Nothing from door_state.json.
const RESIDENTS = [
  ['Regular'], ['No Sesame'], ['No Sesame', 'GF'], ['No Sesame', 'Soft Meals'], ['No Fish'], ['No Fish', 'Soft Meals'],
  ['GF'], ['GF', 'No Dairy'], ['Halal'], ['Halal', 'No Sesame'], ['Vegan'], ['No Dairy'], ['No Beef'], ['Diabetic'],
  ['No Pork'], ['No Pork', 'No Sesame'], ['No Soy'], ['No Corn'], ['No Eggs'], ['Soft Meals'], ['No Spicy'], ['No Mustard'],
  ['Lactose Intolerant', 'No Sesame'], ['No Beans'],
].map((tags, i) => ({ room: String(101 + i), tags, section: 'Regular', rawRestriction: '', isAnaph: false, allergenFlags: [], restrictions: tags }));

function box(opts = {}) {
  const src = opts.mutate ? opts.mutate(html) : html;
  const fn = (n) => fnIn(src, n), fnOpt = (n) => fnOptIn(src, n);
  const store = Object.assign({}, opts.store || {});
  const asked = [];
  const elems = opts.elems || {};
  const c = {
    console: { log() {}, warn() {}, error() {} }, Date, setTimeout, REGISTRY_LIST: RESIDENTS.map((r) => ({ ...r, tags: [...r.tags] })), anaphRooms: [], DOOR_RECIPE_DATA: null,
    getMenuData: () => MENU, loadSpecialMeals: () => ({}), loadMealSwaps: () => ({}),
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    document: { getElementById: (id) => elems[id] || null, querySelectorAll: () => [] }, showToast() {}, escapeHtml: (s) => String(s), _escAttr: (s) => String(s),
    PublishAuth: opts.auth || { getSavedToken: () => 'k', isViewingKey: () => false, isExpired: () => false },
    getOperatorName: () => (opts.operator === undefined ? 'Jason' : opts.operator), store, asked,
    doorAsk: async (o) => { asked.push(o); return opts.answer !== false; },
  };
  vm.createContext(c);
  const parts = [
    between(src, 'const TAG_LABELS_MAP = {', '\n};') + '\n};', lineIn(src, 'const DOOR_RECIPE_DATA_FALLBACK = '),
    between(src, 'const FLAG_DEFS = [', '\n];') + '\n];',
    between(src, 'const ROUTING_TAGS = new Set([', 'function migrateResidentTiers('),
    between(src, 'const ROUTING_RULES = [', '// ============================================================') + between(src, 'function computeSections(', 'let mcWeek ='),
    between(src, '/* DOOR_TESTABLE_CORE_START compliance-conflicts */', '/* DOOR_TESTABLE_CORE_END compliance-conflicts */'),
    fn('formatConflictNote'), fn('getRoomBase'), fn('findRoommates'), fn('doorIsAnaphResident'), fn('getAnaphConflictRooms'),
    between(src, 'const HUB_ALLERGEN_MAP = {', '\n};\n') + '\n};\n', fn('flagsToAllergenStr'), fn('emptyMealFlags'), fn('hasCarbAccommodation'),
    fn('getVegAltAllergenStr'), fn('mergeVegAltAllergenFloor'), fn('getVegAltSlotAllergenStr'),
    between(src, 'const DOOR_DECLARED_FREE = ', '\n'), fn('stripDeclaredFreeAllergens'),
    fn('getSundayStart'), fn('nextDateForSlot'), fnOpt('doorRotationWeekOf'), fnOpt('doorDateKey'), fnOpt('doorDatedMealFlags'),
    'this.doorDatedMealFor = () => null; this.DOOR_SCHEMA_VERSIONS = { routing_by_meal: 31 };',
    lineIn(src, 'const DOOR_KITCHEN_ALT_FIELDS = '),
    between(src, 'const DOOR_DISH_PART_EMPTY = ', '\nfunction doorEmptyDishParts(') + '\n',
    fn('doorKitchenAlternatives'), fn('doorAddKitchenPlateFlags'), fn('doorRegularServiceNote'),
    between(src, 'const CONFLICT_MAP = [', '\n];\n') + '\n];\n', fn('getIngredientConflicts'), fn('doorAllergenStrFlags'), fn('doorSectionLineNotes'), fn('doorSectionAllergenStr'),
    fn('computePlatingData'), fn('getAltMeal'), fn('doorSplitDishes'), fn('buildRoutingByMealJSON'), fn('importSectionForTags'),
  ];
  if (opts.withRules !== false) {
    parts.push(between(src, CORE_S, CORE_E), between(src, CORE_E, '\n// The recipes a dish can link'));
  }
  parts.push('this.R = { ROUTING_RULES, CONFLICT_MAP, computeSections, computePlatingData, buildRoutingByMealJSON, importSectionForTags, getIngredientConflicts, doorSectionLineNotes };');
  vm.runInContext(parts.join('\n'), c, { filename: 'index.html#d2b', timeout: 60000 });
  return c;
}
const out = (x) => JSON.parse(JSON.stringify(x));
const noMeta = (x) => { const o = out(x); delete o._meta; return o; };
const T0 = '2026-11-09T09:00:00.000Z', T1 = '2026-11-09T10:00:00.000Z';
const withPlates = (plates, extra) => ({ store: { concDoorRules: JSON.stringify(Object.assign({ additions: [], leads: [], log: [], plates: plates.map((p) => Object.assign({ by: 'Jason', at: T0 }, p)) }, extra || {})) } });
// Where each made-up resident sits on one meal: room → section key ('anaph' for containment).
function seats(c, wk, day, period) {
  const pd = c.R.computePlatingData(period, wk, day);
  if (!pd) return null;
  const at = {};
  pd.anaphSect.forEach((r) => { at[r.room] = 'anaph'; });
  pd.sections.forEach((s) => s.residents.forEach((r) => { at[r.room] = s.rule.key; }));
  return at;
}
const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const eachMeal = (f) => { for (const wk of ['1', '2', '3', '4']) for (const day of DAYS) for (const p of ['breakfast', 'lunch', 'dinner']) f(wk, day, p); };
const okProve = () => ({ ok: true, bad: [], moved: [] });

test('allowed and refused kinds: only more protective additions, never halal, meat marks, always-made plates or removals', () => {
  const c = box();
  const A = c.doorPlateAllowedHere();
  assert.deepEqual([...A.sections].sort(), ['gf', 'no_beef', 'no_dairy', 'no_fish']);
  for (const f of ['hasPork', 'hasBeef', 'hasChicken', 'hasTurkey', 'halalCertifiedMeat', 'isCarb']) assert.ok(!A.flags.includes(f), f);
  for (const t of ['Halal', 'Vegan', 'Vegetarian', 'Diabetic', 'Low Carb', 'Soft Meals', 'Other', 'No Pork', 'Bland Diet', 'Low Sodium']) assert.ok(!A.tags.includes(t), t);
  assert.ok(A.tags.includes('No Sesame') && A.tags.includes('GF') && A.tags.includes('Lactose Intolerant'));
  const chk = (rec) => c.doorPlateCheck([], rec, { allowed: A, prove: okProve });
  // refused: other kinds (removals and reorders stay code)
  for (const kind of ['removeTrigger', 'removeTag', 'priority', 'mergeInto', 'label', 'anaph']) assert.equal(chk({ kind, section: 'no_fish', flag: 'hasSesame' }).code, 'kind', kind);
  // refused plates
  for (const section of ['halal', 'vegan', 'soft', 'diabetic', 'bland', 'no_egg', 'no_processed', 'regular']) {
    assert.equal(chk({ kind: 'trigger', section, flag: 'hasSesame' }).code, 'section', section);
    assert.equal(chk({ kind: 'tag', section, tag: 'No Sesame', flag: '' }).code, 'section', section);
  }
  // refused marks and tags
  for (const flag of ['hasPork', 'hasBeef', 'hasChicken', 'hasTurkey', 'halalCertifiedMeat', 'isCarb', 'hasLupin']) assert.equal(chk({ kind: 'trigger', section: 'no_fish', flag }).code, 'flag', flag);
  for (const tag of ['Halal', 'Vegan', 'No Pork', 'Soft Meals', 'Diabetic', 'No Lupin']) assert.equal(chk({ kind: 'tag', section: 'gf', tag, flag: '' }).code, 'tag', tag);
  // refused: built in already
  assert.equal(chk({ kind: 'trigger', section: 'no_fish', flag: 'hasFish' }).code, 'built-in');
  assert.equal(chk({ kind: 'tag', section: 'no_fish', tag: 'No Shellfish', flag: '' }).code, 'built-in');
  assert.equal(chk({ kind: 'note', flag: 'hasSesame', tag: 'No Sesame', note: 'no sesame' }).code, 'built-in');
  // refused notes: odd characters, length; a red note is never offered (the record carries no severity)
  for (const note of ['<b>x</b>', 'no sesame!', 'ab', 'x'.repeat(41), 'no "corn"']) assert.equal(chk({ kind: 'note', flag: 'hasCorn', tag: 'No Soy', note }).code, 'note', note);
  // refused: a duplicate of an added rule
  const added = [{ kind: 'tag', section: 'no_fish', tag: 'No Sesame', flag: 'hasSesame', by: 'Jason', at: T0 }];
  assert.equal(c.doorPlateCheck(added, { kind: 'tag', section: 'no_fish', tag: 'No Sesame', flag: 'hasSesame' }, { allowed: A, prove: okProve }).code, 'added');
  // refused: a proof that cannot run, or that fails
  assert.equal(c.doorPlateCheck([], { kind: 'trigger', section: 'no_fish', flag: 'hasSesame' }, { allowed: A }).code, 'proof');
  assert.equal(c.doorPlateCheck([], { kind: 'trigger', section: 'no_fish', flag: 'hasSesame' }, { allowed: A, prove: () => ({ ok: false, bad: [{}], moved: [] }) }).code, 'proof');
  // allowed
  assert.ok(chk({ kind: 'trigger', section: 'no_fish', flag: 'hasSesame' }).ok);
  assert.ok(chk({ kind: 'tag', section: 'no_fish', tag: 'No Sesame', flag: 'hasSesame' }).ok);
  assert.ok(chk({ kind: 'tag', section: 'gf', tag: 'No Sesame', flag: '' }).ok);
  // Jason, 2026-11-10: a mark-limited restriction only joins a plate served from the vegan plate
  const marked = chk({ kind: 'tag', section: 'gf', tag: 'No Sesame', flag: 'hasSesame' });
  assert.equal(marked.code, 'marked-plate');
  assert.match(marked.why, /vegan plate/);
  for (const section of ['no_fish', 'no_dairy', 'no_beef']) assert.ok(chk({ kind: 'tag', section, tag: 'No Sesame', flag: 'hasSesame' }).ok, section);
  // and a hand-written one is ignored where the rules are read
  assert.equal(c.doorPlatesActive([{ kind: 'tag', section: 'gf', tag: 'No Sesame', flag: 'hasSesame', by: 'Jason', at: T0 }], A).length, 0);
  assert.ok(chk({ kind: 'note', flag: 'hasCorn', tag: 'No Soy', note: 'no corn/soy' }).ok);
  // plain words
  assert.equal(c.doorPlateSays({ kind: 'tag', section: 'no_fish', tag: 'No Sesame', flag: 'hasSesame' }),
    'On meals marked Sesame, No Sesame residents who would otherwise get the regular plate will get the vegan plate.');
});

test('the proof on the real engine: allowed additions only move residents off the regular plate; mutants are refused', () => {
  const c = box();
  const A = c.doorPlateAllowedHere();
  const recs = [{ kind: 'trigger', section: 'no_fish', flag: 'hasSesame' }, { kind: 'tag', section: 'no_fish', tag: 'No Sesame', flag: 'hasSesame' },
    { kind: 'tag', section: 'gf', tag: 'No Sesame', flag: '' }, { kind: 'trigger', section: 'gf', flag: 'hasSoy' }, { kind: 'note', flag: 'hasCorn', tag: 'No Soy', note: 'no corn' }];
  for (const rec of recs) {
    const r = c.doorPlateCheck([], rec, { allowed: A, prove: c.doorPlateProveHere });
    assert.ok(r.ok, JSON.stringify(rec) + ' ' + (r.why || ''));
    assert.ok(r.proof.moved.every((m) => m.from === 'regular' && m.to !== 'regular'));
  }
  // the No Sesame rule moves made-up residents on the published sesame meals; the movers list is counts, no rooms
  const r = c.doorPlateCheck([], recs[1], { allowed: A, prove: c.doorPlateProveHere });
  const lines = [...c.doorPlateMoverLines(r.proof)];
  assert.ok(lines.length > 0, 'someone on the made-up list moves');
  for (const l of lines) { assert.match(l, /^Wk\d [A-Z]{3} (breakfast|lunch|dinner): \d+ residents? → Vegan \/ Vegetarian$/); for (const x of RESIDENTS) assert.ok(!l.includes(x.room)); }
  // the proof itself: a move to Regular, or off one protective plate onto another, fails
  const P = (k) => [{ meal: 'm', who: 'w', key: k }];
  assert.equal(c.doorPlateProve(P('vegan'), P('regular')).ok, false);
  assert.equal(c.doorPlateProve(P('gf'), P('vegan')).ok, false);
  assert.equal(c.doorPlateProve(P('regular'), P('vegan')).ok, true);
  // mutant 1: an engine that applies an added trigger in place of the plate's own triggers (an addition that moves
  // No Fish residents to Regular on fish meals). The real check refuses it.
  const replaceTriggers = (src) => src.replace('        return r.triggers.some(t => mealFlags[t]);',
    '        { const P = typeof doorPlateRulesInForce === "function" ? doorPlateRulesInForce() : null; return ((P && P.triggers[r.key]) || r.triggers).some(t => mealFlags[t]); }');
  const m1 = box({ mutate: replaceTriggers });
  assert.notEqual(replaceTriggers(html), html, 'mutant applied');
  const r1 = m1.doorPlateCheck([], recs[0], { allowed: m1.doorPlateAllowedHere(), prove: m1.doorPlateProveHere });
  assert.equal(r1.ok, false);
  assert.ok(r1.proof.bad.some((b) => b.to === 'regular'), 'someone moved to Regular');
  // mutant 2: an added restriction applied by plain priority (it steals a GF resident off the GF plate)
  const byPriority = (src) => src.replace("    if (key === 'regular' && _plates) {", "    if (_plates && doorPlateFallbackKey(ROUTING_RULES, activeKeys, mealFlags, residentTags, _plates)) {");
  const m2 = box({ mutate: byPriority });
  assert.notEqual(byPriority(html), html, 'mutant applied');
  const r2 = m2.doorPlateCheck([], recs[2], { allowed: m2.doorPlateAllowedHere(), prove: m2.doorPlateProveHere });
  assert.equal(r2.ok, false, 'a move between plates is refused');
});

test('the readers honour an addition: plating, the line notes, the routing file and the import guess', () => {
  const plain = box();
  const c = box(withPlates([{ kind: 'tag', section: 'no_fish', tag: 'No Sesame', flag: 'hasSesame' }, { kind: 'tag', section: 'gf', tag: 'No Corn', flag: '' },
    { kind: 'note', flag: 'hasCorn', tag: 'No Soy', note: 'no corn here' }]));
  let sesameMeals = 0, gfMeals = 0, cornMeals = 0, seen = 0;
  eachMeal((wk, day, p) => {
    const a = seats(c, wk, day, p), b = seats(plain, wk, day, p);
    if (!a) return;
    seen++;
    const f = plain.R.computePlatingData(p, wk, day).mealFlags;
    for (const r of RESIDENTS) {
      if (a[r.room] !== b[r.room]) assert.equal(b[r.room], 'regular', 'only the regular plate is left: ' + r.tags + ' ' + wk + day + p);
    }
    if (f.hasSesame && b['102'] === 'regular') {
      sesameMeals++;
      assert.equal(a['102'], 'vegan', 'No Sesame → vegan plate');
      if (b['103'] !== 'regular') assert.equal(a['103'], b['103'], 'GF + No Sesame keeps the GF plate');
      if (b['110'] !== 'regular') assert.equal(a['110'], b['110'], 'Halal + No Sesame keeps the halal plate');
    }
    if (f.hasGluten && b['118'] === 'regular') { gfMeals++; assert.equal(a['118'], 'gf', 'No Corn joins the GF plate when it is made'); }
    if (f.hasCorn) {
      cornMeals++;
      const pd = c.R.computePlatingData(p, wk, day);
      const s = pd.sections.find((x) => x.residents.some((r) => r.room === '117'));
      assert.match(c.R.doorSectionLineNotes(RESIDENTS[16], s, pd.mealFlags, ''), /no corn here/);
      assert.ok(c.R.getIngredientConflicts(pd.mealFlags, RESIDENTS).some((x) => x.note === 'no corn here'));
      assert.ok(!plain.R.getIngredientConflicts(pd.mealFlags, RESIDENTS).some((x) => x.note === 'no corn here'));
    }
  });
  assert.equal(seen, 84);
  assert.ok(sesameMeals > 0 && gfMeals > 0 && cornMeals > 0, [sesameMeals, gfMeals, cornMeals].join('/'));
  // the routing file the publish builds: the vegan count grows exactly where a No Sesame resident moved
  const ra = noMeta(c.R.buildRoutingByMealJSON()), rb = noMeta(plain.R.buildRoutingByMealJSON());
  assert.notDeepEqual(ra, rb);
  eachMeal((wk, day, p) => {
    const a = seats(c, wk, day, p), b = seats(plain, wk, day, p);
    if (!a) return;
    const movedVegan = RESIDENTS.filter((r) => a[r.room] === 'vegan' && b[r.room] !== 'vegan').length;
    assert.equal((ra.routing[wk][day][p]['Vegan / Vegetarian'] || 0) - (rb.routing[wk][day][p]['Vegan / Vegetarian'] || 0), movedVegan, wk + day + p);
  });
  // the import guess
  assert.equal(c.R.importSectionForTags({ noCorn: true }), 'Gluten Free');
  assert.equal(plain.R.importSectionForTags({ noCorn: true }), 'Regular');
  assert.equal(c.R.importSectionForTags({ halal: true, noCorn: true }), 'Halal', 'never ahead of a plate-choosing tag');
  // a hand-written file cannot reach past protection-only: these are ignored where the rules are read
  const forged = box(withPlates([{ kind: 'trigger', section: 'halal', flag: 'hasSesame' }, { kind: 'trigger', section: 'no_fish', flag: 'hasPork' },
    { kind: 'tag', section: 'vegan', tag: 'No Sesame', flag: '' }, { kind: 'tag', section: 'gf', tag: 'Halal', flag: '' }, { kind: 'removeTrigger', section: 'no_fish', flag: 'hasFish' }]));
  assert.equal(forged.doorPlateRulesInForce(), null);
  eachMeal((wk, day, p) => { const a = seats(forged, wk, day, p); if (a) assert.deepEqual(a, seats(plain, wk, day, p)); });
});

test('no additions: plating, the routing file and the import guess are identical to the build without the module', () => {
  const none = box({ withRules: false }), withMod = box();
  const back = box(withPlates([{ kind: 'tag', section: 'no_fish', tag: 'No Sesame', flag: 'hasSesame', takenBack: true }, { kind: 'note', flag: 'hasCorn', tag: 'No Soy', note: 'no corn here', takenBack: true }]));
  for (const c of [withMod, back]) {
    assert.equal(c.doorPlateRulesInForce(), null);
    eachMeal((wk, day, p) => assert.deepEqual(out(c.R.computePlatingData(p, wk, day)), out(none.R.computePlatingData(p, wk, day)), wk + day + p));
    assert.equal(JSON.stringify(noMeta(c.R.buildRoutingByMealJSON())), JSON.stringify(noMeta(none.R.buildRoutingByMealJSON())));
    for (const t of [{}, { glutenFree: true }, { noCorn: true }, { noDairy: true }, { halal: true }, { noPork: true }]) assert.equal(c.R.importSectionForTags(t), none.R.importSectionForTags(t));
  }
});

test('add, take back and Undo through the page: who may edit, the question, honest take-back words', async () => {
  const form = { 'door-plate-tag-section': { value: 'no_fish' }, 'door-plate-tag-tag': { value: 'No Sesame' }, 'door-plate-tag-flag': { value: 'hasSesame' }, 'door-plate-msg': { textContent: '' } };
  // not allowed: no key, a name not on the leads list
  for (const o of [{ auth: { getSavedToken: () => '', isViewingKey: () => false, isExpired: () => false } }, { operator: 'Joan' }, { auth: { getSavedToken: () => 'k', isViewingKey: () => true, isExpired: () => false } }]) {
    const n = box(Object.assign({ elems: form }, o));
    await n.doorPlatesAddRule('tag');
    assert.equal((n.loadDoorRules().plates || []).length, 0);
    assert.equal(n.asked.length, 0, 'not even asked');
  }
  // Go back adds nothing
  const g = box({ elems: form, answer: false });
  await g.doorPlatesAddRule('tag');
  assert.equal(g.asked.length, 1);
  assert.equal(g.loadDoorRules().plates.length, 0);
  // a lead adds: the question names the rule, the movers (counts), and the routing file
  const lead = box({ elems: form, operator: 'Fiona', store: withPlates([], { leads: [{ name: 'Fiona', on: true, by: 'Jason', at: T0 }] }).store });
  await lead.doorPlatesAddRule('tag');
  const q = lead.asked[0];
  assert.match(q.lines[0], /^On meals marked Sesame, No Sesame residents/);
  assert.ok(q.items.length > 0 && q.items.every((x) => /resident/.test(x)));
  assert.ok(q.lines.some((l) => /routing_by_meal\.json/.test(l) && /EXPO and HUB need no change/.test(l)));
  const saved = lead.loadDoorRules();
  assert.equal(saved.plates.length, 1);
  assert.equal(saved.plates[0].by, 'Fiona');
  assert.equal(saved.log[0].what, 'plate rule added');
  assert.ok(lead.doorRulesNotSent(), 'not sent yet');
  const key = lead.doorPlateKey(saved.plates[0]);
  // the take-back is honest about what the kitchen already has
  await lead.doorPlatesTakeBackRule(key);
  const tq = lead.asked[1];
  assert.ok(tq.lines.some((l) => /routing_by_meal\.json/.test(l) && /until the next send/.test(l)));
  assert.equal(lead.doorPlateRulesInForce(), null, 'back to the built-in rules');
  assert.equal(lead.loadDoorRules().plates[0].takenBack, true, 'a dated record, not a delete');
  // Undo puts it back (checked again)
  await lead.doorRulesUndo();
  assert.ok(lead.doorPlateRulesInForce(), 'put back');
  // a future clock on the stored record: the next write is still later than it
  const later = lead.loadDoorRules().plates[0].at;
  assert.ok(lead.doorPlateStamp(Date.parse(later) - 60000, later) > later);
});

test('two computers merge per rule, newest wins; times are canonical and never in the future; shared in door_rules.json', () => {
  const c = box();
  const a = [{ kind: 'trigger', section: 'no_fish', flag: 'hasSesame', by: 'Jason', at: T0 }];
  const b = [{ kind: 'trigger', section: 'no_fish', flag: 'hasSesame', by: 'Fiona', at: T1, takenBack: true }, { kind: 'note', flag: 'hasCorn', tag: 'No Soy', note: 'no corn', by: 'Fiona', at: T0 }];
  const ab = c.doorPlatesMerge(a, b), ba = c.doorPlatesMerge(b, a);
  assert.deepEqual(out(ab), out(ba));
  assert.deepEqual(out(c.doorPlatesActive(ab)).map((r) => r.kind), ['note'], 'the newer take-back wins');
  const tie = c.doorPlatesMerge(a, [Object.assign({}, a[0], { takenBack: true })]);
  assert.equal(c.doorPlatesActive(tie).length, 1, 'a tie keeps the rule (it only protects)');
  // times
  const far = new Date(Date.now() + 86400000).toISOString();
  assert.equal(c.doorPlatesClean([Object.assign({}, a[0], { at: far })]).length, 0, 'a future time is refused');
  for (const at of ['2026-11-09T09:00:00Z', '2026-11-09T09:00:00.000+00:00', '9999-12-31T00:00:00.000Z', '2026-02-30T00:00:00.000Z', '2026-11-09']) assert.equal(c.doorPlatesClean([Object.assign({}, a[0], { at })]).length, 0, at);
  assert.equal(c.doorPlateStamp(Date.parse(T0), T1), '2026-11-09T10:00:00.001Z');
  assert.equal(c.doorPlateStamp(Date.parse(T1), T0), T1);
  // the file: plates beside the words, merged by the D2a merge; an unchanged file reads unchanged
  const rules = c.doorRulesMerge({ plates: a }, { plates: b });
  const f = c.doorRulesFile(rules, 'rexdale');
  assert.equal(f.plates.length, 2);
  assert.equal(f._meta.exported, T1);
  assert.ok(c.doorRulesHasContent({ plates: a }));
  const s = box();
  s.doorApplyRemoteRules(f);
  assert.equal(s.doorPlatesActive(s.loadDoorRules().plates).length, 1);
  assert.ok(s.doorPlateRulesInForce().notes.length === 1);
  assert.match(html, /const DOOR_APP_VERSION = 'v31-standard\.(6[6-9]|[7-9]\d)/);
});
