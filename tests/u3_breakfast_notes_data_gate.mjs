// U3 S1 data: the two breakfast notes Jason confirmed (2026-11-19, "Follow leans on all four"; entering them in the public
// repository confirmed 2026-11-20), entered through DOOR's resident editor (the notes-only save) and published through DOOR's
// publisher. Reads the published door_state.json; a later reviewed resident change that touches these notes re-pins this
// with a dated note.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const state = JSON.parse(fs.readFileSync('door_state.json', 'utf8'));
const byRoom = new Map(state.residents.map((r) => [r.room, r]));
const NOTES = { '301a': 'oat milk only', '1007': 'smaller breakfast starch portion plus extra protein' };

test('BN-1 the two confirmed notes are on their residents, as written', () => {
  for (const [room, note] of Object.entries(NOTES)) {
    assert.ok(byRoom.has(room), room + ' is on the resident list');
    assert.equal(byRoom.get(room).breakfastNote, note, room);
  }
});

test('BN-2 a note alone moved nobody: both keep their section and restriction words', () => {
  // The notes-only save writes only the notes (the full save re-routed 1007 to Regular in the dry run).
  assert.equal(byRoom.get('1007').section, 'Diabetic');
  assert.equal(byRoom.get('301a').section, 'Vegan / Vegetarian');
  assert.equal(byRoom.get('301a').rawRestriction, 'GF, Lactose Intolerant, Vegetarian, No Beans');
  assert.deepEqual(byRoom.get('301a').tags, ['GF', 'Lactose Intolerant', 'Vegetarian', 'No Beans']);
  assert.equal(byRoom.get('1007').rawRestriction, 'Low Sodium, Low Carb');
  assert.deepEqual(byRoom.get('1007').tags, ['Low Sodium', 'Low Carb']);
});

test('BN-3 no other resident carries a breakfast note', () => {
  const others = state.residents.filter((r) => r.breakfastNote && !(r.room in NOTES)).map((r) => r.room);
  assert.deepEqual(others, []);
});

test('BN-4 no file Pages serves holds a breakfast note', () => {
  const served = new Set();
  for (const line of fs.readFileSync('.github/workflows/pages.yml', 'utf8').split('\n')) {
    if (/^\s*#/.test(line)) continue;
    for (const m of line.matchAll(/[\w.-]+\.json/g)) served.add(m[0]);
  }
  assert.ok(served.has('registry_summary.json') && served.has('menu_current.json'), 'the served list was read');
  for (const f of served) {
    if (!fs.existsSync(f)) continue;
    const text = fs.readFileSync(f, 'utf8');
    assert.ok(!text.includes('breakfastNote'), f + ' has no breakfastNote field');
    for (const note of Object.values(NOTES)) assert.ok(!text.includes(note), f + ' does not carry a note');
  }
});
