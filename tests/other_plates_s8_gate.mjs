// S8 of the Edit Menu redesign (docs/DOOR_MENU_EDIT_REDESIGN_PLAN_2026-11-19.md): "Other plates the kitchen makes" (M13).
// Node half; the browser half is tests/browser/other_plates_s8.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const fn = (name) => { const i = html.indexOf('function ' + name + '('); assert.ok(i >= 0, name); return html.slice(i, html.indexOf('\n}\n', i) + 2); };
test('S8-1 one name, one plain sentence, one row per plate the meal has, + Add a plate for the rest', () => {
  const f = fn('doorFillKitchenAltInputs');
  assert.match(f, /title\.textContent = 'Other plates the kitchen makes';/);
  assert.match(f, /class="mc-kalt-row" data-kalt="' \+ k \+ '" style="display:' \+ \(stored\(k\)\.trim\(\) \? 'contents' : 'none'\)/);
  assert.match(fn('doorRenderAddPlate'), /\+ Add a plate for/);
  assert.match(f, /id="mc-kalt-' \+ k \+ '"/, 'the box ids stay (they are what Save reads)');
});
test('S8-2 each plate says how many residents get it, and what happens when it is not made', () => {
  const f = fn('doorRenderAltEditorFeedback');
  assert.match(f, /' get' \+ \(n === 1 \? 's' : ''\) \+ ' this plate/);
  assert.match(f, /DOOR_KITCHEN_ALT_NOT_MADE\[o\.target\]/);
  for (const gone of ['Draft routing', 'existing fallback', 'CODEX declarations', 'requirement group', 'Restriction-specific plates']) assert.ok(!html.includes(gone), gone);
  for (const k of ['gfAlt', 'diabeticAlt', 'noDairyAlt', 'noEggAlt', 'blandAlt', 'anaphAlt']) assert.match(html, new RegExp('\\b' + k + ": 'Not made: "));
});
