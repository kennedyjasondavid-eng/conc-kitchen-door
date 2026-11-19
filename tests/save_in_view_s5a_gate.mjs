// S5a of the Edit Menu redesign, the node half (the browser half is tests/browser/save_in_view_s5a.mjs, in CI): a footer
// pinned to the bottom while a meal is open holds Save (grey until something changes) and the regular plate line; after a
// real Save the meal stays open with a dated line; the change log records who, and a meal card says "Changed today by".
// Authored-to-fail against main.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
function fnBlock(name) {
  const start = html.search(new RegExp('\\n(?:async )?function ' + name + '\\('));
  assert.ok(start >= 0, 'could not find function ' + name);
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return html.slice(start + 1, i);
}

test('S5a-1 one footer, pinned, with Save and Put back the original; Close stays by the title', () => {
  assert.match(html, /<div id="mc-menu-edit-footer" style="position:sticky;bottom:0;/);
  assert.match(html, /#mc-menu-edit-footer \{ position: fixed !important;/, 'fixed on a phone, where sticky does not stick');
  const footer = html.slice(html.indexOf('<div id="mc-menu-edit-footer"'), html.indexOf('</style>', html.indexOf('<div id="mc-menu-edit-footer"')));
  assert.match(footer, /id="mc-menu-save-btn" onclick="saveMenuEdit\(\)">Save</);
  assert.match(footer, /id="mc-menu-revert-btn"[^>]*>Put back the original</);
  assert.equal((html.match(/onclick="saveMenuEdit\(\)"/g) || []).length, 1, 'one Save');
});

test('S5a-2 Save is grey until the meal differs from how it opened, or a checked label waits to be written', () => {
  const f = fnBlock('doorRefreshSaveBar');
  assert.match(f, /doorMenuDraftIsDirty\(\)\) \|\| !!\(typeof doorOpenRepairTicks === 'function' && doorOpenRepairTicks\(\)\)/);
  assert.match(f, /btn\.disabled = !ready;/);
  assert.match(fnBlock('updateSlotSummary'), /setTimeout\(doorRefreshSaveBar, 0\)/);
  assert.match(fnBlock('openMenuEdit'), /_doorMenuDraftBaseline = \{key:mcMenuEditKey[^\n]*\n[^\n]*doorSetSaveStatus\(''\);\n[^\n]*doorRefreshSaveBar\(\);/);
});

test('S5a-3 after a real Save the meal stays open and the line says when, and whether it was sent', () => {
  assert.match(fnBlock('_finishMenuSave'), /doorStayOnSavedMeal\(week, day, period, _savedMsg\)/);
  const stay = fnBlock('doorStayOnSavedMeal');
  assert.match(stay, /openMenuEdit\(week, day, period\);/);
  assert.match(stay, /doorSetSaveStatus\(\(message \|\| 'Saved\.'\) \+ ' · ' \+ t, \/only\|Not sent\/\.test/);
});

test('S5a-4 the change log records who; a meal card says "Changed today by <name>" for an entry today', () => {
  assert.match(fnBlock('appendChangeLog'), /by: \(typeof getOperatorName === 'function' \? getOperatorName\(\) : ''\) \|\| '',/);
  const now = new Date();
  const c = { doorDateKey: (d) => d.toISOString().slice(0, 10), loadChangeLog: () => [
    { week: 2, day: 'TUESDAY', period: 'dinner', timestamp: now.toISOString(), by: 'QA Lead' },
    { week: 1, day: 'MONDAY', period: 'lunch', timestamp: '2026-01-01T10:00:00Z', by: 'Old' }] };
  vm.createContext(c);
  vm.runInContext(fnBlock('doorChangedToday'), c);
  assert.equal(c.doorChangedToday(2, 'TUESDAY', 'dinner'), 'Changed today by QA Lead');
  assert.equal(c.doorChangedToday(1, 'MONDAY', 'lunch'), '', 'an older change is not today');
  assert.equal(c.doorChangedToday(3, 'MONDAY', 'lunch'), '');
});
