// tests/anaph_flag_everywhere_gate.mjs — a resident on the anaphylactic list is anaphylactic everywhere (2026-10-18, v31-standard.31).
// Jason, 2026-10-18: "213 should have the flag act accordingly". DOOR holds "anaphylactic" twice: the resident's isAnaph
// and the anaphylactic room list (anaphRooms; Settings, "confirmed Apr22 via H&W audit" for 213). Room lockout, the
// alert, plating and the Anaphylactic List read both; the restriction sheet, both dietary-label outputs, the file
// previews, the week-ahead peanut line and the published anaphylactic count read only isAnaph. Room 213 is on the list
// with Tree Nuts and Coconut as its anaphylactic tags, but an import reset its isAnaph, so it was contained but never
// red, though the toggle promises "Flags red on all sheets". Now one rule, doorIsAnaphResident, is read everywhere, and a
// revert never takes a room off the list (only the editor's checkbox or the list's Remove do).
// Authored to fail on main 9cf22d9 (v31-standard.30).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) { return between('function ' + name + '(', '\n}\n') + '\n}\n'; }
function fnOpt(name) { return html.includes('function ' + name + '(') ? fn(name) : ''; }
const json = (f) => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'));
const state = json('door_state.json');

function ctxFor(residents, rooms) {
  const c = { REGISTRY_LIST: residents, anaphRooms: rooms };
  vm.createContext(c);
  vm.runInContext(fnOpt('doorIsAnaphResident') + fn('buildRegistrySummaryJSON'), c, { filename: 'index.html#anaph-flag', timeout: 2000 });
  return c;
}

test('the one rule: the resident\'s own flag, or a room on the anaphylactic list', () => {
  const c = ctxFor([], ['213', '813']);
  assert.equal(typeof c.doorIsAnaphResident, 'function', 'doorIsAnaphResident');
  assert.equal(c.doorIsAnaphResident({ room: '607a', isAnaph: true }), true, 'its own flag');
  assert.equal(c.doorIsAnaphResident({ room: '213', isAnaph: false }), true, 'on the list, flag reset');
  assert.equal(c.doorIsAnaphResident({ room: '101', isAnaph: false }), false);
  assert.equal(c.doorIsAnaphResident({ room: '101' }), false);
  assert.equal(c.doorIsAnaphResident(null), false);
});

// Every reader that decides how a resident is shown, routed or counted.
const READERS = ['getAnaphConflictRooms', 'getAnaphAlertInfo', 'buildAnaphListXlsx', 'buildRegistrySummaryJSON',
  'buildRestrictionListXlsx', 'buildLabelsXlsx', 'printLabels', 'openDemoFile', 'computePlatingData'];

test('every reader that shows, routes or counts a resident reads the one rule, never the raw flag', () => {
  for (const name of READERS) {
    const body = fn(name);
    assert.doesNotMatch(body, /\b[a-z]+\.isAnaph\b/, name + ' reads isAnaph directly');
    assert.match(body, /doorIsAnaphResident\(/, name + ' reads doorIsAnaphResident');
  }
  const report = between("} else if (type === 'menu_conflict') {", "} else if (type === 'welfare_patterns') {");
  assert.doesNotMatch(report, /\br\.isAnaph\b/, 'the week-ahead list');
  assert.match(report, /REGISTRY_LIST\.filter\(r => doorIsAnaphResident\(r\)\)/, 'its peanut line');
});

test('the published anaphylactic count is the Anaphylactic List\'s count', () => {
  const c = ctxFor(state.residents, state.anaphRooms.slice());
  const onList = state.residents.filter(r => r.isAnaph || state.anaphRooms.includes(r.room)).map(r => r.room).sort();
  // Re-pinned 2026-10-19: 813 came off the list at the Oct 19 Generate (v31-standard.39 asked; published 11:59, JK).
  assert.deepEqual(onList, ['1213', '213', '607a'], 'the published Anaphylactic List');
  assert.equal(c.buildRegistrySummaryJSON().flags.anaphylactic, onList.length);
});

test('a revert never takes a room off the anaphylactic list', () => {
  const body = fn('revertResident');
  assert.doesNotMatch(body, /anaphRooms\.splice|anaphRooms\s*=\s*anaphRooms\.filter/, 'no removal in revert');
  assert.match(body, /if \(r\.isAnaph && !anaphRooms\.includes\(r\.room\)\) anaphRooms\.push\(r\.room\);/, 'it still adds');
});

test('on the published resident list, only the rooms on the list with their flag reset change: 213', () => {
  // Re-pinned 2026-10-19: 813 came off the list at the Oct 19 Generate, so only 213 is listed with its flag reset.
  const changed = state.residents.filter(r => !r.isAnaph && state.anaphRooms.includes(r.room)).map(r => r.room).sort();
  assert.deepEqual(changed, ['213']);
  const r213 = state.residents.find(r => r.room === '213');
  assert.ok(r213.tags.some(t => t !== 'Regular'), '213 is on the restriction sheet and the labels, now red');
  const r813 = state.residents.find(r => r.room === '813');
  assert.ok(r813 && !r813.isAnaph && !state.anaphRooms.includes('813'), '813 (Regular) is off the list and not anaphylactic');
});
