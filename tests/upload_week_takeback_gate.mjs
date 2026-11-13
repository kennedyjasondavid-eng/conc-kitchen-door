// tests/upload_week_takeback_gate.mjs — a menu upload that replaces a week takes that week's Edit Menu days back on
// every DOOR computer (v31-standard.71; Jason, 2026-11-13: "yes go ahead", the gap #192 found).
// Prevents: computer A replaces Week 4 from a file and clears its Edit Menu days; computer B, still holding older
// Week 4 edits, merges with the kitchen's overlay at its next send and adds them back, so the replaced week quietly
// regains old edits on every computer, and at the next publish in EXPO and HUB.
// Fixed examples only (never the live menu): made-up menus and overlays, DOOR's real apply, save, stamp and merge, on
// two stand-in computers that share one kitchen copy of menu_overlay.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/\r\n?/g, '\n');
function fnBlock(name) {
  const m = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(html);
  assert.ok(m, 'missing function ' + name);
  let d = 0, i = html.indexOf('{', m.index);
  for (; i < html.length; i++) { if (html[i] === '{') d++; else if (html[i] === '}' && --d === 0) break; }
  return html.slice(m.index, i + 1);
}
function coreBlock(name) {
  const s = html.indexOf('/* DOOR_TESTABLE_CORE_START ' + name + ' */');
  const e = html.indexOf('/* DOOR_TESTABLE_CORE_END ' + name + ' */');
  assert.ok(s >= 0 && e > s, 'missing core ' + name);
  return html.slice(s, e);
}

// The kitchen's copy of menu_overlay.json, shared by both computers.
function kitchen() { return { file: null }; }

// One DOOR computer: the overlay cores, DOOR's real overlay load/save and upload apply, and a clock it controls.
// A save's side send writes the kitchen copy (as PublishAuth.sidePublish does once it lands).
function computer(K) {
  const store = {};
  const ctx = {
    console,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    PublishAuth: { sidePublish: (name, text) => { if (name === 'menu_overlay.json') K.file = JSON.parse(text); } },
    _store: store,
  };
  vm.createContext(ctx);
  vm.runInContext(coreBlock('publish-validation') + '\n' + coreBlock('rex-week') + '\n' +
    fnBlock('loadMenuBaseOverlay') + '\n' + fnBlock('saveMenuBaseOverlay') + '\n' +
    fnBlock('loadUploadedMenu') + '\n' + fnBlock('saveUploadedMenu') + '\n' + fnBlock('doorApplyMenuUpload') + '\n' +
    'var __now = 0; Date.now = function () { return __now; };\n' +
    'this.api = { loadMenuBaseOverlay, saveMenuBaseOverlay, doorApplyMenuUpload, doorMergeMenuOverlayWithCloud, doorNormalizeMenuOverlay };', ctx);
  const api = ctx.api;
  return {
    ctx, api, store,
    at(ms) { vm.runInContext('__now = ' + ms + ';', ctx); return this; },
    overlay() { return JSON.parse(JSON.stringify(api.loadMenuBaseOverlay())); },
    // An Edit Menu save of one meal, through DOOR's real save (stamps the day, sends the overlay).
    edit(wk, day, field, text) { const o = api.loadMenuBaseOverlay(); o[wk] = o[wk] || {}; o[wk][day] = Object.assign({}, o[wk][day], { [field]: text }); api.saveMenuBaseOverlay(o); },
    // A sync or send: the kitchen copy merged into this computer's, saved here, and the merge sent back (as the boot
    // sync and the publish pre-merge do).
    sync() { const r = api.doorMergeMenuOverlayWithCloud(api.loadMenuBaseOverlay(), K.file); store.concMenuBase = JSON.stringify(r.merged); K.file = JSON.parse(JSON.stringify(r.merged)); return r; },
  };
}

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
function week(tag, wk) { const w = {}; DAYS.forEach(d => { w[d] = { lunch: tag + ' W' + wk + ' ' + d + ' lunch', dinner: tag + ' W' + wk + ' ' + d + ' dinner' }; }); return w; }
const OLD = { 1: week('Old', 1), 2: week('Old', 2), 3: week('Old', 3), 4: week('Old', 4) };
const FILE_W4 = { 4: week('Mod', 4) };   // a one-tab file: only Week 4

// Two computers on the old rotation, with Edit Menu changes on Weeks 2 and 4 made on B before the upload, and both in
// step with the kitchen's overlay.
function twoComputers() {
  const K = kitchen();
  const A = computer(K), B = computer(K);
  [A, B].forEach(c => { c.store.concUploadedMenu = JSON.stringify(OLD); });
  B.at(1000).edit('4', 'FRIDAY', 'dinner', 'B edited W4 FRIDAY dinner');
  B.at(1100).edit('4', 'MONDAY', 'lunch', 'B edited W4 MONDAY lunch');
  B.at(1200).edit('2', 'MONDAY', 'lunch', 'B edited W2 MONDAY lunch');
  A.at(1300).sync();
  return { K, A, B };
}
const w4Days = (o) => Object.keys(o['4'] || {}).slice();

test('1. A replaces Week 4; B, still holding its older Week 4 edits, merges and sends; Week 4 stays as A\'s file', () => {
  const { K, A, B } = twoComputers();
  assert.deepEqual(w4Days(A.overlay()).sort(), ['FRIDAY', 'MONDAY'], 'A starts with B\'s Week 4 edits');
  const r = A.at(5000).api.doorApplyMenuUpload(FILE_W4, { 4: 4 });
  assert.equal(r.ok, true);
  assert.deepEqual(w4Days(A.overlay()), [], 'A clears its Week 4 days');
  assert.deepEqual(w4Days(K.file), [], 'the kitchen copy has no Week 4 days');
  assert.equal(K.file._meta.weekReplacedAt['4'], 5000, 'the kitchen copy says when Week 4 was replaced');

  // B never saw the upload: it still holds both old Week 4 days (and its Week 2 edit), and now syncs and sends.
  assert.deepEqual(w4Days(B.overlay()).sort(), ['FRIDAY', 'MONDAY']);
  B.at(6000).sync();
  assert.deepEqual(w4Days(K.file), [], 'B\'s send does not put old Week 4 edits back in the kitchen copy');
  assert.deepEqual(w4Days(B.overlay()), [], 'B drops its old Week 4 edits too');
  assert.equal(B.overlay()['2'].MONDAY.lunch, 'B edited W2 MONDAY lunch', 'a week the upload did not replace keeps its edits');
  assert.ok(!('4|FRIDAY' in (K.file._meta.dayEditedAt || {})), 'the dropped day\'s stamp goes with it');

  // A syncs again: Week 4 is still exactly A's file.
  A.at(7000).sync();
  assert.deepEqual(w4Days(A.overlay()), []);
  assert.equal(JSON.parse(A.store.concUploadedMenu)['4'].FRIDAY.dinner, 'Mod W4 FRIDAY dinner');
});

test('2. a B edit to Week 4 made after the replacement survives, on every computer', () => {
  const { K, A, B } = twoComputers();
  A.at(5000).api.doorApplyMenuUpload(FILE_W4, { 4: 4 });
  B.at(6000).sync();
  B.at(8000).edit('4', 'TUESDAY', 'dinner', 'B new W4 TUESDAY dinner');
  B.at(8100).sync();
  assert.equal(K.file['4'].TUESDAY.dinner, 'B new W4 TUESDAY dinner', 'the kitchen copy keeps the new edit');
  A.at(9000).sync();
  assert.deepEqual(w4Days(A.overlay()), ['TUESDAY'], 'A takes the new edit and nothing older');
  assert.equal(A.overlay()['4'].TUESDAY.dinner, 'B new W4 TUESDAY dinner');
});

test('3. a computer with a slow clock: its edit after it has seen the replacement still counts', () => {
  const { K, A, B } = twoComputers();
  A.at(5000).api.doorApplyMenuUpload(FILE_W4, { 4: 4 });
  B.at(4000).sync();   // B's clock reads earlier than A's upload
  B.at(4100).edit('4', 'SUNDAY', 'lunch', 'B slow-clock W4 SUNDAY lunch');
  assert.ok(B.overlay()._meta.dayEditedAt['4|SUNDAY'] > 5000, 'the edit is stamped after the replacement');
  B.at(4200).sync();
  A.at(9000).sync();
  assert.equal(A.overlay()['4'].SUNDAY.lunch, 'B slow-clock W4 SUNDAY lunch');
});

test('4. B\'s old edits are dropped whichever side holds the replacement, and an old unstamped day too', () => {
  const { K, A, B } = twoComputers();
  // An unstamped Week 4 day on B (an overlay from before day stamps).
  const o = JSON.parse(B.store.concMenuBase); o['4'].WEDNESDAY = { lunch: 'B unstamped W4 WEDNESDAY' }; B.store.concMenuBase = JSON.stringify(o);
  A.at(5000).api.doorApplyMenuUpload(FILE_W4, { 4: 4 });
  // Merge with B as the local side (B syncing) and with B as the cloud side (A reading B's file).
  const asLocal = B.api.doorMergeMenuOverlayWithCloud(JSON.parse(B.store.concMenuBase), K.file).merged;
  const asCloud = A.api.doorMergeMenuOverlayWithCloud(A.overlay(), JSON.parse(B.store.concMenuBase)).merged;
  assert.deepEqual(w4Days(asLocal), []);
  assert.deepEqual(w4Days(asCloud), []);
  assert.equal(asCloud._meta.weekReplacedAt['4'], 5000, 'A keeps its replacement over B\'s file, which has none');
});

test('5. a 4-week upload takes back every week on every computer; the newest replacement per week wins', () => {
  const { K, A, B } = twoComputers();
  const r = A.at(5000).api.doorApplyMenuUpload({ 1: week('New', 1), 2: week('New', 2), 3: week('New', 3), 4: week('New', 4) }, null);
  assert.equal(r.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(K.file._meta.weekReplacedAt)), { 1: 5000, 2: 5000, 3: 5000, 4: 5000 });
  B.at(6000).sync();
  ['1', '2', '3', '4'].forEach(w => assert.ok(!K.file[w] || !Object.keys(K.file[w]).length, 'Week ' + w + ' has no old edits'));
  const m = A.api.doorMergeMenuOverlayWithCloud(
    { _meta: { standardCutover: K.file._meta.standardCutover, weekReplacedAt: { 4: 7000 } } },
    { _meta: { standardCutover: K.file._meta.standardCutover, weekReplacedAt: { 4: 5000, 2: 6000 } } }).merged;
  assert.deepEqual(JSON.parse(JSON.stringify(m._meta.weekReplacedAt)), { 2: 6000, 4: 7000 });
});

test('6. an overlay with no replacement merges exactly as before', () => {
  const K = kitchen(); const A = computer(K);
  const cut = A.api.doorNormalizeMenuOverlay({})._meta.standardCutover;
  const local = { _meta: { standardCutover: cut, dayEditedAt: { '4|FRIDAY': 100 } }, 4: { FRIDAY: { dinner: 'L' } } };
  const cloud = { _meta: { standardCutover: cut, dayEditedAt: { '4|FRIDAY': 200 } }, 4: { FRIDAY: { dinner: 'C' } }, 1: { MONDAY: { lunch: 'C1' } } };
  const m = A.api.doorMergeMenuOverlayWithCloud(local, cloud).merged;
  assert.equal(m['4'].FRIDAY.dinner, 'C');
  assert.equal(m['1'].MONDAY.lunch, 'C1');
  assert.ok(!('weekReplacedAt' in m._meta));
});
