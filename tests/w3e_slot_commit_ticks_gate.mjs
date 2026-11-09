// W3e, 2026-11-09 (Jason, Wk3 SUN dinner, live data: change_log.json and the publish commits 9398c5a, 8233546, fbede23).
// Each check names the kitchen failure it prevents:
//  1. picking "Bolognese Sauce" from the list after typing "Bolo" saved the main as the typed text "Bolo", unlinked,
//     with the recipe's ticks on it. The pick redraws the cards; the browser blurs the old box on its way out, and its
//     blur saved the half-typed words over the pick (reproduced in Chromium; tests/browser/w3e_slot_pick.mjs);
//  2. half-typed words that are the start of a recipe the list offered were saved as the dish, silently;
//  3. typing a new dish name in the top box of a linked slot did nothing visible: the name the menu prints lives in
//     "Shown on menu as", which nothing pointed to, and a blur quietly unlinked the recipe;
//  4. Save went ahead with words a box held that were not saved, without a word;
//  5. linking the main to the recipe took Gluten, Beef and Carb-swap off the meal (the Gluten Free and Halal plates
//     vanished from routing_by_meal.json) and the "Take off the old dish's warnings?" question never named them;
//  6. a linked dish named "...Beans" never got its Beans tick: the W3a regex held two literal backspace bytes.
// Every name in it is a dish; no resident.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const raw = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const html = raw.replace(/\r\n?/g, '\n');
function fnBlock(name) {
  const m = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(html);
  assert.ok(m, 'missing function ' + name);
  let d = 0, i = html.indexOf('{', m.index);
  for (; i < html.length; i++) { if (html[i] === '{') d++; else if (html[i] === '}' && --d === 0) break; }
  return html.slice(m.index, i + 1);
}
const optBlock = (name) => (new RegExp('function\\s+' + name + '\\s*\\(').test(html) ? fnBlock(name) : '');
// the top-level `let` lines W3e adds (absent on main, where the gate must still run and fail on behaviour)
const W3E_STATE = ['_slotRenderDepth', 'SLOT_OFFERED', 'SLOT_HELD']
  .map((n) => (html.match(new RegExp('^let ' + n + ' = [^;]*;', 'm')) || [''])[0]).join('\n');
const out = (v) => JSON.parse(JSON.stringify(v));

const BOLO_SAUCE = { recipeName: 'Bolognese Sauce', category: 'stew_main', stream: 'regular', allergens: ['Nightshades (tomato)'], recipeId: 'bolognese-sauce' };
const WK3_SUN_MAIN = { manual: 'Bolognese Pasta', flags: { hasGluten: true, hasBeef: true, isCarb: true, hasNightshades: true } };

// The slot editor as the page runs it: the real renderSlots, slotSelect, slotAutoSave (and W3e helpers), with a panel
// whose redraw blurs the box that was focused, as Chromium does when a focused element leaves the page.
function editor({ main = WK3_SUN_MAIN, box = 'Bolo' } = {}) {
  const c = {
    console, MEAL_SLOT_DEFS: [{ id: 'main', label: 'Main', cats: ['stew_main'], streams: ['regular', ''] }],
    MEAL_SLOT_STATE: { main: out(main) }, DOOR_RECIPE_DATA: [BOLO_SAUCE], testMealActive: false,
    recipeMatchesSlotDef: () => true, renderSlotCard: () => '', renderAltMealsSection() {}, updateSlotSummary() {},
    _escAttr: (v) => String(v), doorLinkFlags: () => ({ hasNightshades: true }),
    focusedBox: box == null ? null : { value: box }, blurs: 0,
  };
  const panel = {};
  Object.defineProperty(panel, 'innerHTML', {
    set() {   // the old box leaves the page: the browser blurs it, and its onblur runs slotAutoSave with what it held
      if (!c.focusedBox) return;
      const b = c.focusedBox; c.focusedBox = null; c.blurs++;
      vm.runInContext('slotAutoSave("main", ' + JSON.stringify(b.value) + ')', c);
    },
  });
  c.document = { getElementById: (id) => (id === 'mc-slot-panel' ? panel : null) };
  vm.createContext(c);
  vm.runInContext([W3E_STATE, fnBlock('isHubLoaded'), fnBlock('renderSlots'), fnBlock('slotSelect'), fnBlock('slotAutoSave'),
    fnBlock('slotKey'), optBlock('doorSlotIsRename'), optBlock('doorSlotHoldTyped'), optBlock('slotRenameShown')].join('\n\n'), c);
  return c;
}

test('1. a recipe picked from the list stays picked when the redraw blurs the half-typed box', () => {
  const c = editor();
  vm.runInContext('slotSelect("main", "Bolognese Sauce")', c);
  assert.equal(c.blurs, 1, 'the redraw blurred the old box (the browser behaviour this guards)');
  const s = out(c.MEAL_SLOT_STATE.main);
  assert.equal(s.manual, undefined, 'not saved as the typed text "Bolo"');
  assert.equal(s.recipeName, 'Bolognese Sauce', 'linked to the recipe picked');
  assert.equal(s.recipeId, 'bolognese-sauce');
  assert.equal(s.displayText, 'Bolognese Pasta', 'W3c: the menu words stay');
  assert.match(fnBlock('smSlotAutoSave'), /_slotRenderDepth > 0\) return;/, 'Special Meal: a redraw blur is not a commit');
  assert.match(fnBlock('renderSmSlots'), /_slotRenderDepth\+\+[\s\S]{0,200}finally \{ _slotRenderDepth--; \}/);
});

function setOffered(c, names) { vm.runInContext('SLOT_OFFERED.main = ' + JSON.stringify(names), c); }
test('2. half-typed words that start an offered recipe are not saved as the dish; Enter keeps them as typed', () => {
  const c = editor({ box: null });
  c.focusedBox = null;
  assert.equal(vm.runInContext('typeof SLOT_HELD', c), 'object', 'Edit Menu keeps the words a box holds apart (SLOT_HELD)');
  setOffered(c, ['Bolognese Sauce']);
  vm.runInContext('slotAutoSave("main", "Bolo")', c);
  assert.deepEqual(out(c.MEAL_SLOT_STATE.main), out(WK3_SUN_MAIN), 'the last saved value stays');
  assert.deepEqual(out(vm.runInContext('SLOT_HELD.main', c)), { kind: 'half', typed: 'Bolo', recipe: 'Bolognese Sauce' });
  vm.runInContext('slotAutoSave("main", "Bolo", "enter")', c);
  assert.equal(c.MEAL_SLOT_STATE.main.manual, 'Bolo', 'Enter: the words as typed');
  assert.equal(vm.runInContext('SLOT_HELD.main', c), undefined);
  assert.match(fnBlock('slotKey'), /slotAutoSave\(slotId, inp\.value\.trim\(\), 'enter'\)/, 'Enter passes "enter"');
  // words that start no offered recipe are saved as before (menu_field_freetext_gate)
  vm.runInContext('slotAutoSave("main", "Vegan Nacho Mix")', c);
  assert.equal(c.MEAL_SLOT_STATE.main.manual, 'Vegan Nacho Mix');
  // the start of the linked recipe itself is held too, with or without an offered list
  const d = editor({ main: { recipeName: 'Bolognese Sauce', flags: {} }, box: null });
  vm.runInContext('slotAutoSave("main", "Bolognese S")', d);
  assert.equal(d.MEAL_SLOT_STATE.main.recipeName, 'Bolognese Sauce');
  assert.equal(vm.runInContext('SLOT_HELD.main.kind', d), 'half');
});

test('3. new words over a linked recipe point to "Shown on menu as" and never unlink it on a blur', () => {
  const c = editor({ main: { recipeName: 'Bolognese Sauce', recipeId: 'bolognese-sauce', flags: { hasNightshades: true } }, box: null });
  vm.runInContext('slotAutoSave("main", "Beef Bolognese")', c);
  assert.equal(c.MEAL_SLOT_STATE.main.recipeName, 'Bolognese Sauce', 'still linked');
  assert.deepEqual(out(vm.runInContext('SLOT_HELD.main', c)), { kind: 'rename', typed: 'Beef Bolognese', recipe: 'Bolognese Sauce' });
  vm.runInContext('slotRenameShown("main", "Beef Bolognese")', c);
  assert.equal(c.MEAL_SLOT_STATE.main.displayText, 'Beef Bolognese', 'the menu prints the new words');
  assert.equal(c.MEAL_SLOT_STATE.main.recipeId, 'bolognese-sauce', 'the recipe and its allergens stay');
  assert.equal(vm.runInContext('SLOT_HELD.main', c), undefined);
  // the box showing the shown name is no change
  vm.runInContext('slotAutoSave("main", "beef bolognese")', c);
  assert.equal(vm.runInContext('SLOT_HELD.main', c), undefined);
  // the list says it while typing, first, and the row is allowed as an inline handler
  const search = fnBlock('slotSearch');
  assert.match(search, /doorSlotIsRename\(query, cur\)/);
  assert.match(search, /Renaming the dish\? Show “\$\{escapeHtml\(String\(query\)\.trim\(\)\)\}” on the menu \(“Shown on menu as”\)/);
  assert.match(search, /dd\.innerHTML = renameRow \+/, 'the rename row comes first');
  assert.match(search, /SLOT_OFFERED\[slotId\] = results\.map/, 'the list remembers what it offered');
  assert.match(html, /DOOR_INLINE_HANDLER_ALLOWLIST = \{[\s\S]*?slotRenameShown: true/);
});

test('4. the card says what was not saved and why; Save asks about it, and going back saves nothing', () => {
  const c = { DOOR_INLINE_HANDLER_ALLOWLIST: { slotSelect: true, slotRenameShown: true } };
  vm.createContext(c);   // the page own escapers: escapeHtml for text, _escJsAttrCall for the inline handlers
  vm.runInContext([fnBlock('doorText'), fnBlock('escapeHtml'), fnBlock('_escAttr'), fnBlock('_jsStringLiteral'), fnBlock('_jsArgLiteral'), fnBlock('_escJsAttrCall'),
    fnBlock('doorSlotHeldNoteHTML'), 'this.f = doorSlotHeldNoteHTML;'].join('\n'), c);
  const half = c.f('main', { kind: 'half', typed: 'Bolo', recipe: 'Bolognese Sauce' }, WK3_SUN_MAIN);
  assert.match(half, /“Bolo” is not saved: it is the start of “Bolognese Sauce”\. Still saved: “Bolognese Pasta”\./);
  assert.match(half, /Link “Bolognese Sauce”/);
  assert.match(half, /press Enter in the box to keep your words as typed/);
  const ren = c.f('main', { kind: 'rename', typed: '<b>Beef</b>', recipe: 'Bolognese Sauce' }, { recipeName: 'Bolognese Sauce' });
  assert.match(ren, /use “Shown on menu as” below/);
  assert.ok(!ren.includes('<b>Beef'), 'escaped');
  const card = fnBlock('renderSlotCard');
  assert.match(card, /const currentVal = heldTyped \? heldTyped\.typed :/, 'the box keeps the words');
  assert.match(card, /heldTyped \? doorSlotHeldNoteHTML\(def\.id, heldTyped, state\)/);

  const save = fnBlock('saveMenuEdit');
  const at = save.indexOf('for (const id of Object.keys(SLOT_HELD))');
  assert.ok(at > save.indexOf('_commitLiveSlotInputs()') && at < save.indexOf('buildMealName()'), 'asked after the commit, before the name is read');
  assert.match(save.slice(at, at + 600), /await doorAsk\(ask\);\s*if \(mcMenuEditKey !== _heldKey\) return;\s*if \(!ans\) return;/);
  const q = { MEAL_SLOT_DEFS: [{ id: 'main', label: 'Main' }] };
  vm.createContext(q);
  vm.runInContext(fnBlock('doorSlotHeldQuestion') + '\nthis.f = doorSlotHeldQuestion;', q);
  const qh = out(q.f('main', { kind: 'half', typed: 'Bolo', recipe: 'Bolognese Sauce' }));
  assert.equal(qh.cancelLabel, 'Go back');
  assert.equal(qh.goLabel, 'Link “Bolognese Sauce”');
  assert.match(qh.lines[0], /The Main box says “Bolo”, the start of “Bolognese Sauce”/);
  assert.equal(out(q.f('main', { kind: 'rename', typed: 'Beef Bolognese', recipe: 'Bolognese Sauce' })).goLabel, 'Show “Beef Bolognese” on the menu');
});

function carried(saved, slotMain, flags, slotFlags, detected) {
  const c = { getMenuData: () => ({ '3': { SUNDAY: saved } }), MEAL_SLOT_STATE: { main: slotMain } };
  vm.createContext(c);
  vm.runInContext(fnBlock('doorCarriedTicks') + '\nthis.f = doorCarriedTicks;', c);
  return out(c.f('3-SUNDAY-dinner', flags, slotFlags, detected));
}
const ticksQ = (r, ticks) => {
  const c = { FLAG_DEFS: [{ key: 'hasGluten', label: 'Gluten' }, { key: 'hasBeef', label: 'Beef' }, { key: 'isCarb', label: 'Carb-swap' }, { key: 'hasPork', label: 'Pork' }] };
  vm.createContext(c);
  vm.runInContext(fnBlock('doorTicksQuestion') + '\nthis.f = doorTicksQuestion;', c);
  return out(c.f(r, ticks));
};
test('5. linking the main names every warning Save would take off, and keeps them by default for the same dish', () => {
  const saved = { dinner: 'Bolognese Pasta, Peas & Carrots', dinner_mainItem: 'Bolognese Pasta',
    dinner_flags: { hasGluten: true, hasBeef: true, isCarb: true, hasNightshades: true },
    dinner_slots: { main: { manual: 'Bolognese Pasta', flags: { hasGluten: true, hasBeef: true, isCarb: true, hasNightshades: true } } } };
  const linked = { recipeName: 'Bolognese Sauce', displayText: 'Bolognese Pasta', flags: { hasNightshades: true } };
  // the linked slot ticks only Nightshades and the meal boxes followed it: Save would take off Gluten, Beef, Carb-swap
  const r = carried(saved, linked, { hasNightshades: true }, { hasNightshades: true }, []);
  assert.deepEqual(r.dropped, ['hasBeef', 'hasGluten', 'isCarb'], 'the same words, newly linked: still asked');
  assert.equal(r.sameDish, true);
  const q = ticksQ(r, r.dropped);
  assert.deepEqual(q.items, ['Beef', 'Gluten', 'Carb-swap'], 'each warning named');
  assert.equal(q.goLabel, 'Keep them', 'the same dish: Keep them is the default');
  assert.equal(q.cancelLabel, 'Go back');
  // the half-typed and the renamed forms read as the same dish too
  assert.equal(carried(saved, { recipeName: 'Bolognese Sauce', flags: {} }, {}, {}, []).sameDish, true);
  assert.equal(carried(saved, { recipeName: 'Bolognese Sauce', displayText: 'Beef Bolognese', flags: {} }, {}, {}, []).sameDish, true);
  // a different dish keeps W3a: take them off is the default, each named
  const ham = { lunch: 'Glazed Ham', dinner: 'Glazed Ham', dinner_flags: { hasPork: true, hasGluten: true }, dinner_slots: { main: { manual: 'Glazed Ham' } } };
  const t = carried(ham, { recipeName: 'Ginger Tofu', flags: {} }, { hasPork: true }, {}, []);
  assert.equal(t.sameDish, false);
  assert.deepEqual(t.list, ['hasPork']);
  assert.deepEqual(t.dropped, ['hasGluten']);
  const tq = ticksQ(t, ['hasGluten', 'hasPork']);
  assert.equal(tq.goLabel, 'Take them off');
  assert.deepEqual(tq.items, ['Gluten', 'Pork']);
  // nothing changed: nothing asked
  assert.deepEqual(carried(saved, { manual: 'bolognese pasta', flags: {} }, {}, {}, []).dropped, []);
  // Save asks about both kinds, and maps the answer the right way round
  const save = fnBlock('saveMenuEdit');
  assert.match(save, /const _offTicks = \[\.\.\.new Set\(\[\.\.\._carried\.list, \.\.\.\(_carried\.dropped \|\| \[\]\)\]\)\]/);
  assert.match(save, /if \(!ans\) return;\s*const takeOff = _carried\.sameDish \? ans === 'alt' : ans === true;\s*_offTicks\.forEach\(k => \{ flags\[k\] = !takeOff; \}\);/);
});

test('6. no control characters in the page; a linked "...Beans" dish gets its Beans tick', () => {
  const bad = [...raw.matchAll(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g)].map((m) => html.slice(0, m.index).split('\n').length);
  assert.deepEqual(bad, [], 'control characters on lines ' + bad.join(', '));
  const c = { hubAllergenToFlags: () => ({}) };
  vm.createContext(c);
  vm.runInContext("const DOOR_NON_CODEX_TICKS = ['hasMushroom', 'hasBeans'];\n" + fnBlock('doorLinkFlags') + '\nthis.f = doorLinkFlags;', c);
  assert.equal(c.f({ recipeName: 'Refried Beans', allergens: [] }, null).hasBeans, true);
  assert.notEqual(c.f({ recipeName: 'Garlic Green Beans', allergens: [] }, null).hasBeans, true, 'green beans are not Beans');
});
