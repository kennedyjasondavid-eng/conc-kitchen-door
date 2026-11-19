// S4a of the Edit Menu redesign (D4, Jason 2026-11-19: "Follow lean"): a real edit rewrites only the dish that changed.
// The words the meal opened with stay as written and in their order; a changed dish's words are replaced where they stood;
// a dish taken out loses its words and one separator; a new dish goes at the end. A changed dish that cannot be found in
// the words (boxes behind the words, the Event Name) rebuilds the line from the boxes, as before.
// The browser half (every published meal, a one-dish edit, the words outside that dish unchanged) is
// tests/browser/menu_words_kept_s4a.mjs, in CI. Authored-to-fail against main.
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
function ctx() {
  const c = {};
  vm.createContext(c);
  vm.runInContext([/const DOOR_WORD_SLOT_IDS = [^\n]*/.exec(html)[0], /const DOOR_WORD_SEP_RE = [^\n]*/.exec(html)[0],
    fnBlock('doorWordPieces'), fnBlock('doorFindDishRun'), fnBlock('doorKeepMenuWords')].join('\n'), c);
  return c;
}
const B = { main: 'Pancakes', starch: 'turkey bacon', vegside: '', xtra: 'fruit & yoghurt' };

test('S4a-1 a changed dish is replaced where it stood; every other word stays as written', () => {
  const c = ctx();
  const text = 'Pancakes, turkey bacon, fruit & yoghurt';
  assert.equal(c.doorKeepMenuWords(text, B, { ...B, starch: 'pork sausage' }), 'Pancakes, pork sausage, fruit & yoghurt');
  assert.equal(c.doorKeepMenuWords(text, B, { ...B, main: 'French Toast' }), 'French Toast, turkey bacon, fruit & yoghurt');
  assert.equal(c.doorKeepMenuWords(text, B, B), text, 'nothing changed: the words as written');
});

test('S4a-2 a dish taken out loses its words and one separator; a new dish goes at the end', () => {
  const c = ctx();
  const text = 'Pancakes, turkey bacon, fruit & yoghurt';
  assert.equal(c.doorKeepMenuWords(text, B, { ...B, starch: '' }), 'Pancakes, fruit & yoghurt');
  assert.equal(c.doorKeepMenuWords(text, B, { ...B, main: '' }), 'turkey bacon, fruit & yoghurt', 'the first dish takes the separator after it');
  assert.equal(c.doorKeepMenuWords(text, B, { ...B, vegside: 'Steamed Broccoli' }), 'Pancakes, turkey bacon, fruit & yoghurt, Steamed Broccoli');
});

test('S4a-3 dishes are whole pieces: never inside another dish; anything not placed exactly rebuilds', () => {
  const c = ctx();
  // review fold P1-1: a side whose words sit inside the main is the whole piece, never the main
  assert.equal(c.doorKeepMenuWords('Beef and Broccoli, Rice, Broccoli', { main: 'Beef and Broccoli', starch: 'Rice', vegside: 'Broccoli' },
    { main: 'Beef and Broccoli', starch: 'Rice', vegside: 'Green Beans' }), 'Beef and Broccoli, Rice, Green Beans');
  assert.equal(c.doorKeepMenuWords('Rice and Peas Chicken, Rice', { main: 'Rice and Peas Chicken', starch: 'Rice' },
    { main: 'Rice and Peas Chicken', starch: 'Potatoes' }), 'Rice and Peas Chicken, Potatoes');
  assert.equal(c.doorKeepMenuWords('Yetisse Fish, Okra and cassava stew', { vegside: 'Okra and Cassava Stew' }, { vegside: 'Callaloo' }), 'Yetisse Fish, Callaloo', 'found without case');
  assert.equal(c.doorKeepMenuWords('Beef Chili, Cornbread', { main: 'Chili' }, { main: 'Stew' }), null, 'words inside a dish are not a dish: rebuild');
  assert.equal(c.doorKeepMenuWords('Rice, Rice', { starch: 'Rice' }, { starch: 'Quinoa' }), null, 'two places it could be: rebuild');
  // P1-2: edits are placed on the words as they opened, so one never makes words another then matches
  assert.equal(c.doorKeepMenuWords('Chicken, Rice', { main: 'Chicken', starch: 'Rice' }, { main: 'Rice Bowl', starch: 'Quinoa' }), 'Rice Bowl, Quinoa');
  // P2-1: a new dish whose words sit inside another dish is still added
  assert.equal(c.doorKeepMenuWords('Fried Rice, Bok Choy', { main: 'Fried Rice', vegside: 'Bok Choy' }, { main: 'Fried Rice', vegside: 'Bok Choy', starch: 'Rice' }), 'Fried Rice, Bok Choy, Rice');
  assert.equal(c.doorKeepMenuWords('Fried Rice, Rice', { main: 'Fried Rice' }, { main: 'Fried Rice', starch: 'Rice' }), 'Fried Rice, Rice', 'already a piece: not added twice');
  // P3: the Event Name keeps its dash when the dish after it is taken out
  assert.equal(c.doorKeepMenuWords('Jerk Night — Jerk Chicken, Rice', { extras: 'Jerk Night', main: 'Jerk Chicken', starch: 'Rice' },
    { extras: 'Jerk Night', main: '', starch: 'Rice' }), 'Jerk Night — Rice');
  assert.equal(c.doorKeepMenuWords('Jerk Night — Jerk Chicken', { extras: 'Jerk Night', main: 'Jerk Chicken' }, { extras: 'BBQ Night', main: 'Jerk Chicken' }), null, 'a new Event Name rebuilds');
  assert.equal(c.doorKeepMenuWords('Jerk Night — Jerk Chicken', { extras: 'Jerk Night', main: 'Jerk Chicken' }, { extras: 'Jerk Night', main: '' }), 'Jerk Night', 'no dash left at the end');
  assert.equal(c.doorKeepMenuWords('Rice, Rice', { main: 'Rice' }, { main: 'Rice', starch: 'Rice' }), 'Rice, Rice', 'a dish already in the words twice is not added again');
  // a joined box ("A & B") is the run of its pieces
  assert.equal(c.doorKeepMenuWords('Pancakes, turkey bacon, fruit & yoghurt', { main: 'Pancakes', xtra: 'fruit & yoghurt' }, { main: 'Pancakes', xtra: 'Fruit Cup' }), 'Pancakes, turkey bacon, Fruit Cup');
});

test('S4a-4 Save, the draft summary and the preview read the kept words; the words are taken at open, before the baseline', () => {
  assert.match(fnBlock('saveMenuEdit'), /const name = doorEditedMealName\(\);/);
  assert.match(fnBlock('doorDraftPlateFacts'), /doorWriteEditorMeal\(overlay\[week\]\[day\], period, doorEditedMealName\(\), buildVegAlt\(\), flags\);/);
  // Re-pinned 2026-11-19 (Edit Menu redesign S6b, D5): the Test Meal sandbox is retired, so the preview reads the kept
  // words whenever the helper is there (no testMealActive branch).
  assert.match(fnBlock('updateSlotSummary'), /const name = \(typeof doorEditedMealName !== 'function'\) \? buildMealName\(\) : doorEditedMealName\(\);/);
  assert.match(fnBlock('openMenuEdit'), /_doorWordsAtOpen = existing \? null : \{ key: mcMenuEditKey, text: String\(dayData\[period\] \|\| ''\), slots: \{\} \};[\s\S]*_doorMenuDraftBaseline = \{key:mcMenuEditKey/);
  assert.match(fnBlock('doorEditedMealName'), /return kept \|\| built;/);
});
