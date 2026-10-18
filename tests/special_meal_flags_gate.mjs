// tests/special_meal_flags_gate.mjs — a special meal keeps every flag its dishes and boxes give it (2026-10-18, v31-standard.31).
// Found while following CODEX's shellfish labels through DOOR. A special meal (a celebration on a date) lost flags three ways:
//   - its Crustaceans / Molluscs / Wheat boxes set hasCrustacean / hasMollusc / hasWheat, which nothing reads, and a
//     linked CODEX shrimp recipe's hasShellfish had no box at all, so a shellfish special meal never warned anyone;
//   - getMealForDate's resolveFlags read nine keys back, so its Soy, Sesame, Tree Nuts, Mustard and Sulphites boxes were
//     dropped too;
//   - the grid shows priority allergens only, so a linked recipe's coconut, nightshades or chicken never reached the meal.
// Now: one Shellfish box (Fish is fish), every box is a meal flag, resolveFlags reads them all (older records' retired
// boxes count as Shellfish / Gluten), and a saved special meal carries every flag its main-meal slots carry
// (smMealFlagsRaw → _flagsRaw), the boxes deciding their own keys. A displaced rotation meal keeps all its flags.
// Nothing moves today: special_meals.json is empty. Authored to fail on main 9cf22d9 (v31-standard.30).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) { return between('function ' + name + '(', '\n}\n') + '\n}\n'; }
function fnOpt(name) { return html.includes('function ' + name + '(') ? fn(name) : ''; }
const json = (f) => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'));

const smBlock = between('const SM_ALLERGENS = [', '\n];\n') + '\n];\n';
// Re-pinned 2026-10-18 (the routing audit, swap days): getMealForDate's resolveFlags moved to doorDatedMealFlags, which
// the plating engine also reads for a slot's swap or special meal; resolveFlags now calls it.
const resolveFlags = (html.includes('function doorDatedMealFlags(') ? fn('doorDatedMealFlags') + 'function resolveFlags(entry) { return doorDatedMealFlags(entry); }\n'
  : between('  function resolveFlags(entry) {', '\n  }\n') + '\n  }\n');
const ctx = { console: { warn() {} }, window: {}, DOOR_RECIPE_DATA: [] };
vm.createContext(ctx);
vm.runInContext([
  between('const FLAG_DEFS = [', '\n];\n') + '\n];\n',
  smBlock, fnOpt('smMealFlagsRaw'), fnOpt('doorMealFlagsOf'), resolveFlags,
  between('const HUB_ALLERGEN_MAP = {', '// ── Slot rendering'),
  between('const ROUTING_RULES = [', '// ============================================================') + between('function computeSections(', 'let mcWeek ='),
  'this.__SM = SM_ALLERGENS; this.__FLAG_KEYS = FLAG_DEFS.map(d => d.key);',
].join('\n'), ctx, { filename: 'index.html#special-meal-flags', timeout: 5000 });
const out = (v) => JSON.parse(JSON.stringify(v));
const on = (f) => Object.keys(f).filter(k => f[k]).sort();

test('every Special Meal box is a meal flag; Shellfish has a box; Fish is fish', () => {
  const keys = out(ctx.__SM).map(a => a.key), flagKeys = out(ctx.__FLAG_KEYS);
  assert.deepEqual(keys.filter(k => !flagKeys.includes(k)), [], 'no box sets a key nothing reads');
  assert.deepEqual(out(ctx.__SM).find(a => a.key === 'hasShellfish'), { key: 'hasShellfish', label: 'Shellfish' });
  assert.deepEqual(out(ctx.__SM).find(a => a.key === 'hasFish'), { key: 'hasFish', label: 'Fish' });
  assert.equal(keys.length, new Set(keys).size, 'no box twice');
});

test('a special meal saved without _flagsRaw keeps every box it ticked', () => {
  for (const { key } of out(ctx.__SM)) {
    assert.equal(ctx.resolveFlags({ allergens: [key] })[key], true, key);
  }
  assert.equal(ctx.resolveFlags({ allergens: ['hasBeef'] }).hasBeef, true, 'beef, read before, still read');
  assert.deepEqual(on(ctx.resolveFlags({ allergens: [] })), []);
});

test('older records\' Crustaceans, Molluscs and Wheat boxes count as Shellfish and Gluten', () => {
  assert.deepEqual(on(ctx.resolveFlags({ allergens: ['hasCrustacean'] })), ['hasShellfish']);
  assert.deepEqual(on(ctx.resolveFlags({ allergens: ['hasMollusc'] })), ['hasShellfish']);
  assert.deepEqual(on(ctx.resolveFlags({ allergens: ['hasWheat'] })), ['hasGluten']);
  assert.deepEqual(on(ctx.resolveFlags({ allergens: ['hasFish', 'hasCrustacean', 'hasWheat', 'hasGluten'] })), ['hasFish', 'hasGluten', 'hasShellfish']);
});

test('a linked CODEX recipe\'s flags travel with the special meal, and the boxes decide their own keys', () => {
  assert.equal(typeof ctx.smMealFlagsRaw, 'function', 'smMealFlagsRaw');
  const slots = {
    main: { recipeName: 'Shrimp Curry', flags: ctx.hubAllergenToFlags(['Crustaceans (Shrimp)', 'Tree Nuts (Coconut Milk)', 'Nightshades (Tomato)']) },
    starch: { manual: 'Rice', flags: { hasChicken: true } },
    veganalt: { recipeName: 'Tofu Curry', flags: { hasSoy: true } },
  };
  const checked = ['hasShellfish', 'hasTreeNuts'];   // what the grid auto-ticks from the slots
  const raw = out(ctx.smMealFlagsRaw(slots, checked));
  assert.deepEqual(on(raw), ['hasChicken', 'hasCoconut', 'hasNightshades', 'hasShellfish', 'hasTreeNuts'],
    'shellfish from its box; coconut, nightshades and chicken from the dishes, though the grid has no box for them');
  assert.equal(raw.hasSoy, false, 'an alternative-plate slot is not the main meal (and Soy is a box nobody ticked)');
  const untick = out(ctx.smMealFlagsRaw(slots, ['hasShellfish']));
  assert.equal(untick.hasTreeNuts, false, 'a box the operator unticked stays off, as before');
  assert.equal(untick.hasCoconut, true, 'a flag with no box still travels');
  // end to end: the meal as getMealForDate reads it routes a No Shellfish resident to the vegan plate
  const meal = ctx.resolveFlags({ allergens: checked, _flagsRaw: raw });
  const seats = out(ctx.computeSections(meal, [{ room: '201', tags: ['No Shellfish'] }]).map(s => [s.rule.key, s.residents.map(r => r.room)]));
  assert.deepEqual(seats.find(([, r]) => r.includes('201'))[0], 'vegan');
});

test('a displaced rotation meal keeps all its flags', () => {
  assert.equal(typeof ctx.doorMealFlagsOf, 'function', 'doorMealFlagsOf');
  const meal = { name: 'Coconut Curry', veg: 'Tofu', hasCoconut: true, isSpicy: true, hasShellfish: false, halalCertifiedMeat: true,
    _vegAltSafe: true, _altMeals: [], mainItem: 'Curry' };
  assert.deepEqual(out(ctx.doorMealFlagsOf(meal)), { hasCoconut: true, isSpicy: true, hasShellfish: false, halalCertifiedMeat: true });
  assert.deepEqual(out(ctx.doorMealFlagsOf(null)), {});
});

test('both saves write the flags, and the published special meals are unchanged', () => {
  const save = fn('saveSpecialMeal');
  assert.match(save, /_flagsRaw: smMealFlagsRaw\(SM_SLOT_STATE, allergens\)/, 'a new special meal');
  assert.match(save, /_flagsRaw: doorMealFlagsOf\(origMeal\)/, 'the displaced rotation meal');
  assert.deepEqual(Object.keys(json('special_meals.json')), [], 'no special meal is published today');
});
