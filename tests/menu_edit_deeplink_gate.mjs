// EXPO "Fix in DOOR" opens the exact day (EXPO_BOARD_NEEDS_SMOOTHING_PLAN_2026-10-02.md S5).
//
// `#menu-config/edit/<week>/<DAY>/<period>` opens Menu Config on that week, in Edit Menu mode, with that
// meal's editor open — but only after the boot menu sync has settled, so the editor never shows a copy of
// the day that the cloud merge is about to replace (the Parsnip class). Anything malformed opens the Menu
// Config screen alone. Plain `#<screen>` links are unchanged.
//
// Authored-to-fail against origin/main fc6d819: doorParseHashRoute does not exist.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function core() {
  const s = html.indexOf('/* DOOR_TESTABLE_CORE_START publish-validation */');
  const e = html.indexOf('/* DOOR_TESTABLE_CORE_END publish-validation */');
  const c = { Array, JSON, Object, Number, isFinite, String, decodeURIComponent };
  vm.createContext(c);
  vm.runInContext(html.slice(s, e), c, { timeout: 1000 });
  return c;
}
function fnBlock(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'could not find function ' + name);
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}') { depth--; if (depth === 0) { i++; break; } } }
  return html.slice(start, i);
}
const plain = v => JSON.parse(JSON.stringify(v));

test('a day link names the week, day and meal', () => {
  const C = core();
  assert.equal(typeof C.doorParseHashRoute, 'function', 'doorParseHashRoute exists in the testable core');
  assert.deepEqual(plain(C.doorParseHashRoute('menu-config/edit/2/SATURDAY/lunch')),
    { screen: 'menu-config', edit: { week: 2, day: 'SATURDAY', period: 'lunch' } });
  assert.deepEqual(plain(C.doorParseHashRoute('#menu-config/edit/4/tuesday/Dinner')),
    { screen: 'menu-config', edit: { week: 4, day: 'TUESDAY', period: 'dinner' } }, 'case-insensitive, leading # ok');
});

test('a malformed day link opens Menu Config alone', () => {
  const C = core();
  for (const h of ['menu-config/edit/5/MONDAY/lunch', 'menu-config/edit/0/MONDAY/lunch', 'menu-config/edit/2/FUNDAY/lunch',
    'menu-config/edit/2/MONDAY/brunch', 'menu-config/edit/2/MONDAY', 'menu-config/edit', 'menu-config/edit/x/MONDAY/lunch']) {
    assert.deepEqual(plain(C.doorParseHashRoute(h)), { screen: 'menu-config', edit: null }, h);
  }
});

test('plain screen links are unchanged; empty is nothing', () => {
  const C = core();
  assert.deepEqual(plain(C.doorParseHashRoute('plating')), { screen: 'plating', edit: null });
  assert.deepEqual(plain(C.doorParseHashRoute('menu-config')), { screen: 'menu-config', edit: null });
  assert.equal(C.doorParseHashRoute(''), null);
  assert.equal(C.doorParseHashRoute('#'), null);
});

test('the route opens the editor on that week in edit mode, after the boot menu sync, and clears the hash', () => {
  const body = fnBlock('applyHashRoute');
  assert.match(body, /doorParseHashRoute\(/, 'uses the parser');
  assert.match(body, /_doorBootMenuSync/, 'waits for the boot menu sync');
  assert.match(body, /mcWeek\s*=/, 'shows the linked week in the grid');
  assert.match(body, /toggleEditMenuMode\(\)/, 'turns Edit Menu on');
  assert.match(body, /openMenuEdit\(/, 'opens that meal');
  assert.match(body, /history\.replaceState/, 'clears the hash so a reload does not reopen it');
});

test('the boot sync exposes one promise for the menu fetches', () => {
  const boot = html.slice(html.indexOf('(function bootRemoteState()'), html.indexOf('(function bootRemoteState()') + 4000);
  assert.match(boot, /_doorBootMenuSync\s*=\s*Promise\.allSettled\(/, 'the two menu fetches are gathered into _doorBootMenuSync');
});
