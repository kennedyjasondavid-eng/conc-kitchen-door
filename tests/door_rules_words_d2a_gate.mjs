// tests/door_rules_words_d2a_gate.mjs — D2a: DOOR's allergen word lists, add-only, edited in the app by named leads
// (2026-11-10, v31-standard.64). Jason, 2026-11-10: "go ahead" with D2; who edits = a sending connection key AND a name
// on the leads list (only Jason changes that list); first slice = words, add-only; plate rules read-only.
// Runs the REAL readers (allergenStrToFlags, nameDetectFlags, doorApplyTextDetectedFlags, normalizeRestriction,
// doorRexTokens) in a vm with the door-rules core and shell beside them, on a made-up local store. No resident data:
// the restriction census uses made-up restriction words only. Authored to fail on da57f2a (no door-rules block).
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

// The readers, with or without the rules module (withRules false: the hooks find no helper, as on da57f2a).
function box(opts = {}) {
  const store = Object.assign({ concLearnedNR: '{}', concDismissedDiffs: '{}', concCustomTagRules: '[]' }, opts.store || {});
  const c = {
    console, REGISTRY_LIST: [], REGISTRY_MAP: {}, anaphRooms: [], changesQueue: [], IMPORT_STATE: null, MEAL: { lunch: 'lunch' },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    document: { getElementById: () => null, querySelectorAll: () => [] }, showToast() {}, escapeHtml: s => String(s), _escAttr: s => String(s),
    PublishAuth: opts.auth || { getSavedToken: () => '', isViewingKey: () => false, isExpired: () => false },
    getOperatorName: () => opts.operator || '', store,
  };
  vm.createContext(c);
  const parts = [
    bracedConst('TAG_LABELS_MAP'), fn('getRoomBase'), between('const FLAG_DEFS = [', '\n];') + '\n];',
    between('const DOOR_BRASSICA_RE', '\n') + '\n', fn('doorApplyTextDetectedFlags'),
    between('/* DOOR_TESTABLE_CORE_START menu-parse */', '/* DOOR_TESTABLE_CORE_END menu-parse */'),
    between('/* DOOR_TESTABLE_CORE_START rex-week */', '/* DOOR_TESTABLE_CORE_END rex-week */'),
    between('const IMPORT_TAG_RULES = [', '\nfunction handleImportFile('),
  ];
  if (opts.withRules !== false) parts.push(core(), shell());
  parts.push('this.api = { allergenStrToFlags, nameDetectFlags, doorApplyTextDetectedFlags, normalizeRestriction, doorRexTokens, emptyMealFlags };');
  vm.runInContext(parts.join('\n'), c, { filename: 'index.html#d2a', timeout: 10000 });
  return c;
}
const on = (f) => Object.keys(f).filter(k => f[k]).sort();
const T = '2026-11-10T12:00:00.000Z', T2 = '2026-11-10T13:00:00.000Z';
function withAdds(adds, leads) {
  return { store: { concDoorRules: JSON.stringify({ additions: adds.map(a => Object.assign({ by: 'Jason', at: T }, a)), leads: leads || [], log: [] }) } };
}
const ctxFor = (c, list) => ({ targets: vm.runInContext('doorRulesTargetsFor(' + JSON.stringify(list) + ')', c), builtIn: (l, w) => c.doorRulesBuiltIn(l, w) });

test('add-only rules: a built-in word, a duplicate, an unknown target and odd characters are refused', () => {
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
  assert.equal(chk('rexSpelling', 'lasagnia', 'nosuchword').code, 'target');
  assert.ok(chk('rexSpelling', 'lasagnia', 'caribbean').ok);
  // duplicate
  assert.equal(chk('menuName', 'Abalone', 'hasFish').code, 'added');
  // unknown targets: a new flag, a protection-reducing flag, a plate-choosing tag
  assert.equal(chk('menuName', 'geoduck', 'hasLupin').code, 'target');
  assert.equal(chk('menuName', 'geoduck', 'halalCertifiedMeat').code, 'target');
  assert.equal(chk('menuName', 'geoduck', 'isCarb').code, 'target');
  assert.equal(chk('restriction', 'celiac', 'halal').code, 'target');
  assert.equal(chk('restriction', 'celiac', 'vegan').code, 'target');
  assert.equal(chk('restriction', 'celiac', 'noBrandNew').code, 'target');
  // characters and length: no pattern from a person
  for (const w of ['sh.*mp', 'a|b', 'pine(nut)', 'x', 'nuts!', 'shrimp\\b', '1abc']) assert.ok(!chk('menuName', w, 'hasShellfish').ok, w);
  assert.equal(chk('rexSpelling', 'two words', 'caribbean').code, 'characters');
  // allowed
  const ok = chk('menuName', 'Geoduck', 'hasShellfish');
  assert.deepEqual([ok.ok, ok.word, ok.target], [true, 'geoduck', 'hasShellfish']);
  assert.ok(chk('restriction', 'celiac', 'glutenFree').ok);
  assert.ok(chk('workbookAllergen', 'pine nut', 'hasTreeNuts').ok);
});

test('an added word is read by each list\'s real reader, and only ever adds', () => {
  const c = box(withAdds([
    { list: 'menuName', word: 'geoduck', target: 'hasShellfish' },
    { list: 'workbookAllergen', word: 'pine nut', target: 'hasTreeNuts' },
    { list: 'restriction', word: 'celiac', target: 'glutenFree' },
    { list: 'rexSpelling', word: 'lasagnia', target: 'lasagna' },
  ]));
  const plain = box({ withRules: false });
  const a = c.api, p = plain.api;
  // menu dish names, at import and on the menu as read
  assert.ok(on(a.nameDetectFlags('Steamed Geoduck, Rice', a.emptyMealFlags())).includes('hasShellfish'));
  assert.ok(!on(p.nameDetectFlags('Steamed Geoduck, Rice', p.emptyMealFlags())).includes('hasShellfish'));
  const menu = { '1': { MONDAY: { lunch: 'Geoduck Chowder', lunch_flags: { ...a.emptyMealFlags(), hasDairy: true } } } };
  const read = a.doorApplyTextDetectedFlags(menu)['1'].MONDAY.lunch_flags;
  assert.deepEqual(on(read), ['hasDairy', 'hasShellfish'], 'the meal keeps its flags and gains the added one');
  assert.equal(menu['1'].MONDAY.lunch_flags.hasShellfish, false, 'the source is not mutated');
  assert.ok(!on(a.nameDetectFlags('Mungeoduckery', a.emptyMealFlags())).includes('hasShellfish'), 'whole words only');
  // workbook allergen rows
  assert.deepEqual(on(a.allergenStrToFlags('gluten, Pine Nut', a.emptyMealFlags())), ['hasGluten', 'hasTreeNuts']);
  assert.deepEqual(on(p.allergenStrToFlags('gluten, Pine Nut', p.emptyMealFlags())), ['hasGluten']);
  // resident restrictions: the tag is added, the word no longer asked about, built-in tags kept
  const r = a.normalizeRestriction('Halal / Celiac');
  assert.deepEqual(on(r.tags), ['glutenFree', 'halal']);
  assert.deepEqual([...r.unmatched], []);
  assert.deepEqual([...r.ambiguous], []);
  const was = p.normalizeRestriction('Halal / Celiac');
  assert.deepEqual(on(was.tags), ['halal']);
  assert.ok(was.unmatched.length > 0, 'without the word DOOR asks about it');
  assert.deepEqual(on(a.normalizeRestriction('No Pork, Celiac').tags), ['glutenFree', 'noPork']);
  // Rex spellings
  assert.deepEqual([...a.doorRexTokens('Beef Lasagnia')], ['beef', 'lasagna']);
  assert.deepEqual([...p.doorRexTokens('Beef Lasagnia')], ['beef', 'lasagnia']);
});

test('a take-back returns DOOR to its built-in words; a hand-written file cannot point a word at a reducing flag', () => {
  const c = box(withAdds([
    { list: 'menuName', word: 'geoduck', target: 'hasShellfish' },
    { list: 'menuName', word: 'halalish', target: 'halalCertifiedMeat' },
    { list: 'restriction', word: 'veganish', target: 'vegan' },
  ]));
  const a = c.api;
  assert.ok(!on(a.nameDetectFlags('Halalish Chicken', a.emptyMealFlags())).includes('halalCertifiedMeat'), 'not an allowed target: ignored');
  assert.deepEqual(on(a.normalizeRestriction('Veganish').tags), [], 'a plate-choosing tag is never added');
  const back = c.doorRulesTakeBack(c.loadDoorRules(), 'menuName', 'geoduck', 'Jason', T2);
  c.saveDoorRules(back);
  assert.ok(!on(a.nameDetectFlags('Geoduck Chowder', a.emptyMealFlags())).includes('hasShellfish'));
  assert.equal(back.log[0].what, 'took back');
  assert.equal(back.additions.find(x => x.word === 'geoduck').takenBack, true, 'a dated record, not a delete');
});

test('nothing changes with no additions: the published menu and made-up restrictions read the same', () => {
  const withMod = box(), without = box({ withRules: false });
  const menu = json('menu_current.json').menu;
  assert.deepEqual(JSON.parse(JSON.stringify(withMod.api.doorApplyTextDetectedFlags(menu))), JSON.parse(JSON.stringify(without.api.doorApplyTextDetectedFlags(menu))));
  let meals = 0;
  for (const wk of Object.keys(menu)) for (const day of Object.keys(menu[wk] || {})) for (const p of ['breakfast', 'lunch', 'dinner']) {
    const text = menu[wk][day][p];
    if (typeof text !== 'string') continue;
    meals++;
    assert.deepEqual(on(withMod.api.nameDetectFlags(text, withMod.api.emptyMealFlags())), on(without.api.nameDetectFlags(text, without.api.emptyMealFlags())), text);
    const al = menu[wk][day][p + '_allergens'] || text;
    assert.deepEqual(on(withMod.api.allergenStrToFlags(String(al), withMod.api.emptyMealFlags())), on(without.api.allergenStrToFlags(String(al), without.api.emptyMealFlags())));
    assert.deepEqual([...withMod.api.doorRexTokens(text)], [...without.api.doorRexTokens(text)]);
  }
  assert.ok(meals >= 80, 'the published menu was read: ' + meals);
  const madeUp = ['Regular', 'GF', 'Halal / No Sea Food', 'No Pork, Diabetic', 'Vegan', 'Lactose Intolerant', 'No Almond',
    'Soft Meals / No Spicy', 'Celiac', 'No Popcorn, Corn, Nuts, Coconuts', 'G/F, D/F', 'Allergic to Peanut', 'No Caulilower/ Tomatoes / Cucumber',
    'Low sodium', 'No Mushrooms', 'Bland diet', 'Prefers rice', 'No Beef or Red Meat', 'No Shellfish and Molluscs', 'Halal/GF'];
  for (const s of madeUp) assert.deepEqual(JSON.parse(JSON.stringify(withMod.api.normalizeRestriction(s))), JSON.parse(JSON.stringify(without.api.normalizeRestriction(s))), s);
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
  // a leads record made by anyone but Jason is not read
  const forged = c.doorRulesClean({ leads: [{ name: 'Joan', on: true, by: 'Fiona', at: T }] });
  assert.equal(forged.leads.length, 0);
  assert.equal(who(true, 'Joan', { leads: [{ name: 'Joan', on: true, by: 'Fiona', at: T }] }).canEdit, false);
  // taken off
  const off = c.doorRulesSetLead(leads, 'Fiona', false, 'Jason', T2);
  assert.equal(who(true, 'Fiona', off).canEdit, false);
  // the shell: a viewing or expired key is not a sending key
  const view = box({ operator: 'Jason', auth: { getSavedToken: () => 'k', isViewingKey: () => true, isExpired: () => false } });
  assert.equal(view.doorRulesWhoHere().canEdit, false);
  const send = box({ operator: 'Jason', auth: { getSavedToken: () => 'k', isViewingKey: () => false, isExpired: () => false } });
  assert.equal(send.doorRulesWhoHere().canEditLeads, true);
  // the page's actions ask the shell, never the DOM alone
  for (const f of ['doorRulesAddWord', 'doorRulesTakeBackWord', 'doorRulesUndo']) assert.match(fn(f), /doorRulesWhoHere\(\)/, f);
  for (const f of ['doorRulesAddLead', 'doorRulesRemoveLead']) assert.match(fn(f), /canEditLeads/, f);
  assert.match(fn('doorRulesAddWord'), /doorAsk\(/, 'asks before adding');
});

test('two computers merge per word and per lead, newest wins; a take-back travels as a record', () => {
  const c = box();
  const A = c.doorRulesAdd({}, { list: 'menuName', word: 'geoduck', target: 'hasShellfish', by: 'Fiona', at: T });
  const B0 = c.doorRulesAdd({}, { list: 'workbookAllergen', word: 'pine nut', target: 'hasTreeNuts', by: 'Jason', at: T });
  const B = c.doorRulesTakeBack(c.doorRulesMerge(B0, A), 'menuName', 'geoduck', 'Jason', T2);
  const ab = c.doorRulesMerge(A, B), ba = c.doorRulesMerge(B, A);
  assert.deepEqual(JSON.parse(JSON.stringify(ab)), JSON.parse(JSON.stringify(ba)), 'order does not matter');
  assert.deepEqual([...c.doorRulesActive(ab, 'menuName').map(r => r.word)], [], 'the newer take-back wins');
  assert.deepEqual([...c.doorRulesActive(ab, 'workbookAllergen').map(r => r.word)], ['pine nut']);
  // an older copy cannot bring the word back
  assert.equal(c.doorRulesActive(c.doorRulesMerge(ab, A), 'menuName').length, 0);
  // re-added later wins again
  const again = c.doorRulesAdd(ab, { list: 'menuName', word: 'geoduck', target: 'hasShellfish', by: 'Fiona', at: '2026-11-10T14:00:00.000Z' });
  assert.equal(c.doorRulesActive(c.doorRulesMerge(B, again), 'menuName').length, 1);
  // a tie keeps the word (it only adds a warning)
  const tie = c.doorRulesMerge({ additions: [{ list: 'menuName', word: 'geoduck', target: 'hasShellfish', by: 'J', at: T, takenBack: true }] },
    { additions: [{ list: 'menuName', word: 'geoduck', target: 'hasShellfish', by: 'J', at: T }] });
  assert.equal(c.doorRulesActive(tie, 'menuName').length, 1);
  // leads: newest wins
  const L = c.doorRulesMerge(c.doorRulesSetLead({}, 'Fiona', true, 'Jason', T), c.doorRulesSetLead({}, 'Fiona', false, 'Jason', T2));
  assert.equal(c.doorRulesIsLead(L, 'Fiona'), false);
  // the log is the union, newest first
  assert.ok(ab.log.length >= 3 && ab.log[0].at >= ab.log[ab.log.length - 1].at);
  // the shell merge saves this computer's copy
  const s = box();
  s.doorApplyRemoteRules(c.doorRulesFile(ab, 'rexdale'));
  assert.deepEqual([...s.doorRulesActive(s.loadDoorRules(), 'workbookAllergen').map(r => r.word)], ['pine nut']);
  // the published file: its stamp is the newest change, so an unchanged file reads unchanged
  const f = c.doorRulesFile(ab, 'rexdale');
  assert.deepEqual([f._meta.version, f._meta.site, f._meta.exported], [1, 'rexdale', T2]);
  assert.equal(JSON.stringify(c.doorRulesFile(c.doorRulesMerge(ba, {}), 'rexdale')), JSON.stringify(f));
});

test('door_rules.json is a kitchen file shared at Publish; EXPO and HUB files are untouched', () => {
  const kitchen = between('const DOOR_KITCHEN_FILES = Object.freeze([', ']);');
  const pub = between('const DOOR_PUBLIC_FEEDS = Object.freeze([', ']);');
  assert.match(kitchen, /'door_rules\.json'/);
  assert.doesNotMatch(pub, /door_rules/);
  const pages = fs.readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  for (const line of pages.split('\n')) if (/^\s*-\s*'/.test(line)) assert.doesNotMatch(line, /door_rules/, 'never served on Pages');
  // read at boot and at each sync, merged before a send, staged with the publish, its "sent" noted on success
  assert.match(html, /\['door_rules\.json',\s+d => doorApplyRemoteRules\(d\)\]/);
  assert.match(html, /read\('door_rules\.json'\)\.then\(d=>\{ if\(d\) doorApplyRemoteRules\(d\); \}\)/);
  const publish = fn('_doPublishToGitHub');
  assert.ok(publish.indexOf('await doorPullRules()') > 0 && publish.indexOf('await doorPullRules()') < publish.indexOf("_push('menu_current.json'"), 'pulled before the menu is built');
  assert.match(publish, /_push\(DOOR_RULES_FILE, JSON\.stringify\(doorRulesFile\(/);
  assert.match(publish, /doorRulesNoteSent\(_rulesSentAt\)/);
  // not a stamped file and not read by EXPO's or HUB's files
  assert.doesNotMatch(fn('doorFlowStampCandidate'), /door_rules/);
  assert.doesNotMatch(fn('buildMenuJSON') + fn('buildRoutingByMealJSON'), /doorRules|door_rules/);
  // the page: Settings card, read-only plate rules from the tables themselves, escaped strings
  assert.match(html, /id="door-rules-body"/);
  assert.match(fn('loadSettings'), /renderDoorRulesPage\(\)/);
  assert.match(fn('doorRulesPlateRulesHTML'), /ROUTING_RULES/);
  assert.match(fn('doorRulesPlateRulesHTML'), /CONFLICT_MAP/);
  assert.match(fn('renderDoorRulesPage'), /escapeHtml\(r\.word\)/);
  assert.match(fn('renderDoorRulesPage'), /escapeHtml\(r\.by\)/);
  assert.match(fn('renderDoorRulesPage'), /Not sent yet/);
  assert.match(html, /const DOOR_APP_VERSION = 'v31-standard\.(6[4-9]|[7-9]\d)/);
});
