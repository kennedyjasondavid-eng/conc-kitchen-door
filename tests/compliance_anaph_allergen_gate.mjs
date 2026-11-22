// An anaphylactic allergen always needs a note (2026-11-22, v31-standard.139). Jason: "Fix the anaphylactic auto-tier gap
// too". Before, a resident anaphylactic to fish whose only restriction was No Fish (self-declared for anyone else in
// COMPLIANCE_TIERS) read Confirmed and never reached Compliance Review. Plan docs/DOOR_COMPLIANCE_REVIEW_PLAN_2026-11-22.md §11.
//   1. anaphylactic to fish, No Fish only: Provisional, listed with the anaphylactic rooms, needs No Fish
//   2. the same restriction without the anaphylactic list: Confirmed, not listed (nothing else changes)
//   3. no anaphylactic tags picked: every restriction that names a meal flag counts (No Beef), Halal does not
//   4. anaphylactic tags picked: only those (anaphylactic to peanuts: No Fish stays self-declared)
//   5. a note documents it; an older build's Auto Confirmed is never read as documented; off the list, the note goes
//   6. the badge and the nudge count it; today's list moves no anaphylactic room
//   7. review fold: a picked allergen missing from the restrictions is listed as no allergen recorded; the writers work
//      the status out after the anaphylactic list changes
// Authored to fail on main 6e662bc.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { complianceDocsSource, doorSource } from './helpers/door_two_computers.mjs';

const html = fs.readFileSync(process.env.COMPLIANCE_ANAPH_HTML || new URL('../index.html', import.meta.url), 'utf8');
const { between, fn, fnOpt } = doorSource(html);
const out = (v) => JSON.parse(JSON.stringify(v));
const T = '2026-11-22';

function box(reg = [], rooms = []) {
  const SRC = [
    html.match(/const TAG_LABELS_MAP = \{[\s\S]*?\n\};/)[0],
    between('const ROUTING_TAGS = new Set([', 'function migrateResidentTiers('),
    between('/* DOOR_TESTABLE_CORE_START compliance-conflicts */', '/* DOOR_TESTABLE_CORE_END compliance-conflicts */'),
    complianceDocsSource(html), fn('doorIsAnaphResident'),
    ...['getComplianceResidents', 'doorComplianceToday', 'doorComplianceStateOf'].map(fnOpt),
    'this.__set = (reg, rooms) => { REGISTRY_LIST.splice(0, REGISTRY_LIST.length, ...reg); anaphRooms = rooms; };',
  ].join('\n');
  const c = { console: { log() {}, warn() {} }, REGISTRY_LIST: [], anaphRooms: [] };
  vm.createContext(c);
  vm.runInContext(SRC, c, { filename: 'index.html#compliance-anaph', timeout: 20000 });
  c.__set(reg, rooms);
  return c;
}
const R = (room, tags, extra) => Object.assign({ room, tags, section: 'Regular', rawRestriction: tags.join(', '), confirm: 'Confirmed', confirmBy: 'Auto' }, extra || {});
const listed = (c) => out(c.getComplianceResidents(false)).map((r) => r.room).sort();

test('1. anaphylactic to fish, No Fish only: Provisional, listed with the anaphylactic rooms', () => {
  const r = R('405', ['No Fish'], { isAnaph: true, anaphTags: ['noFish'] });
  const c = box([r], ['405']);
  c.doorApplyDocTags(r, r.tags, {});
  const st = c.doorComplianceStateOf(r);
  assert.deepEqual([r.confirm, st.needs, st.group, listed(c)], ['Provisional', ['No Fish'], 'anaph', ['405']]);
});

test('2. the same restriction without the anaphylactic list is self-declared, as before', () => {
  const r = R('406', ['No Fish']);
  const c = box([r], []);
  c.doorApplyDocTags(r, r.tags, {});
  assert.deepEqual([r.confirm, listed(c)], ['Confirmed', []]);
});

test('3. no anaphylactic tags picked: every restriction naming a meal flag counts, Halal does not', () => {
  const r = R('407', ['No Beef', 'Halal'], { isAnaph: true });
  const c = box([r], ['407']);
  c.doorApplyDocTags(r, r.tags, {});
  assert.deepEqual([r.confirm, c.doorComplianceStateOf(r).needs], ['Provisional', ['No Beef']]);
});

test('4. anaphylactic tags picked: only those are anaphylactic', () => {
  const r = R('408', ['No Peanuts', 'No Fish'], { isAnaph: true, anaphTags: ['noPeanuts'] });
  const c = box([r], ['408']);
  c.doorApplyDocTags(r, r.tags, {});
  assert.deepEqual(c.doorComplianceStateOf(r).needs, ['No Peanuts'], 'No Fish stays self-declared for a peanut-anaphylactic resident');
});

test('5. a note documents it; an Auto Confirmed is never read as documented; off the list, the note goes', () => {
  const r = R('405', ['No Fish'], { isAnaph: true, anaphTags: ['noFish'], confirm: 'Provisional', confirmBy: '—' });
  const c = box([r], ['405']);
  c.doorRecordDocs(r, ['No Fish'], 'note', 'Fiona', T, 'H&W letter', T + 'T12:00:00.000Z');
  assert.deepEqual([r.confirm, r.docs['No Fish'].by], ['Confirmed', 'Fiona']);
  // an older build left an Auto Confirmed: the normaliser reads it as needing the note
  const old = R('409', ['No Fish'], { isAnaph: true, anaphTags: ['noFish'], confirm: 'Confirmed', confirmBy: 'Auto' });
  const c2 = box([old], ['409']);
  c2.doorMigrateDocs(old, T, T + 'T12:00:00.000Z');
  assert.deepEqual([old.confirm, old.docs], ['Provisional', undefined]);
  // off the anaphylactic list: No Fish is self-declared again; the note is no longer needed
  const c3 = box([r], []);
  r.isAnaph = false; r.anaphTags = [];
  c3.doorApplyDocTags(r, r.tags, {});
  assert.deepEqual([r.confirm, r.docs], ['Confirmed', undefined]);
});

test('6. the badge and the nudge count it; today\'s list moves no anaphylactic room', () => {
  const r = R('405', ['No Fish'], { isAnaph: true, anaphTags: ['noFish'], confirm: 'Provisional' });
  const c = box([r], ['405']);
  const items = [{ room: '405', st: c.doorComplianceStateOf(r) }];
  assert.deepEqual(out(c.doorDocBadge(items, T)), { count: 1, level: 'red' });
  assert.deepEqual([c.doorDocNudge(items, T).group, c.doorDocNudge(items, T).rooms], ['anaph', ['405']]);
  const state = JSON.parse(fs.readFileSync(new URL('../door_state.json', import.meta.url), 'utf8'));
  const c4 = box(state.residents, state.anaphRooms || []);
  const before = c4.REGISTRY_LIST.filter((x) => (state.anaphRooms || []).includes(x.room)).map((x) => x.room + ':' + x.confirm);
  c4.REGISTRY_LIST.forEach((x) => c4.doorMigrateDocs(x, T, T + 'T12:00:00.000Z'));
  const after = c4.REGISTRY_LIST.filter((x) => (state.anaphRooms || []).includes(x.room)).map((x) => x.room + ':' + x.confirm);
  assert.deepEqual(after, before, 'today the anaphylactic rooms already need their notes');
});

test('7. review fold: a picked allergen not among the restrictions; the status follows the list changes', () => {
  const r = R('410', ['Halal'], { isAnaph: true, anaphTags: ['noFish'] });
  const c = box([r], ['410']);
  c.doorApplyDocTags(r, r.tags, {});
  const st = c.doorComplianceStateOf(r);
  assert.deepEqual([r.confirm, st.anaphNoAllergen, st.group, listed(c)], ['Provisional', true, 'anaph', ['410']]);
  for (const name of ['saveDirectFromForm', 'commitIntakeQueue', 'saveRegistryEdit', 'revertResident']) {
    const body = fn(name);
    const iList = Math.max(body.lastIndexOf('anaphRooms.push('), body.lastIndexOf('anaphRooms.splice('));
    assert.ok(iList > 0 && body.lastIndexOf('doorApplyDocTags(') > iList, name + ' works the status out after the list');
  }
  for (const name of ['addAnaphRoom', 'removeAnaphRoom']) assert.match(fn(name), /doorApplyDocTags\(r, r\.tags, \{\}\)/, name);
});
