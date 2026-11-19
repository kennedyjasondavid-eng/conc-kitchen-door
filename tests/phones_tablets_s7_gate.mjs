// S7 of the Edit Menu redesign (docs/DOOR_MENU_EDIT_REDESIGN_PLAN_2026-11-19.md): phones and tablets.
// Node half; the browser half is tests/browser/phones_tablets_s7.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
test('S7-1 a phone shows a day picker and one day; the week grid tags each day column', () => {
  assert.match(html, /<div id="mc-day-picker" class="mc-day-picker" role="group" aria-label="Day"><\/div>/);
  assert.match(html, /#mc-grid \.mc-day-col:not\(\.mc-day-on\) \{ display: none; \}/);
  assert.match(html, /td\.className = 'mc-day-col' \+ \(di === mcPhoneDay \? ' mc-day-on' : ''\);/);
  assert.match(html, /function mcSetPhoneDay\(i\)/);
});
test('S7-2 the meal view: full screen on a phone, a side panel on a wide screen; the page is given back on close', () => {
  // Review fold: under the dialogs (.modal-overlay 200) and below the out-of-date bar; the side panel only from 1500 px,
  // under the header, so the week and the header actions stay usable.
  assert.match(html, /#mc-menu-edit-panel\.mc-open \{ position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 190;/);
  assert.match(html, /@media \(min-width: 1500px\) \{\s*#mc-menu-edit-panel\.mc-open \{ position: fixed; top: 0; right: 0; bottom: 0;/);
  assert.match(html, /function doorPlaceMealPanel\(\)/);
  assert.match(html, /panel\.classList\.add\('mc-open'\)/);
  assert.match(html, /panel\.classList\.remove\('mc-open'\)/);
});
test('S7-3 touch targets: pills, clear and buttons at least 44 px on a phone or a touch screen', () => {
  assert.match(html, /@media \(max-width: 768px\), \(pointer: coarse\) \{\s*#mc-menu-edit-panel \.slot-pill \{ display: inline-flex; align-items: center; min-height: 44px;/);
  assert.match(html, /<span class="slot-pill" onclick=/);
  assert.match(html, /class="slot-clear"/);
});
