// tests/fuzzy_near_word_gate.mjs — a near spelling is read only when it is plainly the same word (2026-11-10, v31-standard.64).
// The resident-list import (normalizeRestriction) tried every word it could not read against a list of known restrictions,
// and took any within two edits of the WHOLE phrase, without asking. So "No meat" read as "No wheat" (Gluten Free) and
// nobody was asked: a no-meat resident arrived as gluten-free only. "No Peas" read as No Beans, "No Beer" as No Beef.
// Found by the D2a review; Jason, 2026-11-10: "Yes, please fix". Now the distance is taken on the word after its "No" or
// "Low", a word under 5 letters must be spelled exactly, a 5–7 letter word may be one edit away and a longer one two;
// anything less sure is asked about. Runs the REAL import module in a vm. Authored to fail on main 6246807.
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
const store = { concLearnedNR: '{}', concDismissedDiffs: '{}', concCustomTagRules: '[]' };
const box = { console, REGISTRY_LIST: [], REGISTRY_MAP: {}, anaphRooms: [], changesQueue: [], IMPORT_STATE: null, MEAL: { lunch: 'lunch' },
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem() {}, removeItem() {} },
  document: { getElementById: () => null, querySelectorAll: () => [] }, showToast() {}, escapeHtml: s => String(s), _escAttr: s => String(s) };
vm.createContext(box);
vm.runInContext([bracedConst('TAG_LABELS_MAP'), fn('getRoomBase'), between('const IMPORT_TAG_RULES = [', '\nfunction handleImportFile(')].join('\n'),
  box, { filename: 'index.html#import-module', timeout: 5000 });
const parse = (t) => JSON.parse(JSON.stringify(vm.runInContext('normalizeRestriction(' + JSON.stringify(t) + ')', box)));
const tags = (t) => { const p = parse(t); return Object.keys(p.tags).filter(k => p.tags[k]).sort(); };

test('"No meat" is a question, never Gluten Free', () => {
  assert.deepEqual(tags('No meat'), [], 'No meat → ' + JSON.stringify(tags('No meat')));
  assert.deepEqual(parse('No meat').unmatched, ['No meat']);
  assert.deepEqual(tags('No Meat, No Fish'), ['noFish']);
  assert.deepEqual(parse('No Meat, No Fish').unmatched, ['No Meat']);
});

test('a short word close to another food is asked about, not read as it', () => {
  for (const t of ['No Peas', 'No Beer', 'no seat', 'No Fush', 'No ham', 'No Tea']) {
    assert.deepEqual(tags(t), [], t + ' → ' + JSON.stringify(tags(t)));
    assert.deepEqual(parse(t).unmatched, [t], t + ' is asked about');
  }
});

test('plain typos of the same word are still read', () => {
  for (const [t, want] of [
    ['No Spicey', 'noSpicy'], ['Vegitarian', 'vegetarian'], ['Halaal', 'halal'], ['Diabetes', 'diabetic'],
    ['Gluten Fre', 'glutenFree'], ['No Diary', 'noDairy'], ['Soft Meal', 'softMeals'], ['Low Sodum', 'lowSodium'], ['No Brasicas', 'noBrassicas'],
  ]) {
    assert.deepEqual(tags(t), [want], t);
    assert.deepEqual(parse(t).unmatched, [], t + ': nothing to ask');
  }
});

test('the rule: lead word must match, distance on the word after it, ties are not a reading', () => {
  const f = (w) => vm.runInContext('importFuzzyTag(' + JSON.stringify(w) + ')', box);
  assert.equal(f('no meat'), null, 'under 5 letters');
  assert.equal(f('low spicy'), null, 'Low is not No');
  assert.equal(f('no spicey'), 'noSpicy', 'one edit on 6 letters');
  assert.equal(f('no spiceyy'), null, 'two edits on 6 letters');
  assert.equal(f('vegetarain'), 'vegetarian', 'two edits on 10 letters');
  // A joining word after an earlier "No" leads as "No", spelled exactly (the fuzzy pass used to carry this by luck).
  assert.deepEqual(tags('No Pork or Beef'), ['noBeef', 'noPork']);
  assert.deepEqual(tags('No Pork nor Fish'), ['noFish', 'noPork']);
  assert.deepEqual(parse('No Pork and Meat').unmatched, ['and Meat'], 'and Meat is still a question');
});

test('every published restriction reads exactly as before (no fuzzy reading is used today)', () => {
  const raws = [...new Set(json('door_state.json').residents.map(r => r.rawRestriction).filter(Boolean))];
  for (const raw of raws) {
    const p = parse(raw);
    assert.deepEqual([p.unmatched, p.ambiguous], [[], []], raw);
  }
});
