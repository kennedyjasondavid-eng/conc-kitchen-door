// tests/tag_table_consistency_gate.mjs — DOOR's tag tables agree with each other and with the rules table (2026-10-18, audit A1).
// The shellfish thread found bugs of one shape: a rule existed, and another table quietly didn't read it (a CODEX label
// no map knew, a resident tag no note matched, an anaphylactic tag nothing contained, "Gluten Free" where the tag is GF).
// This gate reads the REAL tables from index.html and checks that every name is real, every tier set means what it says,
// no row is doubled, and every anaphylactic tag DOOR offers is contained. The census at the bottom is the per-tag table of
// docs/DOOR_ROUTING_RULES_2026-10-18.md §4 as code: a new tag, or a tag whose rules change, fails here by name, so the
// rules table is updated with it. Authored to fail on main 66e0bec ("Gluten Free" in COMPLIANCE_TIERS; Bland Diet in no
// section; No Processed Food read by no conflict check; the census rows the 2026-10-18 rulings changed).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
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
  bracedConst('TAG_LABELS_MAP'), between('const FLAG_DEFS = [', '\n];\n') + '\n];\n',
  between('const ROUTING_RULES = [', '// ============================================================'),
  between('const ROUTING_TAGS = new Set([', 'function migrateResidentTiers('),
  between('const RESIDENT_TO_MEAL_FLAG = {', '\n};\n') + '\n};\n', between('const CONFLICT_MAP = [', '\n];\n') + '\n];\n',
  bracedConst('COMPLIANCE_TIERS'), between('const ANAPH_TAG_TO_MEAL_FLAG = {', '\n};\n') + '\n};\n',
  'this.T = { L: Object.values(TAG_LABELS_MAP), F: FLAG_DEFS.map(d => d.key), RR: ROUTING_RULES, RT: [...ROUTING_TAGS], AT: [...ALLERGEN_TAGS],',
  '  CT: [...ACCOMMODATION_TAGS], R2M: RESIDENT_TO_MEAL_FLAG, CM: CONFLICT_MAP, TIERS: COMPLIANCE_TIERS, AN: ANAPH_TAG_TO_MEAL_FLAG };',
].join('\n'), c, { filename: 'index.html#tag-tables', timeout: 5000 });
const T = JSON.parse(JSON.stringify(c.T));
const LABELS = new Set(T.L), FLAGS = new Set(T.F);
// The anaphylactic picker (populateAnaphTags) offers the allergen tags and these routing tags.
// Re-pinned 2026-10-18 (v31-standard.39): the picker's own list moved to ANAPH_ROUTING_ALLERGEN_TAGS, read through
// doorIsAnaphAllergenTag, which Generate's check on the anaphylactic list also reads.
const pickerSrc = between('function populateAnaphTags(', '\n}\n');
assert.equal((pickerSrc.match(/doorIsAnaphAllergenTag\(label\)/g) || []).length, 2, 'the picker reads doorIsAnaphAllergenTag');
const PICKER_EXTRA = JSON.parse(between('const ANAPH_ROUTING_ALLERGEN_TAGS = ', ';').slice('const ANAPH_ROUTING_ALLERGEN_TAGS = '.length).replace(/'/g, '"'));
const PICKER = [...T.AT, ...PICKER_EXTRA];

test('every tag a table names is a real tag, and every flag a real meal flag', () => {
  const bad = [];
  const tag = (where, t) => { if (!LABELS.has(t)) bad.push(where + ': "' + t + '" is not a tag'); };
  const flag = (where, f) => { if (!FLAGS.has(f)) bad.push(where + ': "' + f + '" is not a meal flag'); };
  Object.entries(T.R2M).forEach(([t, f]) => { tag('RESIDENT_TO_MEAL_FLAG', t); flag('RESIDENT_TO_MEAL_FLAG ' + t, f); });
  Object.entries(T.AN).forEach(([t, fs]) => { tag('ANAPH_TAG_TO_MEAL_FLAG', t); fs.forEach((f) => flag('ANAPH_TAG_TO_MEAL_FLAG ' + t, f)); });
  T.CM.forEach((r) => { tag('CONFLICT_MAP', r.residentTag); flag('CONFLICT_MAP ' + r.residentTag, r.mealFlag); });
  Object.keys(T.TIERS).forEach((t) => tag('COMPLIANCE_TIERS', t));
  T.RR.forEach((r) => { r.tags.forEach((t) => tag('ROUTING_RULES ' + r.key, t)); (r.triggers || []).forEach((f) => flag('ROUTING_RULES ' + r.key, f));
    Object.entries(r.tagTriggers || {}).forEach(([t, fs]) => { if (!r.tags.includes(t)) bad.push(r.key + ': tagTriggers names ' + t + ', not one of its tags'); fs.forEach((f) => flag(r.key + ' tagTriggers', f)); }); });
  [...T.RT, ...T.AT, ...T.CT].forEach((t) => tag('tier sets', t));
  assert.deepEqual(bad, []);
});

test('every tag is in exactly one tier set, and every routing tag sits in a section', () => {
  const sets = { routing: T.RT, allergen: T.AT, accommodation: T.CT };
  const bad = [];
  T.L.forEach((t) => { const n = Object.values(sets).filter((s) => s.includes(t)).length; if (n !== 1) bad.push(t + ' is in ' + n + ' tier sets'); });
  const seated = new Set(T.RR.flatMap((r) => r.tags));
  T.RT.forEach((t) => { if (!seated.has(t)) bad.push('routing tag ' + t + ' sits in no section'); });
  // Tags outside the routing set that a section seats, each ruled: Low Carb shares Diabetic; No Molluscs and No Mustard
  // route (Jason, 2026-10-18). Any other would be a tag routing reads but the tier set doesn't say.
  const extra = [...seated].filter((t) => !T.RT.includes(t)).sort();
  assert.deepEqual(extra, ['Low Carb', 'No Molluscs', 'No Mustard'], 'tags a section seats outside the routing set');
  assert.deepEqual(bad, []);
});

test('no table names a row twice', () => {
  const dup = (arr) => arr.filter((x, i) => arr.indexOf(x) !== i);
  assert.deepEqual(dup(T.CM.map((r) => r.mealFlag + '|' + r.residentTag)), [], 'CONFLICT_MAP');
  assert.deepEqual(dup(T.RR.map((r) => r.key)), [], 'ROUTING_RULES keys');
  T.RR.forEach((r) => assert.deepEqual(dup(r.tags), [], r.key + ' tags'));
  Object.entries(T.AN).forEach(([t, fs]) => assert.deepEqual(dup(fs), [], t));
});

test('every tag the anaphylactic picker offers is contained, except the one DOOR has no flag for', () => {
  const uncontained = PICKER.filter((t) => !(T.AN[t] && T.AN[t].length)).sort();
  assert.deepEqual(uncontained, ['No Oats'], 'No Oats: DOOR has no oats flag (rules table L11)');
  Object.keys(T.AN).forEach((t) => assert.ok(PICKER.includes(t), t + ' is contained but the picker never offers it'));
});

test('every tag with a line note is in the conflict check; the one without a note is named', () => {
  const noted = [...new Set(T.CM.map((r) => r.residentTag))];
  assert.deepEqual(noted.filter((t) => !T.R2M[t]), [], 'a line note with no conflict check');
  const R2M_ONLY = Object.keys(T.R2M).filter((t) => !noted.includes(t)).sort();
  // No Pork: only Vegan outranks Halal, and the vegan plate has no pork, so it never needs a note.
  assert.deepEqual(R2M_ONLY, ['No Pork'], 'conflict-checked tags with no line note');
  // A conflict-check flag is one the tag's notes also read.
  Object.entries(T.R2M).filter(([t]) => noted.includes(t)).forEach(([t, f]) =>
    assert.ok(T.CM.some((r) => r.residentTag === t && r.mealFlag === f), t + ' is checked on ' + f + ' but noted on other flags'));
});

test('the compliance tiers name GF, the tag, and keep it documented (Jason, 2026-10-18: "keep all three")', () => {
  assert.equal(T.TIERS.GF, 'doc');
  assert.equal('Gluten Free' in T.TIERS, false, '"Gluten Free" is the section, not a tag');
  assert.equal(T.TIERS['Lactose Intolerant'], 'auto', 'ruled 2026-10-18');
});

// The census: docs/DOOR_ROUTING_RULES_2026-10-18.md §4, one row per tag. [set, section key (opens on), conflict flag,
// noted flags, lockout flags, tier ('doc*' = not listed)]. Re-pin it with the rules table when a ruling changes a tag.
const CENSUS = {
  'Halal': ['routing', 'halal', '', '', '', 'auto'], 'No Pork': ['routing', 'halal', 'hasPork', '', '', 'doc'],
  'Diabetic': ['routing', 'diabetic', '', '', '', 'doc'], 'Vegetarian': ['routing', 'vegan', '', '', '', 'auto'],
  'Vegan': ['routing', 'vegan', '', '', '', 'auto'], 'Low Sodium': ['accommodation', '', '', '', '', 'doc'],
  'GF': ['routing', 'gf', 'hasGluten', 'hasGluten', 'hasGluten', 'doc'],
  'Lactose Intolerant': ['routing', 'no_dairy', 'hasDairy', 'hasDairy', '', 'auto'],
  'No Dairy': ['routing', 'no_dairy', 'hasDairy', 'hasDairy', 'hasDairy', 'doc'],
  'No Fish': ['routing', 'no_fish', 'hasFish', 'hasFish', 'hasFish', 'auto'],
  'No Shellfish': ['routing', 'no_fish', 'hasShellfish', 'hasFish,hasShellfish', 'hasFish,hasShellfish', 'doc'],
  'No Molluscs': ['allergen', 'no_fish', 'hasShellfish', 'hasShellfish', 'hasFish,hasShellfish', 'doc*'],
  'No Spicy': ['routing', 'bland', 'isSpicy', 'isSpicy', '', 'doc'], 'Bland Diet': ['routing', 'bland', 'isSpicy', 'isSpicy', '', 'doc*'],
  'Soft Meals': ['routing', 'soft', '', '', '', 'doc'], 'No Processed Food': ['routing', 'no_processed', 'hasProcessedMeat', 'hasProcessedMeat', '', 'doc'],
  'No Beef': ['routing', 'no_beef', 'hasBeef', 'hasBeef', 'hasBeef', 'auto'], 'No Eggs': ['routing', 'no_egg', 'hasEgg', 'hasEgg', 'hasEgg', 'doc'],
  'No Mustard': ['allergen', 'no_egg', 'hasMustard', 'hasMustard', 'hasMustard', 'doc'],
  'Low Carb': ['accommodation', 'diabetic', '', '', '', 'doc'], 'Low Fat': ['accommodation', '', '', '', '', 'doc'],
  'Low Potassium': ['accommodation', '', '', '', '', 'doc'], 'No Fried Food': ['accommodation', '', '', '', '', 'doc'],
  'Other': ['accommodation', '', '', '', '', 'doc*'], 'No Peanuts': ['allergen', '', 'hasPeanuts', 'hasPeanuts', 'hasPeanuts', 'doc'],
  'No Tree Nuts': ['allergen', '', 'hasTreeNuts', 'hasTreeNuts', 'hasTreeNuts', 'doc'], 'No Coconut': ['allergen', '', 'hasCoconut', 'hasCoconut', 'hasCoconut', 'doc'],
  'No Soy': ['allergen', '', 'hasSoy', 'hasSoy', 'hasSoy', 'doc'], 'No Sesame': ['allergen', '', 'hasSesame', 'hasSesame', 'hasSesame', 'doc'],
  'No Sulphites': ['allergen', '', 'hasSulphites', 'hasSulphites', 'hasSulphites', 'doc'],
  'No Nightshades': ['allergen', '', 'hasNightshades', 'hasNightshades', 'hasNightshades', 'auto'], 'No Oats': ['allergen', '', '', '', '', 'doc*'],
  'No Beans': ['accommodation', '', 'hasBeans', 'hasBeans', '', 'auto'], 'No Mushroom': ['accommodation', '', 'hasMushroom', 'hasMushroom', '', 'auto'],
  'No Corn': ['accommodation', '', 'hasCorn', 'hasCorn', '', 'doc'], 'No Brassicas': ['accommodation', '', 'hasBrassicas', 'hasBrassicas', '', 'auto'],
  'No Turkey': ['accommodation', '', 'hasTurkey', 'hasTurkey', '', 'auto'],
};
test('the census: every tag\'s rules are the rules table\'s row', () => {
  const row = (t) => [
    T.RT.includes(t) ? 'routing' : T.AT.includes(t) ? 'allergen' : 'accommodation',
    (T.RR.find((r) => r.tags.includes(t)) || {}).key || '', T.R2M[t] || '',
    T.CM.filter((r) => r.residentTag === t).map((r) => r.mealFlag).sort().join(','), (T.AN[t] || []).slice().sort().join(','), T.TIERS[t] || 'doc*',
  ];
  assert.deepEqual(T.L.filter((t) => !CENSUS[t]), [], 'a tag with no census row: add it to the rules table and here');
  const diffs = T.L.filter((t) => JSON.stringify(row(t)) !== JSON.stringify(CENSUS[t])).map((t) => t + ': ' + JSON.stringify(row(t)) + ' ≠ ' + JSON.stringify(CENSUS[t]));
  assert.deepEqual(diffs, []);
});
