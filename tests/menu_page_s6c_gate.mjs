// S6c of the Edit Menu redesign (docs/DOOR_MENU_EDIT_REDESIGN_PLAN_2026-11-19.md): the Menu page and More.
// Node half; the browser half is tests/browser/menu_page_s6c.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
test('S6c-1 no Edit mode: its button, banner, state and toggle are gone', () => {
  for (const gone of ['editMenuMode', 'toggleEditMenuMode', 'mc-edit-menu-btn', 'mc-edit-menu-banner', 'Leave Edit Menu']) assert.ok(!html.includes(gone), gone + ' is gone');
});
test('S6c-2 the rare tools are under one More menu, keeping their ids', () => {
  const i = html.indexOf('<details class="mc-more"'), j = html.indexOf('</details>', i);
  assert.ok(i > 0 && j > i);
  const menu = html.slice(i, j);
  for (const want of ['id="mc-swap-slots-btn"', 'Swap two meals', 'openSpecialMealPanel()', 'Special meal', 'id="mc-rex-week-btn"', 'Rex’s week sheet', 'triggerMenuUpload()', 'Replace the whole menu from a file'])
    assert.ok(menu.includes(want), want);
});
test('S6c-3 a meal card names the anaphylaxis families and Pork, counts the rest, and shows Spicy', () => {
  assert.match(html, /const MC_CARD_NAMED = \['hasPeanuts', 'hasTreeNuts', 'hasSesame', 'hasFish', 'hasShellfish'\];/);
  assert.match(html, /_named\.map\(f => _chip\(f\.label, f\.label, '#b91c1c'\)\)/);
  assert.match(html, /activeFlags\.hasPork \? _chip\('Pork', 'Pork', '#7c3aed'\)/);
  assert.match(html, /_chip\('Spicy', 'Spicy', '#dc2626'\)/);
  assert.ok(!html.includes('if (false)'));
});
test('S6c-4 More opens inside the screen on a phone and closes on Escape', () => {
  assert.match(html, /@media \(max-width: 768px\) \{ #screen-menu-config \.mc-more-menu \{ right:auto !important; left:0 !important; max-width:calc\(100vw - 32px\); \} \}/);
  assert.match(html, /if \(e\.key !== 'Escape'\) return;/);
});
