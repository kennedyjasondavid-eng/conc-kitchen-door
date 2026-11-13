// tests/door_rules_words_d2a_gate.mjs — D2a: DOOR's allergen word lists, add-only, edited in the app by named leads
// (2026-11-10, v31-standard.65). Jason, 2026-11-10: "go ahead" with D2; who edits = a sending connection key AND a name
// on the leads list (only Jason changes that list); first slice = words, add-only; plate rules read-only.
// Runs the REAL readers (allergenStrToFlags, buildSlotFlags, doorApplyTextDetectedFlags, normalizeRestriction,
// doorRexTokens, doorRexSameDish, computeSections) in a vm with the door-rules core and shell beside them, on a made-up
// local store, and the real publisher in the F1 publish box. No resident data: every resident here is made up.
// Authored to fail on da57f2a (no door-rules block). Review fold (2026-11-10, FIX FIRST): Rex spellings re-checked at
// read time and built-ins first (mutant m1), take-back of published flags, the plate dry run, restriction words stay
// questions, a 409 retry keeps another computer's words, canonical times, escaping of every shown string. Second review
// fold (2026-11-10, FIX FIRST): unknown fields verbatim from the kitchen and a newer file refused (N1), no record dropped
// for its time and no send with fewer words than the kitchen (N2), the dry run on every meal and honest about what it
// can't see (N3), mutants md/mg/mt/mx (N4), tighter Rex spellings (N5), own unsent changes only (N6), the kitchen-state
// line (N7), Undo and compile errors (N8), y -> ies plurals.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
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
const CORE_S = '/* DOOR_TESTABLE_CORE_START door-rules */', CORE_E = '/* DOOR_TESTABLE_CORE_END door-rules */';
const core = () => between(CORE_S, CORE_E);
const shell = () => between(CORE_E, '\n// The recipes a dish can link');
const rulesSource = () => core() + '\n' + shell();

// The readers, with or without the rules module (withRules false: the hooks find no helper, as on da57f2a).
function box(opts = {}) {
  const store = Object.assign({ concLearnedNR: '{}', concDismissedDiffs: '{}', concCustomTagRules: '[]' }, opts.store || {});
  const c = {
    console, REGISTRY_LIST: [], REGISTRY_MAP: {}, anaphRooms: [], changesQueue: [], IMPORT_STATE: null, MEAL: { lunch: 'lunch' },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    document: { getElementById: () => null, querySelectorAll: () => [] }, showToast() {},
    PublishAuth: opts.auth || { getSavedToken: () => '', isViewingKey: () => false, isExpired: () => false },
    getOperatorName: () => opts.operator || '', store,
  };
  vm.createContext(c);
  const parts = [
    fn('doorText'), fn('escapeHtml'), fn('_escAttr'),
    bracedConst('TAG_LABELS_MAP'), fn('getRoomBase'), between('const FLAG_DEFS = [', '\n];') + '\n];',
    between('const ROUTING_RULES = [', '\n];') + '\n];', between('const CONFLICT_MAP = [', '\n];') + '\n];', fn('computeSections'),
    between('const DOOR_BRASSICA_RE', '\n') + '\n', fn('doorApplyTextDetectedFlags'),
    between('/* DOOR_TESTABLE_CORE_START menu-parse */', '/* DOOR_TESTABLE_CORE_END menu-parse */'),
    between('/* DOOR_TESTABLE_CORE_START rex-week */', '/* DOOR_TESTABLE_CORE_END rex-week */'),
    between('const IMPORT_TAG_RULES = [', '\nfunction handleImportFile('),
  ];
  if (opts.withRules !== false) parts.push(rulesSource());
  parts.push('this.api = { allergenStrToFlags, nameDetectFlags, buildSlotFlags, doorApplyTextDetectedFlags, normalizeRestriction, doorRexTokens, doorRexSameDish, emptyMealFlags, computeSections };');
  vm.runInContext(parts.join('\n'), c, { filename: 'index.html#d2a', timeout: 20000 });
  return c;
}
const on = (f) => Object.keys(f).filter(k => f[k]).sort();
const plain = (v) => JSON.parse(JSON.stringify(v));
const T = '2026-11-10T12:00:00.000Z', T2 = '2026-11-10T13:00:00.000Z';
function withAdds(adds, leads) {
  return { store: { concDoorRules: JSON.stringify({ additions: adds.map(a => Object.assign({ by: 'Jason', at: T }, a)), leads: leads || [], log: [] }) } };
}
const ctxFor = (c, list) => vm.runInContext('doorRulesCheckCtx(' + JSON.stringify(list) + ')', c);

test('add-only rules: built-in, duplicate, unknown or reducing target, odd characters, and Rex spellings that are not slips', () => {
  const c = box();
  const rules = { additions: [{ list: 'menuName', word: 'abalone', target: 'hasShellfish', by: 'Jason', at: T }] };
  const chk = (list, w, t) => c.doorRulesCheck(rules, list, w, t, ctxFor(c, list));
  // built in, to any target
  assert.equal(chk('menuName', 'shrimp', 'hasShellfish').code, 'built-in');
  assert.equal(chk('menuName', 'tofu', 'hasPeanuts').code, 'built-in', 'a built-in word is refused whatever its target');
  assert.equal(chk('workbookAllergen', 'mussels', 'hasShellfish').code, 'built-in');
  assert.equal(chk('restriction', 'gluten free', 'noTreeNuts').code, 'built-in');
  assert.equal(chk('restriction', 'almond', 'noTreeNuts').code, 'built-in', '"No Almond" is read already');
  assert.equal(chk('rexSpelling', 'carribean', 'caribbean').code, 'built-in');
  assert.equal(chk('rexSpelling', 'roast', 'caribbean').code, 'built-in', 'a canonical word is not a spelling');
  assert.equal(chk('rexSpelling', 'chilli', 'tofu').code, 'built-in', 'a REX_SYN key');
  // duplicate
  assert.equal(chk('menuName', 'Abalone', 'hasFish').code, 'added');
  // unknown or reducing targets: a new flag, Halal-Certified Meat, Carb-swap, the meats, plate-choosing tags
  for (const t of ['hasLupin', 'halalCertifiedMeat', 'isCarb', 'hasPork', 'hasBeef', 'hasChicken', 'hasTurkey']) {
    assert.equal(chk('menuName', 'geoduck', t).code, 'target', t);
    assert.equal(chk('workbookAllergen', 'geoduck', t).code, 'target', 'workbook ' + t);
  }
  for (const t of ['halal', 'vegan', 'vegetarian', 'softMeals', 'diabetic', 'lowCarb', 'other', 'noBrandNew']) assert.equal(chk('restriction', 'celiac', t).code, 'target', t);
  // characters and length: no pattern from a person
  for (const w of ['sh.*mp', 'a|b', 'pine(nut)', 'x', 'nuts!', 'shrimp\\b', '1abc']) assert.ok(!chk('menuName', w, 'hasShellfish').ok, w);
  assert.equal(chk('rexSpelling', 'two words', 'turmeric').code, 'characters');
  // Rex (review P1-1): only a slip of the target, and neither word names an allergen or a meat
  const rexCtx = ctxFor(c, 'rexSpelling'); rexCtx.targets = ['chicken', 'tofu', 'yogurt'];   // as if DOOR's menu named them
  for (const [w, t] of [['shrimp', 'chicken'], ['prawns', 'chicken'], ['tilapia', 'chicken'], ['pork', 'chicken'], ['tofuu', 'tofu']]) {
    assert.equal(c.doorRulesCheck({}, 'rexSpelling', w, t, rexCtx).ok, false, w + ' → ' + t);
  }
  assert.equal(c.doorRulesCheck({}, 'rexSpelling', 'shrimp', 'chicken', rexCtx).code, 'spelling', 'shrimp → chicken is no slip');
  assert.equal(c.doorRulesCheck({}, 'rexSpelling', 'tofuu', 'tofu', rexCtx).code, 'spelling', 'tofu names soy');
  // second review N5: two letters apart in a short word, or another first letter, is another dish
  rexCtx.targets = rexCtx.targets.concat(['kofta', 'salad', 'tikka', 'biryani']);
  for (const [w, t] of [['korma', 'kofta'], ['satay', 'salad'], ['zikka', 'tikka']]) assert.equal(c.doorRulesCheck({}, 'rexSpelling', w, t, rexCtx).code, 'spelling', w + ' → ' + t);
  assert.ok(c.doorRulesNearSpelling('tika', 'tikka') && !c.doorRulesNearSpelling('korma', 'kofta') && !c.doorRulesNearSpelling('satay', 'salad'));
  assert.ok(c.doorRulesNearSpelling('turmerik', 'turmeric') && !c.doorRulesNearSpelling('burmeric', 'turmeric'));
  assert.ok(!chk('rexSpelling', 'tilapia', 'yogurt').ok, 'not a slip');
  assert.equal(chk('rexSpelling', 'tilapia', 'yogurt').code, 'spelling');
  assert.equal(chk('rexSpelling', 'lasagnia', 'caribbean').code, 'spelling', 'far apart');
  assert.equal(chk('rexSpelling', 'stroganof', 'stroganoff').code, 'spelling', 'the target names beef');
  assert.equal(chk('rexSpelling', 'turmerik', 'nosuchword').code, 'target');
  assert.equal(c.doorRulesRexProblem('shrimp', 'chicken', { flagsOf: c.doorRulesFlagsOf }) !== '', true);
  assert.equal(c.doorRulesRexProblem('prawn', 'prawns', { flagsOf: c.doorRulesFlagsOf }) !== '', true, 'an allergen word');
  // allowed
  const ok = chk('menuName', 'Geoduck', 'hasShellfish');
  assert.deepEqual([ok.ok, ok.word, ok.target], [true, 'geoduck', 'hasShellfish']);
  assert.ok(chk('restriction', 'celiac', 'glutenFree').ok);
  assert.ok(chk('workbookAllergen', 'pine nut', 'hasTreeNuts').ok);
  assert.ok(chk('rexSpelling', 'turmerik', 'turmeric').ok);
});

test('an added word is read by each list\'s real reader, only ever adds, and never from the vegan line', () => {
  const c = box(withAdds([
    { list: 'menuName', word: 'geoduck', target: 'hasShellfish' },
    { list: 'workbookAllergen', word: 'pine nut', target: 'hasTreeNuts' },
    { list: 'restriction', word: 'celiac', target: 'glutenFree' },
    { list: 'rexSpelling', word: 'turmerik', target: 'turmeric' },
  ]));
  const plain0 = box({ withRules: false });
  const a = c.api, p = plain0.api;
  // menu dish names: the workbook import's dish text and the menu as read; plurals too
  assert.ok(on(a.buildSlotFlags('', 'Steamed Geoducks, Rice')).includes('hasShellfish'));
  assert.ok(!on(p.buildSlotFlags('', 'Steamed Geoducks, Rice')).includes('hasShellfish'));
  assert.ok(!on(a.nameDetectFlags('Geoduck', a.emptyMealFlags())).includes('hasShellfish'), 'nameDetectFlags (Rex vegan pieces too) is not hooked');
  const menu = { '1': { MONDAY: { lunch: 'Geoduck Chowder', lunch_flags: { ...a.emptyMealFlags(), hasDairy: true },
    dinner: 'Rice Bowl', dinner_veg: 'Geoduck-style Mushroom', dinner_sides: 'Salad', dinner_flags: a.emptyMealFlags() } } };
  const read = a.doorApplyTextDetectedFlags(menu)['1'].MONDAY;
  assert.deepEqual(on(read.lunch_flags), ['hasDairy', 'hasShellfish'], 'the meal keeps its flags and gains the added one');
  assert.equal(read.dinner_flags.hasShellfish, false, 'a word on the vegan line alone never sets a meal flag (P2-2)');
  assert.equal(menu['1'].MONDAY.lunch_flags.hasShellfish, false, 'the source is not mutated');
  assert.ok(!on(a.buildSlotFlags('', 'Mungeoduckery')).includes('hasShellfish'), 'whole words only');
  const ies = c.doorRulesWordRegex('anchovy');
  assert.ok(ies.test('Anchovies, Olives') && ies.test('anchovy') && !ies.test('anchovys x') === true, 'y → ies');
  // workbook allergen rows
  assert.deepEqual(on(a.allergenStrToFlags('gluten, Pine Nuts', a.emptyMealFlags())), ['hasGluten', 'hasTreeNuts']);
  assert.deepEqual(on(p.allergenStrToFlags('gluten, Pine Nuts', p.emptyMealFlags())), ['hasGluten']);
  // resident restrictions: the tag is added, the word stays a question, and the import is told who added it (P2-3)
  const r = a.normalizeRestriction('Halal / Celiac');
  assert.deepEqual(on(r.tags), ['glutenFree', 'halal']);
  assert.ok(r.unmatched.length > 0, 'the word is still asked about');
  assert.deepEqual(plain(r.addedReads), [{ word: 'celiac', tag: 'glutenFree', by: 'Jason', at: T }]);
  const was = p.normalizeRestriction('Halal / Celiac');
  assert.deepEqual(on(was.tags), ['halal']);
  assert.deepEqual(plain(r.unmatched), plain(was.unmatched), 'the same question as without the word');
  assert.match(c.doorRulesAddedReadsHTML(r.addedReads), /“celiac” read as GF by an added word \(Jason/);
  assert.match(fn('diffImportAgainstRegistry'), /addedReads: e\.parsed\.addedReads/);
  assert.match(fn('renderNeedsReviewPane'), /doorRulesAddedReadsHTML\(r\.addedReads\)/);
  // Rex spellings
  assert.deepEqual([...a.doorRexTokens('Turmerik Rice')], ['turmeric', 'rice']);
  assert.deepEqual([...p.doorRexTokens('Turmerik Rice')], ['turmerik', 'rice']);
});

test('Rex spellings are checked again at read time, and built-in spellings always win (review P1-1, mutant m1)', () => {
  const c = box(withAdds([
    { list: 'rexSpelling', word: 'shrimp', target: 'chicken' },
    { list: 'rexSpelling', word: 'pork', target: 'chicken' },
    { list: 'rexSpelling', word: 'tilapia', target: 'chicken' },
    { list: 'rexSpelling', word: 'chilli', target: 'tofu' },
    { list: 'rexSpelling', word: 'roast', target: 'rice' },
    { list: 'rexSpelling', word: 'turmerik', target: 'turmeric' },
  ]));
  const a = c.api;
  assert.equal(a.doorRexSameDish('Shrimp Fried Rice', 'Chicken Fried Rice'), false, 'shrimp never reads as chicken');
  assert.equal(a.doorRexSameDish('Pork Adobo', 'Chicken Adobo'), false);
  assert.deepEqual([...a.doorRexTokens('Tilapia Chilli Roast Turmerik')], ['tilapia', 'chili', 'roast', 'turmeric'], 'only the slip is read');
  assert.deepEqual(plain(c.doorRulesCompiledFor('rexSpelling').map(x => x.word)), ['turmerik']);
  // The built-in spelling is read before any added one, in both places doorRexToken reads them (m1 moved it first).
  const tok = fn('doorRexToken');
  assert.ok(tok.indexOf('if (REX_SYN[w]) return REX_SYN[w];') >= 0);
  assert.ok(tok.indexOf('if (REX_SYN[w]) return REX_SYN[w];') < tok.indexOf('doorRulesRexSpelling'), 'REX_SYN is read before the added spellings');
  assert.match(tok, /return REX_SYN\[w\] \|\| \(typeof doorRulesRexSpelling === 'function' \? doorRulesRexSpelling\(w\) : ''\) \|\| w;/);
  // And the read-time check drops a record whose word is a built-in spelling, whatever order doorRexToken reads in.
  const m1 = box({ ...withAdds([{ list: 'rexSpelling', word: 'chilli', target: 'tofu' }]) });
  assert.equal(m1.api.doorRexTokens('chilli')[0], 'chili');
});

test('a take-back stops the word from now on, and names the meals it already marked (they stay marked)', () => {
  const c = box(withAdds([
    { list: 'menuName', word: 'geoduck', target: 'hasShellfish' },
    { list: 'menuName', word: 'halalish', target: 'halalCertifiedMeat' },
    { list: 'restriction', word: 'veganish', target: 'vegan' },
  ]));
  const a = c.api;
  assert.ok(!on(a.buildSlotFlags('', 'Halalish Rice')).includes('halalCertifiedMeat'), 'a reducing target is ignored');
  assert.deepEqual(on(a.normalizeRestriction('Veganish').tags), [], 'a plate-choosing tag is never added');
  // "Publish": the menu as read becomes the base every computer adopts.
  const base = { '2': { TUESDAY: { lunch: 'Geoduck Chowder, Bread', lunch_flags: a.emptyMealFlags(), dinner: 'Rice', dinner_flags: a.emptyMealFlags() } } };
  const published = plain(a.doorApplyTextDetectedFlags(base));
  assert.equal(published['2'].TUESDAY.lunch_flags.hasShellfish, true);
  const marked = plain(c.doorRulesMarkedMeals(published, 'menuName', 'geoduck', 'hasShellfish'));
  assert.deepEqual(marked, [{ week: '2', day: 'TUESDAY', period: 'lunch' }]);
  const back = c.doorRulesTakeBack(c.loadDoorRules(), 'menuName', 'geoduck', 'Jason', T2);
  c.saveDoorRules(back);
  assert.ok(!on(a.buildSlotFlags('', 'Geoduck Chowder')).includes('hasShellfish'), 'not read from now on');
  assert.equal(plain(a.doorApplyTextDetectedFlags(published))['2'].TUESDAY.lunch_flags.hasShellfish, true, 'the published flag stays (over-warning is the safe side)');
  assert.equal(back.log[0].what, 'took back');
  assert.equal(back.additions.find(x => x.word === 'geoduck').takenBack, true, 'a dated record, not a delete');
  // The dialog names those meals, and the page links each to Edit Menu.
  const tb = fn('doorRulesTakeBackWord');
  assert.match(tb, /doorRulesTakeBackImpact\(list, w, cur\.target\)/);
  assert.match(tb, /items: imp\.meals\.map\(doorRulesMealLabel\)/);
  assert.match(tb, /keep it until someone unticks it in Edit Menu/);
  assert.match(tb, /doorRulesShowStillMarked\(list, label, imp\.meals\)/);
  assert.match(fn('doorRulesShowStillMarked'), /#menu-config\/edit\//);
  assert.equal(c.doorRulesMealLabel(marked[0]), 'Wk2 TUE lunch');
  assert.doesNotMatch(html, /returns DOOR to its built-in words/, 'the old promise is gone');
});

test('Add dry-runs the plates: a word that moves a resident off a protecting plate is refused (review P2-2)', () => {
  const c = box();
  const a = c.api;
  const seat = (flags, r) => { const s = a.computeSections({ ...flags }, [r]).find(x => x.residents.length); return !s || s.rule.key === 'regular' ? 'Regular' : s.rule.label; };
  const F = (extra) => Object.assign(a.emptyMealFlags(), { _diabeticAlt: '', _altMealsNone: true }, extra);
  // GF + No Dairy on a dairy meal with no gluten eats the vegan plate; a word that sets Gluten moves them to GF.
  const gfnd = { room: 'X1', tags: ['GF', 'No Dairy'] };
  const before = { 'Wk1 MON lunch': { a: seat(F({ hasDairy: true }), gfnd) } };
  const after = { 'Wk1 MON lunch': { a: seat(F({ hasDairy: true, hasGluten: true }), gfnd) } };
  assert.equal(before['Wk1 MON lunch'].a, 'Vegan / Vegetarian');
  assert.equal(after['Wk1 MON lunch'].a, 'Gluten Free');
  const m1 = plain(c.doorRulesSeatMoves(before, after));
  assert.equal(m1.blocked.length, 1, 'off the vegan plate: refused');
  assert.deepEqual(m1.moves, [{ meal: 'Wk1 MON lunch', from: 'Vegan / Vegetarian', to: 'Gluten Free', n: 1 }], 'counts only, no rooms');
  // Halal + No Fish on a fish meal eats the vegan plate; pork opens the halal plate ahead of it. Pork is no target.
  const hnf = { room: 'X2', tags: ['Halal', 'No Fish'] };
  const b2 = { m: { a: seat(F({ hasFish: true }), hnf) } }, a2 = { m: { a: seat(F({ hasFish: true, hasPork: true }), hnf) } };
  assert.equal(b2.m.a, 'Vegan / Vegetarian');
  assert.equal(c.doorRulesSeatMoves(b2, a2).blocked.length, 1);
  assert.ok(!plain(c.doorRulesTargetsFor('menuName')).includes('hasPork'));
  // Regular → a plate, or into the Anaphylactic Alternative, is more protection: allowed. Into Regular never is.
  const ok = plain(c.doorRulesSeatMoves({ m: { a: 'Regular', b: 'Vegan / Vegetarian' } }, { m: { a: 'Gluten Free', b: 'Anaphylactic Alternative' } }));
  assert.equal(ok.blocked.length, 0);
  assert.equal(c.doorRulesSeatMoves({ m: { a: 'Gluten Free' } }, { m: { a: 'Regular' } }).blocked.length, 1);
  // Add runs it before asking, refuses on a block or when the check can't run, and lists the counts in the question.
  const add = fn('doorRulesAddWord');
  assert.ok(add.indexOf('doorRulesDryRun(') < add.indexOf('await doorAsk('));
  assert.match(add, /if \(dry\.error\)/);
  assert.match(add, /if \(dry\.blocked\.length\)/);
  assert.match(add, /let items = doorRulesMovesLines\(dry\.moves\)/);
  assert.match(fn('doorRulesSeatsByMeal'), /computePlatingData\(p, wk, day\)/);
});

test('nothing changes with no additions: the published menu and made-up restrictions read the same', () => {
  const withMod = box(), without = box({ withRules: false });
  const menu = json('menu_current.json').menu;
  assert.deepEqual(plain(withMod.api.doorApplyTextDetectedFlags(menu)), plain(without.api.doorApplyTextDetectedFlags(menu)));
  let meals = 0;
  for (const wk of Object.keys(menu)) for (const day of Object.keys(menu[wk] || {})) for (const p of ['breakfast', 'lunch', 'dinner']) {
    const text = menu[wk][day][p];
    if (typeof text !== 'string') continue;
    meals++;
    assert.deepEqual(on(withMod.api.buildSlotFlags(text, text)), on(without.api.buildSlotFlags(text, text)), text);
    assert.deepEqual([...withMod.api.doorRexTokens(text)], [...without.api.doorRexTokens(text)]);
  }
  assert.ok(meals >= 80, 'the published menu was read: ' + meals);
  const madeUp = ['Regular', 'GF', 'Halal / No Sea Food', 'No Pork, Diabetic', 'Vegan', 'Lactose Intolerant', 'No Almond',
    'Soft Meals / No Spicy', 'Celiac', 'No Popcorn, Corn, Nuts, Coconuts', 'G/F, D/F', 'Allergic to Peanut', 'No Caulilower/ Tomatoes / Cucumber',
    'Low sodium', 'No Mushrooms', 'Bland diet', 'Prefers rice', 'No Beef or Red Meat', 'No Shellfish and Molluscs', 'Halal/GF'];
  for (const s of madeUp) assert.deepEqual(plain(withMod.api.normalizeRestriction(s)), plain(without.api.normalizeRestriction(s)), s);
});

test('who may edit: a sending key and a name on the leads list; only Jason changes the leads list', () => {
  const c = box();
  const leads = { leads: [{ name: 'Fiona', on: true, by: 'Jason', at: T }] };
  const who = (k, n, r) => c.doorRulesWho({ hasSendingKey: k, operator: n, rules: r || leads });
  assert.equal(who(false, 'Jason').canEdit, false, 'no key');
  assert.match(who(false, 'Jason').why, /no sending connection key/);
  assert.equal(who(true, '').canEdit, false, 'no name');
  assert.equal(who(true, 'Joan').canEdit, false, 'not a lead');
  assert.match(who(true, 'Joan').why, /not on the leads list/);
  assert.deepEqual([who(true, 'fiona ').canEdit, who(true, 'Fiona').canEditLeads], [true, false]);
  assert.deepEqual([who(true, 'Jason').canEdit, who(true, 'jason').canEditLeads], [true, true]);
  assert.equal(c.doorRulesClean({ leads: [{ name: 'Joan', on: true, by: 'Fiona', at: T }] }).leads.length, 0, 'only Jason makes a leads record');
  assert.equal(who(true, 'Fiona', c.doorRulesSetLead(leads, 'Fiona', false, 'Jason', T2)).canEdit, false);
  // a tie takes the lead off (P3)
  assert.equal(who(true, 'Fiona', c.doorRulesMerge(leads, { leads: [{ name: 'Fiona', on: false, by: 'Jason', at: T }] })).canEdit, false);
  const view = box({ operator: 'Jason', auth: { getSavedToken: () => 'k', isViewingKey: () => true, isExpired: () => false } });
  assert.equal(view.doorRulesWhoHere().canEdit, false);
  const send = box({ operator: 'Jason', auth: { getSavedToken: () => 'k', isViewingKey: () => false, isExpired: () => false } });
  assert.equal(send.doorRulesWhoHere().canEditLeads, true);
  for (const f of ['doorRulesAddWord', 'doorRulesTakeBackWord', 'doorRulesUndo']) assert.match(fn(f), /doorRulesWhoHere\(\)/, f);
  for (const f of ['doorRulesAddLead', 'doorRulesRemoveLead']) assert.match(fn(f), /canEditLeads/, f);
  assert.match(fn('renderDoorRulesPage'), /guards against mistakes; the connection key is the real lock/);
});

test('two computers merge per word and per lead, newest wins; no record is dropped for its time (P2-5, N2)', () => {
  const c = box();
  const A = c.doorRulesAdd({}, { list: 'menuName', word: 'geoduck', target: 'hasShellfish', by: 'Fiona', at: T });
  const B0 = c.doorRulesAdd({}, { list: 'workbookAllergen', word: 'pine nut', target: 'hasTreeNuts', by: 'Jason', at: T });
  const B = c.doorRulesTakeBack(c.doorRulesMerge(B0, A), 'menuName', 'geoduck', 'Jason', T2);
  const ab = c.doorRulesMerge(A, B), ba = c.doorRulesMerge(B, A);
  assert.deepEqual(plain(ab), plain(ba), 'order does not matter');
  assert.equal(c.doorRulesActive(ab, 'menuName').length, 0, 'the newer take-back wins');
  assert.deepEqual(plain(c.doorRulesActive(ab, 'workbookAllergen').map(r => r.word)), ['pine nut']);
  assert.equal(c.doorRulesActive(c.doorRulesMerge(ab, A), 'menuName').length, 0, 'an older copy cannot bring it back');
  const tie = c.doorRulesMerge({ additions: [{ list: 'menuName', word: 'geoduck', target: 'hasShellfish', by: 'J', at: T, takenBack: true }] },
    { additions: [{ list: 'menuName', word: 'geoduck', target: 'hasShellfish', by: 'J', at: T }] });
  assert.equal(c.doorRulesActive(tie, 'menuName').length, 1, 'a tie keeps the word');
  // times (second review N2): a non-canonical time is not well formed; a time far ahead is kept and only clamped for
  // ordering. A slow clock keeps every kitchen word, a fast one's words are kept by everyone, and a change made
  // after a skewed record still takes.
  const now = Date.parse('2026-11-10T12:00:00.000Z');
  const rec = (at, extra) => ({ additions: [Object.assign({ list: 'menuName', word: 'geoduck', target: 'hasShellfish', by: 'J', at }, extra || {})] });
  for (const at of ['2026-11-10T12:00:00Z', '2026-11-10T12:00:00.000Zjunk', '2026-11-10']) assert.equal(c.doorRulesClean(rec(at)).additions.length, 0, at);
  for (const at of ['9999-01-01T00:00:00.000Z', '2026-11-17T12:00:00.000Z', '2026-11-10T13:00:00.000Z']) assert.equal(c.doorRulesClean(rec(at)).additions.length, 1, at);
  const kitchenQ = { _meta: { version: 1, exported: '2026-11-10T12:00:00.000Z', site: 'rexdale' },
    leads: [{ name: 'Fiona', on: true, by: 'Jason', at: '2026-11-01T12:00:00.000Z' }],
    additions: [{ list: 'menuName', word: 'abalone', target: 'hasShellfish', by: 'Jason', at: '2026-11-01T12:00:00.000Z' },
      { list: 'menuName', word: 'geoduck', target: 'hasShellfish', by: 'Fiona', at: '2026-11-10T12:00:00.000Z' }], log: [] };
  const slow = Date.parse('2026-11-08T09:00:00.000Z');
  const slowCopy = c.doorRulesMerge({}, kitchenQ, slow, { kitchen: true });
  assert.deepEqual(plain(c.doorRulesActive(slowCopy, 'menuName').map(r => r.word)), ['abalone', 'geoduck'], 'a slow clock drops nothing (q4/q6)');
  assert.deepEqual(plain(c.doorRulesDrops(kitchenQ, slowCopy, [])), [], 'and would send nothing fewer');
  assert.equal(c.doorRulesSkewedCount(kitchenQ, slow), 1, 'the skew is counted for the page');
  const fast = rec('9999-01-01T00:00:00.000Z');
  const back = c.doorRulesTakeBack(fast, 'menuName', 'geoduck', 'Jason', c.doorRulesNextAt('9999-01-01T00:00:00.000Z', now), now);
  assert.equal(c.doorRulesActive(c.doorRulesMerge(fast, back, now), 'menuName').length, 0, 'a take-back after a fast-clock record takes');
  assert.equal(c.doorRulesActive(c.doorRulesMerge(back, fast, now), 'menuName').length, 0);
  assert.equal(c.doorRulesNextAt('2026-11-10T13:00:00.000Z', now), '2026-11-10T13:00:00.001Z');
  assert.equal(c.doorRulesNextAt('2026-11-10T11:00:00.000Z', now), '2026-11-10T12:00:00.000Z');
  assert.equal(c.doorRulesNextAt('9999-01-01T00:00:00.000Z', now), '9999-01-01T00:00:00.001Z', 'just after the record it replaces, unclamped');
  // third review NEW-1 (q8): a change that replaced a fast-clock record stays ahead of it at any later merge, on any
  // computer, an hour, a day or a week on. Both ways: a take-back over a fast add, a re-add over a fast take-back.
  const H = 3600000, base = Date.parse('2026-11-10T12:20:00.000Z');
  const g8 = (at, takenBack) => ({ additions: [Object.assign({ list: 'menuName', word: 'geoduck', target: 'hasShellfish', by: 'F', at }, takenBack ? { takenBack: true } : {})] });
  const fastAt = '2026-11-20T09:00:00.000Z';
  const tbAt = c.doorRulesNextAt(fastAt, base), reAt = c.doorRulesNextAt(fastAt, base);
  for (const dt of [0, 0.5 * H, 1 * H, 3 * H, 25 * H, 24 * 7 * H]) {
    for (const [x, y] of [[g8(tbAt, true), g8(fastAt)], [g8(fastAt), g8(tbAt, true)]]) {
      assert.equal(c.doorRulesActive(c.doorRulesMerge(x, y, base + dt), 'menuName').length, 0, 'take-back holds at +' + dt / H + ' h');
      assert.equal(c.doorRulesActive(c.doorRulesMerge(x, y, base + dt, { kitchen: true }), 'menuName').length, 0, 'kitchen merge, +' + dt / H + ' h');
    }
    for (const [x, y] of [[g8(reAt), g8(fastAt, true)], [g8(fastAt, true), g8(reAt)]]) {
      assert.equal(c.doorRulesActive(c.doorRulesMerge(x, y, base + dt), 'menuName').length, 1, 're-add holds at +' + dt / H + ' h');
    }
  }
  const holder = c.doorRulesMerge(g8(fastAt, true), { _meta: { version: 1 }, ...g8(reAt), leads: [], log: [] }, base + 3 * H, { kitchen: true });
  assert.deepEqual(plain(c.doorRulesDrops({ _meta: { version: 1 }, ...g8(reAt), leads: [], log: [] }, holder, [])), [], 'a computer holding the fast take-back keeps the re-add');
  assert.equal(c.doorRulesSkewed(fastAt, base), true, 'the skew is still shown');
  assert.doesNotMatch(core(), /doorRulesCapMs|doorRulesOrderMs/, 'no clamped order');
  for (const f of ['doorRulesAddWord', 'doorRulesTakeBackWord', 'doorRulesAddLead', 'doorRulesRemoveLead']) {
    assert.match(fn(f), /doorRulesStampFor\(/, f + ' stamps after the record it changes');
    assert.match(fn(f), /It did not take/, f + ' says when it did not take');
  }
  // shell merge, and the published file
  const s = box();
  s.doorApplyRemoteRules(c.doorRulesFile(ab, 'rexdale'));
  assert.deepEqual(plain(s.doorRulesActive(s.loadDoorRules(), 'workbookAllergen').map(r => r.word)), ['pine nut']);
  const f = c.doorRulesFile(ab, 'rexdale');
  assert.deepEqual([f._meta.version, f._meta.site, f._meta.exported], [1, 'rexdale', T2]);
  assert.equal(JSON.stringify(c.doorRulesFile(c.doorRulesMerge(ba, {}), 'rexdale')), JSON.stringify(f));
});

test('a D2a computer never changes what it doesn\'t know, and refuses a newer file (second review N1)', () => {
  const c = box();
  // Re-pinned 2026-11-10 (D2b): `plates` is a field this build now reads, so the stand-in unknown field is `laterField`.
  const P1 = [{ id: 'p', v: 1 }], P2 = [{ id: 'p', v: 2 }];
  const w = (word, at, extra) => Object.assign({ list: 'menuName', word, target: 'hasShellfish', by: 'Fiona', at }, extra || {});
  // q3: a tie of stamps used to keep this computer's P1 over the kitchen's P2. The kitchen copy now always decides.
  const k0 = { _meta: { version: 1, exported: '2026-11-10T09:00:00.000Z', site: 'rexdale' }, leads: [], additions: [], log: [], laterField: P1 };
  let A = c.doorRulesMerge({}, k0, undefined, { kitchen: true });
  A = c.doorRulesAdd(A, w('geoduck', '2026-11-10T10:05:00.000Z'));
  const k1 = plain(c.doorRulesFile(A, 'rexdale'));
  assert.deepEqual(k1.laterField, P1);
  A = c.doorRulesMerge(A, k1, undefined, { kitchen: true });
  const k2 = { ...k1, laterField: P2, _meta: { ...k1._meta, exported: '2026-11-10T10:05:00.000Z' } };
  A = c.doorRulesMerge(A, k2, undefined, { kitchen: true });
  assert.deepEqual(plain(A.laterField), P2, 'the kitchen copy wins a tie');
  assert.deepEqual(plain(c.doorRulesFile(A, 'rexdale').laterField), P2, 'and is what this computer republishes');
  const k3 = { ...k2 }; delete k3.laterField;
  assert.equal(plain(c.doorRulesMerge(A, k3, undefined, { kitchen: true })).laterField, undefined, 'a field the kitchen dropped stays dropped');
  assert.deepEqual(plain(c.doorRulesMerge(A, { leads: [] }).laterField), P2, 'before any kitchen read this computer keeps what it holds');
  // fields inside records, _meta fields and additions on an unknown list ride along untouched
  const k4 = { _meta: { version: 1, exported: '2026-11-10T10:00:00.000Z', site: 'rexdale', schema: 'x', plateRev: 7 },
    additions: [w('cockle', '2026-11-10T10:00:00.000Z', { note: 'D2b field' }), { list: 'plateRule', word: 'abc', target: 'x', by: 'Jason', at: '2026-11-10T10:00:00.000Z', shape: { any: 1 } }],
    leads: [{ name: 'Fiona', on: true, by: 'Jason', at: '2026-11-10T10:00:00.000Z', canEditPlates: true }],
    log: [{ at: '2026-11-10T10:00:00.000Z', by: 'Jason', what: 'plate edited', list: 'plateRule', extra: [1] }] };
  const f4 = plain(c.doorRulesFile(c.doorRulesMerge({}, k4, undefined, { kitchen: true }), 'rexdale'));
  assert.equal(f4._meta.schema, 'x'); assert.equal(f4._meta.plateRev, 7);
  assert.equal(f4.additions.find(x => x.word === 'cockle').note, 'D2b field');
  assert.deepEqual(f4.additions.find(x => x.list === 'plateRule'), k4.additions[1], 'an unknown list, verbatim');
  assert.equal(f4.leads[0].canEditPlates, true);
  assert.deepEqual(f4.log[0].extra, [1]); assert.equal(f4.log[0].list, 'plateRule');
  const tb = c.doorRulesTakeBack(c.doorRulesMerge({}, k4, undefined, { kitchen: true }), 'menuName', 'cockle', 'Jason', '2026-11-10T11:00:00.000Z');
  assert.equal(tb.additions.find(x => x.word === 'cockle').note, 'D2b field', 'a take-back keeps the record\'s own fields');
  assert.equal(Object.getPrototypeOf(c.doorRulesClean(JSON.parse('{"__proto__": {"x": 1}}'))).x, undefined, 'no prototype field');
  // a newer file version: refused out loud, not merged, and this computer keeps its copy
  const s = box({ store: { concDoorRules: JSON.stringify(c.doorRulesAdd({}, w('abalone', '2026-11-10T08:00:00.000Z'))) } });
  assert.equal(c.doorRulesNewerFile({ _meta: { version: 2 } }), true);
  assert.equal(c.doorRulesNewerFile({ _meta: { version: 1 } }) || c.doorRulesNewerFile({}), false);
  for (const v of [true, '1', '2', 1.5, 0, -1, 'abc', [1], {}]) assert.equal(c.doorRulesNewerFile({ _meta: { version: v } }), true, 'refused: ' + JSON.stringify(v));
  // third review P3-a (q3b): records this build can't read are carried verbatim, never dropped from the send
  const k5 = { _meta: { version: 1, exported: T, site: 'rexdale' }, leads: [{ name: 'Joan', on: true, by: 'Fiona', at: T }, 'x'], log: [{ at: 'bad', by: 'J', what: 'y' }],
    additions: [w('geoduck', '2026-11-10T10:00:00.000Z'), { list: 'menuName', word: 'crab-o-rama 2', target: 'hasShellfish', by: 'Jason', at: '2026-11-10T10:00:00.000Z' },
      { list: 'menuName', word: 'cockle', target: 'hasShellfish', by: 'Jason', at: '2026-11-10T10:00:00Z' }] };
  const C5 = box(); C5.doorApplyRemoteRules(k5);
  const staged5 = plain(C5.doorRulesFile(C5.loadDoorRules(), 'rexdale'));
  assert.equal(staged5.additions.length, 3, 'the kitchen holds 3 and the send holds 3');
  assert.deepEqual(staged5.additions.slice(1), k5.additions.slice(1), 'verbatim');
  assert.deepEqual(staged5.leads, k5.leads, 'leads this build cannot read ride along');
  assert.deepEqual(staged5.log, k5.log);
  assert.deepEqual(plain(C5.doorRulesActive(C5.loadDoorRules(), 'menuName').map(x => x.word)), ['geoduck'], 'and are never read');
  s.doorApplyRemoteRules({ _meta: { version: 2, exported: '2026-11-10T12:00:00.000Z' }, additions: [w('geoduck', '2026-11-10T12:00:00.000Z')], leads: [], log: [], laterField: P2 });
  assert.deepEqual(plain(s.doorRulesActive(s.loadDoorRules(), 'menuName').map(x => x.word)), ['abalone'], 'not merged');
  assert.equal(plain(s.doorRulesKitchenState()).reason, 'newer');
  assert.match(fn('renderDoorRulesPage'), /from a newer DOOR \(version/);
  assert.match(fn('doorPublishMergeRules'), /if \(doorRulesNewerFile\(value\)\) \{.*return false; \}/, 'never republished over');
});

test('every shown string is escaped: words, names, the log and the import line (P2-6, P3)', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const els = {};
  const c = box({ operator: 'Jason', auth: { getSavedToken: () => 'k', isViewingKey: () => false, isExpired: () => false },
    store: { concDoorRules: JSON.stringify({
      additions: [{ list: 'menuName', word: 'geoduck', target: 'hasShellfish', by: evil, at: T }],
      leads: [{ name: evil, on: true, by: 'Jason', at: T }],
      log: [{ at: T, by: evil, what: 'added', list: 'menuName', word: 'geoduck', target: 'hasShellfish' },
        { at: T2, by: 'Jason', what: 'lead added', name: evil }, { at: T2, by: 'Jason', what: 'added', list: '__proto__', word: 'odd', target: 'x' }] }) } });
  c.document = { getElementById: (id) => (els[id] = els[id] || { innerHTML: '', textContent: '', value: '' }), querySelectorAll: () => [] };
  vm.runInContext('renderDoorRulesPage()', c);
  const out = els['door-rules-body'].innerHTML;
  assert.ok(out.length > 1000, 'the page rendered');
  assert.doesNotMatch(out, /<img/);
  assert.match(out, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(out, /undefined/, 'an odd list name reads as "a word list"');
  // Re-pinned 2026-11-10 (D2b): the plate rules section is editable for leads, so its heading drops "(read-only)".
  assert.match(out, /Plate rules<\/summary>/);
  const imp = c.doorRulesAddedReadsHTML([{ word: 'celiac', tag: 'glutenFree', by: evil, at: T }]);
  assert.doesNotMatch(imp, /<img/);
});

test('door_rules.json is a kitchen file merged at the publish revision: a 409 retry keeps the other computer\'s words (P2-4)', async () => {
  const kitchen = between('const DOOR_KITCHEN_FILES = Object.freeze([', ']);');
  assert.match(kitchen, /'door_rules\.json'/);
  assert.doesNotMatch(between('const DOOR_PUBLIC_FEEDS = Object.freeze([', ']);'), /door_rules/);
  const pages = fs.readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  for (const line of pages.split('\n')) if (/^\s*-\s*'/.test(line)) assert.doesNotMatch(line, /door_rules/, 'never served on Pages');
  assert.match(between('const ALLOW_SHRINK_PATHS = new Set([', ']);'), /'door_rules\.json'/);
  assert.match(html, /\['door_rules\.json',\s+d => doorApplyRemoteRules\(d\)\]/);
  assert.doesNotMatch(fn('doorFlowStampCandidate'), /door_rules/);
  assert.doesNotMatch(fn('buildMenuJSON') + fn('buildRoutingByMealJSON'), /doorRules|door_rules/);
  assert.match(html, /const DOOR_APP_VERSION = 'v31-standard\.(6[5-9]|[7-9]\d)/);

  // The real publisher in the F1 publish box. The kitchen holds A; this computer added B; another computer commits C
  // while this one is publishing, so the first ref update is refused and the publish tries again.
  const { publishBox, initialRemote, ApplyingRemote } = await import('./helpers/door_publish_transaction_box.mjs');
  const rec = (word, by, at) => ({ list: 'menuName', word, target: 'hasShellfish', by, at });
  const kitchenA = { _meta: { version: 1, exported: T, site: 'rexdale' }, leads: [], additions: [rec('abalone', 'Fiona', '2026-11-04T10:00:00.000Z')], log: [] };
  const remote = new ApplyingRemote(initialRemote({ 'door_rules.json': kitchenA }));
  const pb = publishBox({ remote, storage: { concDoorRules: JSON.stringify({ additions: [rec('geoduck', 'Jason', '2026-11-04T11:00:00.000Z')], leads: [], log: [] }),
    concDoorRulesUnsent: JSON.stringify([{ key: 'menuName|geoduck', at: '2026-11-04T11:00:00.000Z' }]) } });
  vm.runInContext(rulesSource(), pb.c, { filename: 'index.html#d2a-rules', timeout: 5000 });
  remote.beforePatch = (r) => {
    const cur = r.files['door_rules.json'];
    r.externalUpdate({ 'door_rules.json': { ...cur, additions: cur.additions.concat([rec('cockle', 'Joan', '2026-11-04T11:30:00.000Z')]) } });
  };
  const result = await pb.publish();
  await pb.flush();
  assert.ok(result && result.ok, 'published: ' + JSON.stringify(result && (result.error ? String(result.error) : result)));
  const words = remote.files['door_rules.json'].additions.map(x => x.word).sort();
  assert.deepEqual(words, ['abalone', 'cockle', 'geoduck'], 'the retry re-read the kitchen copy and kept the other computer\'s word');
  assert.deepEqual(JSON.parse(pb.storage.concDoorRulesUnsent || '[]'), [], 'this computer\'s change counts as sent after the commit that carried it');
  assert.ok(!remote.requests.some(q => q.method === 'GET' && q.route === '/contents/door_rules.json' && !q.ref), 'no read outside the publish revision');
});

test('a publish never overwrites a kitchen copy it couldn\'t read, never marks sent before its commit, and never drops kitchen words (N2, N4: md, mg)', async () => {
  const { publishBox, initialRemote, ApplyingRemote } = await import('./helpers/door_publish_transaction_box.mjs');
  const rec = (word, by, at, extra) => Object.assign({ list: 'menuName', word, target: 'hasShellfish', by, at }, extra || {});
  const kitchen = { _meta: { version: 1, exported: '2026-11-04T10:00:00.000Z', site: 'rexdale' }, leads: [], additions: [rec('abalone', 'Fiona', '2026-11-04T10:00:00.000Z')], log: [] };
  const mine = { additions: [rec('geoduck', 'Jason', '2026-11-04T11:00:00.000Z')], leads: [], log: [] };
  const unsent = JSON.stringify([{ key: 'menuName|geoduck', at: '2026-11-04T11:00:00.000Z' }]);
  const run = async (setup, storage) => {
    const remote = new ApplyingRemote(initialRemote({ 'door_rules.json': kitchen }));
    const pb = publishBox({ remote, storage: Object.assign({ concDoorRules: JSON.stringify(mine), concDoorRulesUnsent: unsent }, storage || {}) });
    vm.runInContext(rulesSource(), pb.c, { filename: 'index.html#d2a-rules', timeout: 5000 });
    if (setup) setup(remote);
    const result = await pb.publish(); await pb.flush();
    return { remote, pb, result };
  };
  // md: the kitchen copy can't be read at the revision. Nothing of this computer's rules is staged, and the page says why.
  const md = await run(r => { r.failures.set('door_rules.json', '500'); });
  assert.deepEqual(md.remote.files['door_rules.json'], kitchen, 'the kitchen copy is untouched');
  assert.equal(JSON.parse(md.pb.storage.concDoorRulesKitchenState).reason, 'unreadable');
  assert.deepEqual(JSON.parse(md.pb.storage.concDoorRulesUnsent), JSON.parse(unsent), 'still not sent');
  // mg: every ref update is refused, so the publish fails. Nothing counts as sent.
  const mg = await run(r => { const again = (x) => { x.externalUpdate({ 'menu_overlay.json': { _meta: { standardCutover: 1 } } }); x.beforePatch = again; }; r.beforePatch = again; });
  assert.ok(!(mg.result && mg.result.ok), 'the publish failed');
  assert.deepEqual(JSON.parse(mg.pb.storage.concDoorRulesUnsent), JSON.parse(unsent), 'not marked sent before a commit landed');
  // a copy that would drop a kitchen word it didn't take back itself: refused, kitchen untouched
  const other = { additions: [rec('abalone', 'Joan', '2026-11-04T10:30:00.000Z', { takenBack: true })], leads: [], log: [] };
  const drop = await run(null, { concDoorRules: JSON.stringify(other), concDoorRulesUnsent: '[]' });
  assert.deepEqual(drop.remote.files['door_rules.json'], kitchen);
  assert.equal(JSON.parse(drop.pb.storage.concDoorRulesKitchenState).reason, 'drops');
  // the same take-back made on this computer goes out
  const own = await run(null, { concDoorRules: JSON.stringify(other), concDoorRulesUnsent: JSON.stringify([{ key: 'menuName|abalone', at: '2026-11-04T10:30:00.000Z' }]) });
  assert.equal(own.remote.files['door_rules.json'].additions.find(x => x.word === 'abalone').takenBack, true);
});

test('the dry run covers every meal, a lost plate refuses, and a restriction word says what it can\'t see (N3, N4: mt)', () => {
  const c = box();
  const menu = { '1': { MONDAY: { breakfast: 'Eggs', lunch: 'Soup', dinner: 'Stew' } } };
  c.getMenuData = () => menu;
  const seen = [];
  c.computePlatingData = (p) => { seen.push(p); const trial = !!vm.runInContext('_doorRulesTrial', c);
    const label = trial && p === 'breakfast' ? 'Regular' : 'Gluten Free';
    return { mealFlags: {}, anaphSect: [], sections: [{ rule: label === 'Regular' ? { key: 'regular' } : { key: 'gf', label }, residents: [{ room: 'T1' }] }] }; };
  const dry = plain(c.doorRulesDryRun('menuName', 'geoduck', 'hasShellfish'));
  assert.ok(['breakfast', 'lunch', 'dinner'].every(p => seen.includes(p)), 'breakfast, lunch and dinner are checked');
  assert.equal(dry.checked, 3);
  assert.deepEqual(dry.blocked, [{ meal: 'Wk1 MON breakfast', from: 'Gluten Free', to: 'Regular', n: 1 }], 'a breakfast move is caught');
  assert.equal(c.doorRulesSeatMoves({ m: { a: 'Gluten Free' } }, { m: {} }).blocked.length, 1, 'a seat before and none after refuses');
  assert.equal(c.doorRulesSeatMoves({ m: { a: 'Regular' } }, { m: {} }).blocked.length, 1, 'even from Regular');
  // restriction words: read as the import would; a record holding only DOOR\'s labels is counted as unseen
  const r = box(); r.getMenuData = () => ({ '1': { MONDAY: { lunch: 'Bread' } } });
  r.computePlatingData = () => ({ mealFlags: { hasGluten: true }, anaphSect: [], sections: [] });
  vm.runInContext("REGISTRY_LIST.push({ room: '901', tags: ['No Pork'], rawRestriction: 'No Pork, Celiac' }, { room: '902', tags: ['No Pork'], rawRestriction: 'No Pork' }, { room: '903', tags: [], rawRestriction: 'Regular' })", r);
  const rd = plain(r.doorRulesDryRun('restriction', 'celiac', 'glutenFree'));
  assert.equal(rd.checked, 1); assert.equal(rd.unseen, 2);
  assert.deepEqual(rd.moves.map(m => m.meal + ':' + m.from + '>' + m.to + ':' + m.n), ['Wk1 MON breakfast:Regular>Gluten Free:1', 'Wk1 MON dinner:Regular>Gluten Free:1', 'Wk1 MON lunch:Regular>Gluten Free:1']);
  assert.equal(rd.blocked.length, 0, 'Regular → Gluten Free is more protection');
  const add = fn('doorRulesAddWord');
  assert.match(add, /Not checked: ' \+ dry\.unseen/);
  assert.match(add, /Not checked: dishes added to the menu later/);
  assert.match(add, /Not checked: it is read at the next menu workbook import/);
  assert.doesNotMatch(add, /No resident’s plate changes on today’s menu and resident list/);
});

test('permission is asked again after every question, Undo checks it took, and the page says what is off (N4: mx, N6, N7, N8)', async () => {
  const mk = (opts) => {
    const els = {};
    const c = box(Object.assign({ operator: 'Fiona', auth: { getSavedToken: () => 'k', isViewingKey: () => false, isExpired: () => false } }, opts));
    c.document = { getElementById: (id) => (els[id] = els[id] || { innerHTML: '', textContent: '', value: '' }), querySelectorAll: () => [] };
    c.getMenuData = () => ({ '1': { MONDAY: { lunch: 'Geoduck Soup', lunch_flags: { hasShellfish: true } } } });
    return { c, els };
  };
  const leads = [{ name: 'Fiona', on: true, by: 'Jason', at: T }];
  // mx: the key is lost while the take-back question is open
  const { c } = mk(withAdds([{ list: 'menuName', word: 'geoduck', target: 'hasShellfish' }], leads));
  c.doorAsk = async () => { c.PublishAuth = { getSavedToken: () => '', isViewingKey: () => false, isExpired: () => false }; return true; };
  await c.doorRulesTakeBackWord('menuName', 'geoduck');
  assert.equal(c.doorRulesActive(c.loadDoorRules(), 'menuName').length, 1, 'not taken back without a sending key');
  // and the add question: the name leaves the leads list while it is open
  const m2 = mk(withAdds([], leads));
  m2.els['door-rules-word-menuName'] = { value: 'geoduck' }; m2.els['door-rules-target-menuName'] = { value: 'hasShellfish' };
  m2.c.computePlatingData = () => null;
  m2.c.doorAsk = async () => { m2.c.getOperatorName = () => 'Joan'; return true; };
  await m2.c.doorRulesAddWord('menuName');
  assert.equal(m2.c.doorRulesActive(m2.c.loadDoorRules(), 'menuName').length, 0, 'not added by a name off the list');
  // N6: a change pulled from the kitchen is not "not sent"
  const m3 = mk({});
  m3.c.doorApplyRemoteRules({ _meta: { version: 1 }, leads: [], log: [], additions: [{ list: 'menuName', word: 'geoduck', target: 'hasShellfish', by: 'Joan', at: T }] });
  assert.equal(m3.c.doorRulesNotSent(), false);
  m3.c.doorRulesNoteOwn('menuName|abalone', T2);
  assert.equal(m3.c.doorRulesNotSent(), true);
  // N7: the kitchen copy couldn\'t be read
  m3.c.doorRulesSetKitchenState({ reason: 'unreadable' });
  vm.runInContext('renderDoorRulesPage()', m3.c);
  assert.match(m3.els['door-rules-body'].innerHTML, /rules file can’t be read, so nothing from this computer is sent/);
  // N8: a compile error is shown, not swallowed
  const m4 = mk({});
  m4.c.console = { warn() {}, log() {} };
  m4.c.loadDoorRules = () => { throw new Error('boom'); };
  assert.deepEqual(plain(m4.c.doorRulesCompiledFor('menuName')), []);
  assert.equal(vm.runInContext('_doorRulesCompileError', m4.c), 'boom');
  assert.match(fn('renderDoorRulesPage'), /Added words are off on this computer/);
  // Undo of an add names the meals that stay marked, and checks it took
  const u = fn('doorRulesUndo');
  assert.match(u, /doorRulesTakeBackImpact\(u\.list, u\.word, u\.target\)\.meals/);
  assert.match(u, /doorRulesShowStillMarked\(/);
  assert.match(u, /if \(!took\)/);
  // third review P3-c: the kitchen-state line also shows where a publish result shows
  m3.c.doorRulesSetKitchenState({ reason: 'newer', version: 2 });
  assert.match(m3.c.doorRulesBlockedLine(), /weren’t sent: the kitchen’s rules file is from a newer DOOR/);
  m3.c.doorRulesSetKitchenState(null);
  assert.equal(m3.c.doorRulesBlockedLine(), '');
  assert.match(fn('doorDeliveryRender'), /doorRulesBlockedLine\(\)/);
  // third review P3-b: no dead "different dishes the same" refusal; the dish list stays
  assert.doesNotMatch(html, /would make different dishes the same/);
  assert.match(fn('doorRulesAddWord'), /will match these DOOR dishes/);
});

test('fourth review: carried records are counted on the page, the publish line is amber and true, the largest date never throws', () => {
  const els = {};
  const c = box({ operator: 'Jason', auth: { getSavedToken: () => 'k', isViewingKey: () => false, isExpired: () => false } });
  c.document = { getElementById: (id) => (els[id] = els[id] || { innerHTML: '', textContent: '', value: '' }), querySelectorAll: () => [] };
  // P3-1: one line counts every carried kind
  c.doorApplyRemoteRules({ _meta: { version: 1 }, log: [{ at: 'bad', by: 'J', what: 'x' }], leads: [{ name: 'Joan', on: true, by: 'Fiona', at: T }],
    additions: [{ list: 'menuName', word: 'cockle', target: 'hasShellfish', by: 'J', at: '2026-11-10T10:00:00Z' }, { list: 'plateRule', word: 'p', target: 'x', by: 'J', at: T }] });
  assert.equal(c.doorRulesCarriedCount(c.loadDoorRules()), 4);
  vm.runInContext('renderDoorRulesPage()', c);
  assert.match(els['door-rules-body'].innerHTML, /4 records this DOOR can’t read are kept as they are/);
  // P3-2: true wording with and without changes of its own; its own amber line beside the delivery status
  c.doorRulesSetKitchenState({ reason: 'unreadable' });
  assert.match(c.doorRulesBlockedLine(), /^The kitchen’s allergen-word file can’t be updated from this computer: /);
  c.doorRulesNoteOwn('menuName|geoduck', T);
  assert.match(c.doorRulesBlockedLine(), /^This computer’s 1 allergen-word change weren’t sent: /);
  const dr = fn('doorDeliveryRender');
  assert.match(dr, /status\.textContent=text;/, 'the delivery text stays as it is');
  assert.match(dr, /door-rules-publish-line/);
  // Re-pinned 2026-11-13 (readable themes, v31-standard.72): the amber ink is theme-aware, the light amber unchanged.
  assert.match(dr, /color:var\(--warn-ink, #92400e\)/);
  assert.doesNotMatch(dr, /status\.textContent=shown/);
  // P3-3: the largest date never throws; the tie rule decides, and the actions say when it did not take
  const MAX = '+275760-09-13T00:00:00.000Z';
  assert.equal(c.doorRulesNextAt(MAX), MAX);
  const atMax = { additions: [{ list: 'menuName', word: 'geoduck', target: 'hasShellfish', by: 'J', at: MAX }] };
  const back = c.doorRulesTakeBack(atMax, 'menuName', 'geoduck', 'Jason', c.doorRulesNextAt(MAX));
  assert.equal(c.doorRulesActive(back, 'menuName').length, 1, 'a tie keeps the word');
  assert.match(fn('doorRulesTakeBackWord'), /It did not take/);
  // the two sorts compare times, not text
  const late = '+010000-01-01T00:00:00.000Z';
  assert.equal(c.doorRulesLastChangeAt({ additions: [{ list: 'menuName', word: 'abalone', target: 'hasShellfish', by: 'J', at: late }, { list: 'menuName', word: 'geoduck', target: 'hasShellfish', by: 'J', at: T }] }), late);
  const lg = plain(c.doorRulesMerge({ log: [{ at: T, by: 'J', what: 'a' }] }, { log: [{ at: late, by: 'J', what: 'b' }] }).log);
  assert.equal(lg[0].at, late, 'newest first by time');
});

test('one dry run compiles the added words once, not once per trial (third review P3-e)', () => {
  const c = box(withAdds([{ list: 'restriction', word: 'coeliac', target: 'glutenFree' }]));
  c.getMenuData = () => ({ '1': { MONDAY: { lunch: 'Bread' } } });
  c.computePlatingData = () => ({ mealFlags: { hasGluten: true }, anaphSect: [], sections: [] });
  vm.runInContext("for (let i = 0; i < 40; i++) REGISTRY_LIST.push({ room: 'R' + i, tags: [], rawRestriction: 'No Pork, Celiac ' + i })", c);
  const real = c.loadDoorRules; let loads = 0;
  c.loadDoorRules = () => { loads++; return real(); };
  c.doorRulesCompiledFor('restriction');
  const before = loads;
  const dry = plain(c.doorRulesDryRun('restriction', 'celiac', 'glutenFree'));
  assert.equal(dry.checked, 40);
  assert.ok(loads - before <= 2, 'compiled ' + (loads - before) + ' times for 40 residents');
});
