// D1 — a meal still read from its menu TEXT says so in the editor.
//
// DOOR only writes a per-meal `<period>_slots` snapshot when the meal is re-saved through
// the Edit Menu editor. A 2026-09-14 census found 25 of 56 lunch/dinner slots have never
// been re-saved since the workbook import, so they carry NO `_slots` at all and their
// dishes are re-parsed from the menu text on every open. EXPO now reads identity
// structure-first from `_slots` and is inert when it is absent, so the operator needs to
// SEE which meals are in that state in order to bind them.
//
// This gate proves the marker is display-only: it renders once per MEAL in the editor
// header, never on a slot card, never in the Special Meal editor, and never anywhere
// near what gets saved or published.
//
// Authored-to-fail against pre-slice origin/main: `doorLegacySlotNoticeHTML` does not
// exist, `openMenuEdit` sets no flag and writes no notice.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const MARKER = 'save to link';

function fnBlock(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'could not find function ' + name);
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return html.slice(start, i);
}

// Build a vm context running the REAL openMenuEdit + _restoreSlotSnapshot + the notice
// helper, with every other collaborator stubbed and a scriptable DOM that records writes.
function ctx(dayData) {
  const els = {};
  const el = (id) => (els[id] || (els[id] = { id, textContent: '', innerHTML: '', style: {} }));
  const c = {
    console: { warn() {}, error() {} },
    window: {},
    document: { getElementById: (id) => el(id) },
    setTimeout() {},
    _els: els,
    _mcSlotsBlockPresent: undefined,
    mcMenuEditKey: null,
    testMealActive: false,
    closeTestMeal() {},
    MEAL_SLOT_STATE: {},
    MEAL_SLOT_DEFS: [{ id: 'main' }, { id: 'starch' }, { id: 'vegside' }],
    ALT_MEALS: [], ALT_MEALS_NONE: false,
    ALT_FLAGS_EXPANDED: { clear() {} },
    _noPorkAltVisible: false,
    _LAST_SLOT_FLAGS: {},
    DOOR_RECIPE_DATA: [],
    isHubLoaded: () => false,
    getMenuData: () => ({ '1': { MONDAY: dayData } }),
    getMenuEdit: () => null,
    initSlotState() { c.MEAL_SLOT_STATE = {}; },
    parseMealNameIntoSlots(name) { c.MEAL_SLOT_STATE.main = { manual: name }; },
    splitVegAltIntoSlots() {},
    hubAllergenToFlags: () => ({}),
    renderEditFlagGrid() {},
    renderSlots() {},
    updateSlotSummary() {},
  };
  vm.createContext(c);
  vm.runInContext([
    fnBlock('_restoreSlotSnapshot'),
    fnBlock('doorLegacySlotNoticeHTML'),
    fnBlock('openMenuEdit'),
  ].join('\n\n'), c, { filename: 'index.html#d1', timeout: 1000 });
  return c;
}

// A meal that HAS been re-saved through the editor: it carries a `_slots` block.
const BOUND_DAY = {
  lunch: 'Pork Al Pastor, Rice',
  lunch_slots: { main: { recipeName: 'Pork Al Pastor', flags: {} }, starch: { manual: 'Rice', flags: {} } },
};
// A LEGACY meal: imported from the workbook, never re-saved, so no `_slots` at all.
const LEGACY_DAY = { lunch: 'Pork Al Pastor, Rice' };

// ── the flag tracks the real branch openMenuEdit took ────────────────────────────────────
test('a meal WITH a slots snapshot sets the flag true and shows no marker', () => {
  const c = ctx(BOUND_DAY);
  c.openMenuEdit(1, 'MONDAY', 'lunch');
  assert.equal(c._mcSlotsBlockPresent, true, 'the snapshot restored, so the meal is linked');
  assert.equal(c.doorLegacySlotNoticeHTML(true), '', 'a linked meal renders no notice');
  assert.equal(c._els['mc-menu-edit-legacy'].innerHTML, '', 'the header notice slot is cleared');
});

test('a LEGACY meal (no slots block, parsed from text) sets the flag false and says so', () => {
  const c = ctx(LEGACY_DAY);
  c.openMenuEdit(1, 'MONDAY', 'lunch');
  assert.equal(c._mcSlotsBlockPresent, false, 'no snapshot — the dishes came from the menu text');
  const notice = c._els['mc-menu-edit-legacy'].innerHTML;
  assert.ok(notice.includes(MARKER), 'the header carries the legacy marker: ' + JSON.stringify(notice));
  assert.ok(/menu text/i.test(notice), 'the marker is in kitchen words (names the menu text)');
  assert.ok(!/_slots|snapshot/i.test(notice), 'no schema jargon in operator copy');
});

test('an empty slots block is legacy too (it restores nothing)', () => {
  const c = ctx({ lunch: 'Pork Al Pastor, Rice', lunch_slots: {} });
  c.openMenuEdit(1, 'MONDAY', 'lunch');
  assert.equal(c._mcSlotsBlockPresent, false, '_restoreSlotSnapshot returns false on an empty block');
  assert.ok(c._els['mc-menu-edit-legacy'].innerHTML.includes(MARKER));
});

test('the flag never leaks from a legacy meal into the next, linked meal', () => {
  const c = ctx(LEGACY_DAY);
  c.openMenuEdit(1, 'MONDAY', 'lunch');
  assert.equal(c._mcSlotsBlockPresent, false);
  // Re-open a linked meal in the same session.
  c.getMenuData = () => ({ '1': { MONDAY: BOUND_DAY } });
  c.openMenuEdit(1, 'MONDAY', 'lunch');
  assert.equal(c._mcSlotsBlockPresent, true, 'a stale value from the previous meal does not persist');
  assert.equal(c._els['mc-menu-edit-legacy'].innerHTML, '', 'and the marker is cleared');
});

test('the notice helper is a pure function of the one fact', () => {
  const c = ctx(BOUND_DAY);
  assert.equal(c.doorLegacySlotNoticeHTML(true), '');
  assert.ok(c.doorLegacySlotNoticeHTML(false).includes(MARKER));
  assert.equal(c.doorLegacySlotNoticeHTML(undefined).includes(MARKER), true, 'unknown reads as legacy, not as linked');
});

// ── the marker is meal-level: never on a slot card, never in the Special Meal editor ──────
test('renderSlotCard never renders the marker in either namespace', () => {
  const card = fnBlock('renderSlotCard');
  assert.ok(!card.includes(MARKER), 'slot cards stay per-slot; the legacy fact is per-meal');
  assert.ok(!/_mcSlotsBlockPresent/.test(card), 'renderSlotCard does not read the meal-level flag');
  const renderSlots = fnBlock('renderSlots');
  assert.ok(!renderSlots.includes(MARKER), 'the slot panel does not repeat the marker per card');
});

test('the Special Meal editor never sets or shows the marker', () => {
  for (const fn of ['openSpecialMealPanel', 'renderSmSlots']) {
    assert.ok(!fnBlock(fn).includes(MARKER), fn + ': Special Meals are authored here, never legacy text rows');
    assert.ok(!/_mcSlotsBlockPresent/.test(fnBlock(fn)), fn + ' does not touch the Edit Menu flag');
  }
});

// ── display-only: nothing saved, nothing published ───────────────────────────────────────
test('the marker never reaches what is saved or published', () => {
  for (const fn of ['_buildSlotSnapshot', 'saveMenuEdit', 'saveMenuEdits', 'buildMenuJSON']) {
    assert.ok(!fnBlock(fn).includes(MARKER), fn + ' carries no marker text');
    assert.ok(!/_mcSlotsBlockPresent/.test(fnBlock(fn)), fn + ' does not read the display flag');
  }
});

test('source: the notice is written to the header container only, and openMenuEdit owns the flag', () => {
  const open = fnBlock('openMenuEdit');
  assert.ok(/_mcSlotsBlockPresent\s*=\s*false/.test(open), 'the flag is reset before the branch');
  assert.ok(/_mcSlotsBlockPresent\s*=\s*true/.test(open), 'and set true only when the snapshot restored');
  assert.ok(open.includes('mc-menu-edit-legacy'), 'the notice goes to the header container');
  assert.ok(open.includes('doorLegacySlotNoticeHTML'), 'via the pure helper');
  assert.ok(/let _mcSlotsBlockPresent/.test(html), 'the flag is module state, declared once');
});
