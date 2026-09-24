// Menu overlay — the NEWEST edit to a menu day wins across devices.
//
// Why: `doorMergeMenuOverlayWithCloud` let the LOCAL copy of a (week, day) always beat
// the cloud copy. Two devices then kept overwriting each other with whatever they each
// held: the W1 TUE lunch side flipped "Parsnip and Carrot" <-> "Seasonal Vegetables" on
// every publish from 2026-09-21 to 2026-09-24 (DOOR commits 995a346 / 403ea7c / 3d34eaf /
// 0e1c395 / 40909c0), and EXPO's board followed whichever device published last.
//
// Fix: a real menu edit stamps its day in `_meta.dayEditedAt["<week>|<DAY>"]`; the merge
// takes the day with the newer stamp (a stamped day beats an unstamped, pre-stamp one).
// Two unstamped copies keep the old rule (local wins), so nothing changes until someone
// edits — and that one edit then converges every device. An automatic sweep never stamps.
//
// Authored-to-fail against origin/main (40909c0): doorStampOverlayEdits does not exist and
// the merge ignores stamps.
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
  assert.ok(s >= 0 && e > s, 'publish-validation core block');
  const c = { Array, JSON, Object, Number, isFinite };
  vm.createContext(c);
  vm.runInContext(html.slice(s, e), c, { timeout: 1000 });
  return c;
}

function fnBlock(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'could not find function ' + name);
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return html.slice(start, i);
}

const C = core();
const META = () => ({ ...C.doorNormalizeMenuOverlay({})._meta });
const PARSNIP = { lunch: 'Blackened fish, Sweet potatoes, Parsnip and Carrot' };
const SEASONAL = { lunch: 'Blackened fish, Sweet potatoes, Seasonal Vegetables' };
const ov = (day, stamp) => ({
  _meta: { ...META(), ...(stamp != null ? { dayEditedAt: { '1|TUESDAY': stamp } } : {}) },
  '1': { TUESDAY: { ...day } },
});

test('a cloud day edited more recently than the local copy wins', () => {
  const r = C.doorMergeMenuOverlayWithCloud(ov(SEASONAL, 100), ov(PARSNIP, 200));
  assert.equal(r.merged['1'].TUESDAY.lunch, PARSNIP.lunch);
  assert.equal(r.merged._meta.dayEditedAt['1|TUESDAY'], 200, 'the winning stamp travels with the day');
  assert.equal(r.adoptedCount, 1, 'the adoption is counted, not silent');
});

test('a local day edited more recently than the cloud copy wins', () => {
  const r = C.doorMergeMenuOverlayWithCloud(ov(PARSNIP, 300), ov(SEASONAL, 200));
  assert.equal(r.merged['1'].TUESDAY.lunch, PARSNIP.lunch);
  assert.equal(r.merged._meta.dayEditedAt['1|TUESDAY'], 300);
  assert.equal(r.adoptedCount, 0);
});

test('a stamped edit beats an unstamped (pre-stamp) copy, from either side', () => {
  const a = C.doorMergeMenuOverlayWithCloud(ov(SEASONAL, null), ov(PARSNIP, 5));
  assert.equal(a.merged['1'].TUESDAY.lunch, PARSNIP.lunch, 'stamped cloud beats unstamped local');
  const b = C.doorMergeMenuOverlayWithCloud(ov(PARSNIP, 5), ov(SEASONAL, null));
  assert.equal(b.merged['1'].TUESDAY.lunch, PARSNIP.lunch, 'stamped local beats unstamped cloud');
});

test('two unstamped copies keep the old rule: local wins (nothing moves until an edit)', () => {
  const r = C.doorMergeMenuOverlayWithCloud(ov(SEASONAL, null), ov(PARSNIP, null));
  assert.equal(r.merged['1'].TUESDAY.lunch, SEASONAL.lunch);
  assert.equal(r.adoptedCount, 0);
});

test('stamps for other days are kept from both sides', () => {
  const local = ov(PARSNIP, 10); local._meta.dayEditedAt['2|FRIDAY'] = 7; local['2'] = { FRIDAY: { lunch: 'L' } };
  const cloud = ov(PARSNIP, 10); cloud._meta.dayEditedAt['3|MONDAY'] = 9; cloud['3'] = { MONDAY: { lunch: 'C' } };
  const r = C.doorMergeMenuOverlayWithCloud(local, cloud);
  assert.equal(r.merged._meta.dayEditedAt['2|FRIDAY'], 7);
  assert.equal(r.merged._meta.dayEditedAt['3|MONDAY'], 9);
  assert.equal(r.merged['3'].MONDAY.lunch, 'C');
});

test('doorStampOverlayEdits stamps only the days that changed', () => {
  assert.equal(typeof C.doorStampOverlayEdits, 'function', 'doorStampOverlayEdits exists in the testable core');
  const prev = { _meta: { ...META(), dayEditedAt: { '2|FRIDAY': 4 } }, '1': { TUESDAY: { ...SEASONAL } }, '2': { FRIDAY: { lunch: 'x' } } };
  const next = { _meta: { ...META() }, '1': { TUESDAY: { ...PARSNIP } }, '2': { FRIDAY: { lunch: 'x' } }, '4': { SUNDAY: { lunch: 'new' } } };
  const out = C.doorStampOverlayEdits(prev, next, 1000);
  assert.equal(out._meta.dayEditedAt['1|TUESDAY'], 1000, 'changed day stamped');
  assert.equal(out._meta.dayEditedAt['4|SUNDAY'], 1000, 'new day stamped');
  assert.equal(out._meta.dayEditedAt['2|FRIDAY'], 4, 'untouched day keeps its stamp');
});

test('the Parsnip scenario converges: a stale device adopts the stamped edit, then publishes it', () => {
  // Device A still holds the old unstamped Seasonal Vegetables edit; device B's Parsnip
  // edit is stamped. A's boot sync merges the cloud, then A's publish pre-merge runs again.
  const aLocal = ov(SEASONAL, null);
  const cloud = ov(PARSNIP, 1727190000000);
  const afterSync = C.doorMergeMenuOverlayWithCloud(aLocal, cloud).merged;
  const toPush = C.doorMergeMenuOverlayWithCloud(afterSync, cloud).merged;
  assert.equal(toPush['1'].TUESDAY.lunch, PARSNIP.lunch);
});

test('real edits stamp; the automatic flag sweep never does', () => {
  const save = fnBlock('saveMenuBaseOverlay');
  assert.match(save, /doorStampOverlayEdits\(/, 'saveMenuBaseOverlay stamps edited days');
  assert.match(save, /noStamp/, 'saveMenuBaseOverlay has a no-stamp path');
  const sweep = fnBlock('sweepAltFlagPollution');
  assert.match(sweep, /saveMenuBaseOverlay\(overlay,\s*\{\s*noStamp:\s*true\s*\}\)/, 'the sweep saves without stamping');
});
