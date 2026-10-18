// tests/routing_oracle_gate.mjs — DOOR's routing against the rules table (2026-10-18, audit A2).
// Jason, 2026-10-18: "Plan a full audit to test all tags and anaphs especially to ensure routing behaviour is accurate
// with no bugs", then "complete audit as autonomously as possible", ruling every lean of the rules table
// (docs/DOOR_ROUTING_RULES_2026-10-18.md §9). The oracle (tests/helpers/routing_oracle.mjs) is written from that table,
// not from computeSections. This gate runs the REAL computeSections and plating line notes from index.html in a vm over
// every single tag, every pair of the tags that route, the published residents' tag sets, and meals of every single
// flag, every pair of the flags that open a section, each opener with each allergen flag, and the four meal switches
// (halal-certified unset/false, the vegan line egg-free, alternative meals, a no-pork alternative). Every resident must
// sit exactly once, in a section that prints, the section the oracle names, and carry every note the oracle requires.
// Authored to fail on main 66e0bec: Bland Diet ate the regular plate, No Mustard and No Molluscs never routed, and the
// line named no No Spicy, Soft Meals, No Beef, No Turkey or No Processed Food, nor the vegan line's own allergens.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { plateFor, requiredNotes, NOTES } from './helpers/routing_oracle.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const json = (f) => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'));
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) { return between('function ' + name + '(', '\n}\n') + '\n}\n'; }
const fnOpt = (name) => (html.includes('function ' + name + '(') ? fn(name) : '');
const ROUTING = between('const ROUTING_RULES = [', '// ============================================================') + between('function computeSections(', 'let mcWeek =');
const LINE = [
  between('const HUB_ALLERGEN_MAP = {', '\n};\n') + '\n};\n', fn('flagsToAllergenStr'),
  fn('emptyMealFlags'), fn('hasCarbAccommodation'),
  between('const CONFLICT_MAP = [', '\n];\n') + '\n];\n', fnOpt('doorAllergenStrFlags'), fnOpt('doorSectionLineNotes'),
  between('const ROUTING_TAGS = new Set([', 'function migrateResidentTiers(') + fn('migrateResidentTiers'),
  between('const RESIDENT_TO_MEAL_FLAG = {', '\n};\n') + '\n};\n', fn('checkResidentMealConflicts'), fn('formatConflictNote'),
].join('\n');
function box(routing = ROUTING) {
  const c = {}; vm.createContext(c);
  vm.runInContext(routing + '\n' + LINE + '\nthis.__has = typeof doorSectionLineNotes === "function";', c, { filename: 'index.html#oracle', timeout: 20000 });
  return c;
}
const out = (v) => JSON.parse(JSON.stringify(v));

// ── the matrix ──────────────────────────────────────────────────────────────────────────────────────────────────
const LABELS = Object.values(vm.runInNewContext(html.match(/const TAG_LABELS_MAP = \{[\s\S]*?\n\};/)[0] + ';TAG_LABELS_MAP'));
const ROUTE_TAGS = ['Halal', 'No Pork', 'Vegan', 'Vegetarian', 'No Processed Food', 'No Fish', 'No Shellfish', 'No Molluscs', 'GF',
  'No Dairy', 'Lactose Intolerant', 'No Beef', 'Diabetic', 'Low Carb', 'No Spicy', 'Bland Diet', 'Soft Meals', 'No Eggs', 'No Mustard'];
const OPENERS = ['hasPork', 'hasBeef', 'hasChicken', 'hasTurkey', 'hasProcessedMeat', 'hasFish', 'hasShellfish', 'hasGluten', 'hasDairy',
  'isCarb', 'isSpicy', 'hasEgg', 'hasMustard'];
const NOTE_FLAGS = [...new Set(NOTES.map(([k]) => k))].filter((k) => !OPENERS.includes(k));
const ALL_FLAGS = [...new Set([...OPENERS, ...NOTE_FLAGS, 'hasPeanuts'])];

const tagSets = [];
LABELS.forEach((t) => tagSets.push([t]));
ROUTE_TAGS.forEach((a, i) => ROUTE_TAGS.slice(i + 1).forEach((b) => tagSets.push([a, b])));
json('door_state.json').residents.forEach((r) => tagSets.push((r.tags || []).filter((t) => t !== 'Regular')));
const seen = new Set();
const RESIDENTS = tagSets.filter((t) => { const k = t.slice().sort().join('|'); if (seen.has(k)) return false; seen.add(k); return true; })
  .map((tags, i) => ({ room: String(1000 + i), tags: tags.length ? tags : ['Regular'] }));

const bases = [{}];
ALL_FLAGS.forEach((k) => bases.push({ [k]: true }));
OPENERS.forEach((a, i) => OPENERS.slice(i + 1).forEach((b) => bases.push({ [a]: true, [b]: true })));
OPENERS.forEach((a) => NOTE_FLAGS.forEach((b) => bases.push({ [a]: true, [b]: true })));
const MEALS = [];
bases.forEach((b) => {
  for (const cert of [undefined, false]) for (const safe of [false, true]) for (const alts of [false, true]) for (const np of [false, true]) {
    const m = { ...b };
    if (cert === false) { if (!['hasBeef', 'hasChicken', 'hasTurkey'].some((k) => m[k])) continue; m.halalCertifiedMeat = false; }
    if (safe) m._vegAltSafe = true;
    if (alts) { if (!m.hasPork) continue; m._altMeals = [{ type: 'soft', text: 'Soft plate', flags: {} }]; }
    if (np) { if (!m.hasPork) continue; m.noPorkAlt = 'No-pork plate'; }
    MEALS.push(m);
  }
});

function seatsOf(c, meal) {
  const secs = c.computeSections({ ...meal }, RESIDENTS.map((r) => ({ ...r })));
  const seat = {};
  secs.forEach((s) => s.residents.forEach((r) => { (seat[r.room] = seat[r.room] || []).push(s); }));
  return { secs, seat };
}
function diffSeats(c) {
  const bad = [];
  for (const meal of MEALS) {
    const { seat } = seatsOf(c, meal);
    for (const r of RESIDENTS) {
      const got = (seat[r.room] || []).map((s) => s.rule.key);
      const want = plateFor(r.tags, meal);
      if (got.length !== 1 || got[0] !== want) bad.push(r.tags.join('+') + ' @ ' + JSON.stringify(meal) + ': ' + JSON.stringify(got) + ' ≠ ' + want);
    }
  }
  return bad;
}
const splitNotes = (s) => new Set(String(s || '').split(/ · |, /).map((x) => x.trim()).filter(Boolean));

test('the matrix is the size the audit plan asks for', () => {
  assert.ok(RESIDENTS.length >= 200, RESIDENTS.length + ' residents');
  assert.ok(MEALS.length >= 750, MEALS.length + ' meals');
});

test('every resident sits exactly once, in a section that prints, on every meal', () => {
  const c = box();
  const bad = [];
  for (const meal of MEALS) {
    const { secs, seat } = seatsOf(c, meal);
    for (const r of RESIDENTS) if ((seat[r.room] || []).length !== 1) bad.push(r.tags.join('+') + ' @ ' + JSON.stringify(meal) + ' seated ' + (seat[r.room] || []).length + '×');
    secs.forEach((s) => { if (s.rule.key !== 'regular' && !s.residents.length) bad.push('empty section ' + s.rule.key + ' @ ' + JSON.stringify(meal)); });
  }
  assert.deepEqual(bad.slice(0, 10), [], bad.length + ' problems');
});

test('every resident sits where the rules table says, on every meal', () => {
  const bad = diffSeats(box());
  assert.deepEqual(bad.slice(0, 12), [], bad.length + ' seats differ from the oracle');
});

test('the rules Jason ruled: Bland Diet is No Spicy, No Mustard joins No Egg / Mustard, No Molluscs routes like No Shellfish', () => {
  const c = box();
  const seat = (tags, meal) => out(c.computeSections({ ...meal }, [{ room: '1', tags }])).find((s) => s.residents.length).rule.key;
  assert.equal(seat(['Bland Diet'], { isSpicy: true }), 'bland', 'F2');
  assert.equal(seat(['Bland Diet'], { isSpicy: true, hasPork: true, hasGluten: true }), 'gf', 'F2: the pork-day Bland → GF merge');
  assert.equal(seat(['No Mustard'], { hasMustard: true }), 'no_egg', 'F3');
  assert.equal(seat(['No Mustard'], { hasEgg: true }), 'regular', 'F3: an egg meal is not a mustard meal');
  assert.equal(seat(['No Eggs'], { hasMustard: true }), 'regular', 'F3: No Eggs still opens on egg only');
  assert.equal(seat(['No Mustard'], { hasMustard: true, _vegAltSafe: true }), 'vegan', 'F3: as No Eggs, when the vegan line is egg- and mustard-free');
  assert.equal(seat(['No Molluscs'], { hasShellfish: true }), 'vegan', 'F4');
  assert.equal(seat(['No Molluscs'], { hasFish: true }), 'vegan', 'F4: like No Shellfish (older menus tick seafood as Fish)');
});

test('a section resident\'s line names every restriction the meal sets off (R0, F8, F10)', () => {
  const c = box();
  assert.ok(c.__has, 'doorSectionLineNotes is missing');
  const bad = [];
  for (const meal of MEALS) {
    const { seat } = seatsOf(c, meal);
    for (const r of RESIDENTS) {
      const s = (seat[r.room] || [])[0];
      if (!s || s.rule.key === 'regular') continue;
      const got = splitNotes(c.doorSectionLineNotes(r, s, meal, ''));
      const want = requiredNotes(r.tags, meal, s.rule.key);
      const missing = [...want].filter((n) => !got.has(n));
      if (missing.length) bad.push(r.tags.join('+') + ' in ' + s.rule.key + ' @ ' + JSON.stringify(meal) + ': missing ' + missing.join(', '));
    }
  }
  assert.deepEqual(bad.slice(0, 12), [], bad.length + ' lines miss a note');
});

test('a Regular resident\'s line names every allergen and accommodation the meal sets off', () => {
  const c = box();
  const bad = [];
  for (const meal of MEALS) {
    const { seat } = seatsOf(c, meal);
    for (const r of RESIDENTS) {
      const s = (seat[r.room] || [])[0];
      if (!s || s.rule.key !== 'regular') continue;
      const res = { ...r }; c.migrateResidentTiers(res);
      const note = c.formatConflictNote(c.checkResidentMealConflicts(meal, res));
      const want = NOTES.filter(([k, tag]) => r.tags.includes(tag) && meal[k]).map(([, tag]) => tag);
      const missing = want.filter((t) => !note.includes(t));
      if (missing.length) bad.push(r.tags.join('+') + ' @ ' + JSON.stringify(meal) + ': missing ' + missing.join(', '));
    }
  }
  assert.deepEqual(bad.slice(0, 12), [], bad.length + ' Regular lines miss a tag');
});

test('the line reads the plate eaten: a vegan-plate row names the vegan line\'s own allergens (F9)', () => {
  const c = box();
  assert.ok(c.__has, 'doorSectionLineNotes is missing');
  const r = { room: '301a', tags: ['GF', 'Lactose Intolerant', 'No Beans', 'Vegetarian'] };
  const vegan = { rule: { key: 'vegan', altType: 'vegan_alt' }, residents: [r] };
  // Wk2 THU dinner: vegan sausages carry wheat; the main meal ticks no gluten.
  assert.deepEqual([...splitNotes(c.doorSectionLineNotes(r, vegan, { hasPork: true }, 'SOY, WHEAT, NIGHTSHADES, PROCESSED MEAT'))].sort(), ['gluten-free']);
  // CODEX's own words on the vegan line read the same: GLUTEN, MILK, BEANS.
  assert.deepEqual([...splitNotes(c.doorSectionLineNotes(r, vegan, {}, 'GLUTEN, MILK, BEANS'))].sort(), ['dairy-free', 'gluten-free', 'no beans']);
  const v801 = { room: '801', tags: ['No Spicy', 'Vegetarian'] };
  assert.deepEqual([...splitNotes(c.doorSectionLineNotes(v801, { ...vegan, residents: [v801] }, {}, 'MUSTARD, NIGHTSHADES, SPICY, BRASSICAS'))], ['not spicy']);
  // Only ever adds: no plate string, the main meal's flags as before.
  assert.deepEqual([...splitNotes(c.doorSectionLineNotes(r, vegan, { hasGluten: true }, ''))], ['gluten-free']);
  assert.deepEqual([...splitNotes(c.doorSectionLineNotes(r, vegan, {}, 'SOY, SESAME'))], []);
});

test('mutation check: the gate goes red when a rule is broken', () => {
  const dropTrigger = ROUTING.replace("triggers:['hasFish','hasShellfish']", "triggers:['hasFish']");
  assert.notEqual(dropTrigger, ROUTING, 'the no_fish rule was found');
  assert.ok(diffSeats(box(dropTrigger)).length > 0, 'dropping the shellfish trigger is caught');
  const softLine = ROUTING.match(/\n\s*\{p:9, +key:'soft'[^\n]*/)[0];
  const softFirst = ROUTING.replace(softLine, '').replace(/\n(\s*\{p:7, +key:'diabetic')/, softLine + '\n$1');
  assert.notEqual(softFirst, ROUTING, 'the Soft rule was moved');
  assert.ok(diffSeats(box(softFirst)).length > 0, 'moving Soft Meals above Diabetic and Bland is caught');
  const noGuard = ROUTING.replace("&& activeKeys.has('gf')", '');
  assert.notEqual(noGuard, ROUTING, 'the Bland → GF guard was found');
  assert.ok(diffSeats(box(noGuard)).length > 0, 'the 2026-10-16 "No Spicy had no plate" bug is caught');
});
