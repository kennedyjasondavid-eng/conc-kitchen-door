// Menu-edit fields never force a close CODEX match.
// A partial/similar recipe match is NOT auto-adopted on Enter or on blur — the operator's
// exact typed text is kept (linked to a recipe only on an EXACT name match, else free manual).
// Extracts the REAL slot functions from index.html and runs them in a vm.
// Authored-to-fail: pre-slice, slotKey/smSlotKey click the top dropdown row (forcing the
// match) and slot(Sm)AutoSave return early — discarding the typed text — while the dropdown
// is open. Every behavioral assertion below fails against the pre-slice source.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

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

// Build a vm context with the real slot commit functions + a scriptable DOM.
function ctx(opts = {}) {
  const dd = { style: { display: opts.ddVisible ? 'block' : 'none' }, _row: opts.row || null };
  dd.querySelector = () => dd._row;
  const inp = { value: opts.inputValue != null ? opts.inputValue : '' };
  const c = {
    console: { warn() {}, error() {} },
    window: {},
    document: {
      getElementById(id) {
        if (id === 'slot-dd-main' || id === 'sm-slot-dd-main') return dd;
        if (id === 'slot-search-main' || id === 'sm-slot-search-main') return inp;
        return null;
      },
    },
    MEAL_SLOT_STATE: {},
    SM_SLOT_STATE: {},
    MEAL_SLOT_DEFS: [
      { id: 'main', cats: ['protein'], streams: ['regular'] },
      { id: 'veganalt', cats: ['protein'], streams: ['vegan'] },
    ],
    FLAG_DEFS: [{ key: 'hasNightshades' }, { key: 'hasFish' }, { key: 'hasSoy' }],
    HUB_ALLERGEN_MAP: { Nightshades: 'hasNightshades', Fish: 'hasFish', Soy: 'hasSoy' },
    DOOR_RECIPE_DATA: [
      { recipeName: 'Pork Al Pastor', category: 'protein', stream: 'regular', allergens: ['Nightshades'] },
      { recipeName: 'Blackened Fish', category: 'protein', stream: 'regular', allergens: ['Fish'] },
    ],
    escapeHtml: (s) => String(s),
    renderSlots() {}, updateSlotSummary() {},
    renderSmSlots() {}, updateSmSlotSummary() {},
    _doc: null,
  };
  c._doc = { dd, inp };
  vm.createContext(c);
  vm.runInContext([
    fnBlock('isHubLoaded'), fnBlock('recipeMatchesSlotDef'),
    fnBlock('_hubAllergenResolve'), fnBlock('hubAllergenToFlags'),
    fnBlock('slotAutoSave'), fnBlock('slotKey'), fnBlock('slotSaveManual'),
    fnBlock('smSlotAutoSave'), fnBlock('smSlotKey'), fnBlock('smSlotSaveManual'),
  ].join('\n\n'), c, { filename: 'index.html#freetext', timeout: 1000 });
  return c;
}

// ── blur / autosave: commit the typed text, never discard it on an open dropdown ──────────
test('slotAutoSave keeps typed text as free manual even with the match dropdown open', () => {
  const c = ctx({ ddVisible: true });
  c.slotAutoSave('main', 'Vegan Nacho Mix');   // no exact CODEX recipe by that name
  assert.equal(c.MEAL_SLOT_STATE.main && c.MEAL_SLOT_STATE.main.manual, 'Vegan Nacho Mix',
    'typed text is kept (pre-slice returned early on a visible dropdown and lost it)');
  assert.equal('recipeName' in (c.MEAL_SLOT_STATE.main || {}), false, 'never force-linked to a close recipe');
  assert.equal(c._doc.dd.style.display, 'none', 'the open dropdown is closed on commit');
});

test('slotAutoSave links only on an EXACT recipe-name match', () => {
  const c = ctx({ ddVisible: true });
  c.slotAutoSave('main', 'pork al pastor');   // exact, case-insensitive
  assert.equal(c.MEAL_SLOT_STATE.main.recipeName, 'Pork Al Pastor', 'exact name links the recipe');
});

test('slotAutoSave never adopts a partial/similar name', () => {
  const c = ctx({ ddVisible: true });
  c.slotAutoSave('main', 'Pork Al');   // a substring of a real recipe
  assert.equal(c.MEAL_SLOT_STATE.main.manual, 'Pork Al', 'partial stays free manual');
  assert.equal('recipeName' in c.MEAL_SLOT_STATE.main, false, 'not linked to the close match');
});

test('smSlotAutoSave (Special Meal editor) has the same free-text behavior', () => {
  const c = ctx({ ddVisible: true });
  c.smSlotAutoSave('main', 'Vegan Nacho Mix');
  assert.equal(c.SM_SLOT_STATE.main.manual, 'Vegan Nacho Mix', 'SM editor keeps typed text too');
  assert.equal('recipeName' in c.SM_SLOT_STATE.main, false);
});

// ── Enter: commit the typed text; never auto-click the top dropdown row ───────────────────
test('Enter never clicks the top dropdown match — it commits the typed text', () => {
  let rowClicked = false;
  const row = { click() { rowClicked = true; } };
  const c = ctx({ ddVisible: true, row, inputValue: 'Vegan Nacho Mix' });
  c.slotKey({ key: 'Enter', preventDefault() {} }, 'main');
  assert.equal(rowClicked, false, 'the top CODEX match is NOT auto-clicked (pre-slice did first.click())');
  assert.equal(c.MEAL_SLOT_STATE.main.manual, 'Vegan Nacho Mix', 'the typed text is committed as manual');
});

test('Enter with an exact recipe name still links it', () => {
  const c = ctx({ ddVisible: false, inputValue: 'Blackened Fish' });
  c.slotKey({ key: 'Enter', preventDefault() {} }, 'main');
  assert.equal(c.MEAL_SLOT_STATE.main.recipeName, 'Blackened Fish', 'exact typed name links on Enter');
});

test('smSlotKey Enter commits typed text without clicking the top row', () => {
  let rowClicked = false;
  const row = { click() { rowClicked = true; } };
  const c = ctx({ ddVisible: true, row, inputValue: 'House Special' });
  c.smSlotKey({ key: 'Enter', preventDefault() {} }, 'main');
  assert.equal(rowClicked, false, 'SM editor does not auto-click the top row');
  assert.equal(c.SM_SLOT_STATE.main.manual, 'House Special');
});

// ── source locks ─────────────────────────────────────────────────────────────────────────
test('source: dropdown rows keep input focus (mousedown-preventDefault) so a click is not lost', () => {
  assert.ok(fnBlock('slotSearch').includes('onmousedown="event.preventDefault()"'), 'regular dropdown rows preventDefault mousedown');
  assert.ok(fnBlock('smSlotSearch').includes('onmousedown="event.preventDefault()"'), 'SM dropdown rows preventDefault mousedown');
});

test('source: slotKey/smSlotKey commit via autosave and never auto-click the top match', () => {
  assert.ok(!/first\.click\(\)/.test(fnBlock('slotKey')), 'slotKey no longer auto-clicks the top dropdown row');
  assert.ok(fnBlock('slotKey').includes('slotAutoSave(slotId, inp.value'), 'slotKey commits via slotAutoSave');
  assert.ok(!/first\.click\(\)/.test(fnBlock('smSlotKey')), 'smSlotKey no longer auto-clicks the top row');
  assert.ok(fnBlock('smSlotKey').includes('smSlotAutoSave(slotId, inp.value'), 'smSlotKey commits via smSlotAutoSave');
});

test('source: autosave no longer bails out on an open dropdown (that discarded the typed text)', () => {
  assert.ok(!/dd\.style\.display !== 'none'\) return/.test(fnBlock('slotAutoSave')), 'slotAutoSave commits instead of returning on a visible dropdown');
  assert.ok(!/dd\.style\.display !== 'none'\) return/.test(fnBlock('smSlotAutoSave')), 'smSlotAutoSave commits instead of returning on a visible dropdown');
});
