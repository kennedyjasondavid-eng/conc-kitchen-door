// tests/one_week_upload_merge_gate.mjs — a menu upload with fewer than 4 weeks asks which rotation week each of its weeks
// is, and replaces only those (v31-standard.70; Jason, 2026-11-13: "Can we have DOOR ask on a 1 week upload which week
// and then merge it thusly?").
// Prevents: a one-tab copy (only Week 4) applied in Menu Config replacing all four weeks of the rotation with one, so
// Weeks 1–3 vanish from DOOR and, at the next publish, from EXPO and HUB.
// Fixed examples only (never the live menu): made-up workbooks run through DOOR's real workbook reader and parser, and
// DOOR's real apply on a stand-in localStorage.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/\r\n?/g, '\n');
const out = (v) => JSON.parse(JSON.stringify(v));
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

// One sandbox: the menu-parse and rex-week cores, the workbook reader, and the upload apply with its storage helpers.
// saveMenuBaseOverlay / loadMenuBaseOverlay are stand-ins (their stamping and cloud send are tested elsewhere).
function sandbox() {
  const store = {};
  const ctx = {
    console, Array, Object, String, RegExp, JSON, Number, Math,
    _store: store,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    XLSX: { utils: { sheet_to_json: (rows) => rows } },
    overlaySaves: [],
  };
  vm.createContext(ctx);
  vm.runInContext(coreBlock('menu-parse') + '\n' + coreBlock('rex-week') + '\n' +
    fnBlock('parseMenuWorkbook') + '\n' + fnBlock('loadUploadedMenu') + '\n' + fnBlock('saveUploadedMenu') + '\n' +
    fnBlock('doorApplyMenuUpload') + '\n' +
    'function loadMenuBaseOverlay() { return JSON.parse(localStorage.getItem("concMenuBase") || "{}"); }\n' +
    'function saveMenuBaseOverlay(o) { overlaySaves.push(o); localStorage.setItem("concMenuBase", JSON.stringify(o)); }\n' +
    'this.api = { parseMenuWorkbook, doorApplyMenuUpload, doorMergeUploadWeeks, doorUploadAssignCheck, doorUploadPartialSentence, doorOverlayWithoutWeeks, doorUploadReadCheck };', ctx);
  return ctx;
}

// A made-up Kitchen sheet for one week: every lunch and dinner names its week and a tag, so each week is unmistakable.
const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
function kitchen(wk, tag) {
  const row = (label, f) => [label].concat(DAYS.map((d, i) => f(d, i)));
  return [
    ['WEEK ' + wk].concat(DAYS),
    row('BREAKFAST', (d) => tag + ' W' + wk + ' ' + d + ' Oatmeal'),
    row('Vegetarian', (d) => tag + ' W' + wk + ' ' + d + ' Vegan Oatmeal'),
    row('LUNCH', (d) => tag + ' W' + wk + ' ' + d + ' Chicken Wrap, Side Salad'),
    row('Vegetarian', (d) => tag + ' W' + wk + ' ' + d + ' Chickpea Wrap, Side Salad'),
    row('DINNER', (d) => tag + ' W' + wk + ' ' + d + ' Beef Stew, Rice'),
    row('Vegetarian', (d) => tag + ' W' + wk + ' ' + d + ' Bean Stew, Rice'),
    row('Halal option', () => ''),
  ];
}
// SheetJS-shaped workbook: the stand-in sheet_to_json returns the sheet itself as its rows.
const book = (sheets) => ({ SheetNames: Object.keys(sheets), Sheets: sheets, Workbook: { Views: [{ activeTab: 0 }] } });
const FOUR_OLD = book({ 'Week 1 Kitchen': kitchen(1, 'Old'), 'Week 2 Kitchen': kitchen(2, 'Old'), 'Week 3 Kitchen': kitchen(3, 'Old'), 'Week 4 Kitchen': kitchen(4, 'Old') });
const FOUR_NEW = book({ 'Week 1 Kitchen': kitchen(1, 'New'), 'Week 2 Kitchen': kitchen(2, 'New'), 'Week 3 Kitchen': kitchen(3, 'New'), 'Week 4 Kitchen': kitchen(4, 'New') });
const ONE_W4 = book({ 'Week 4 Kitchen (Mod)': kitchen(4, 'Mod') });   // the one-tab copy of the friction log

// A computer holding a full rotation (the old workbook) plus Edit Menu changes on Weeks 2 and 4.
function computerWithRotation(S) {
  const base = S.api.parseMenuWorkbook(FOUR_OLD).menu;
  S._store.concUploadedMenu = JSON.stringify(base);
  S._store.concMenuBase = JSON.stringify({ _meta: { standardCutover: 'x' }, '2': { MONDAY: { lunch: 'Edited W2 lunch' } }, '4': { FRIDAY: { dinner: 'Edited W4 dinner' } } });
  return base;
}
const weekJSON = (menu, wk) => JSON.stringify(menu[wk]);

test('the sentence the review shows, and which assignments are allowed', () => {
  const S = sandbox().api;
  assert.equal(S.doorUploadPartialSentence(['4'], {}), 'Apply replaces Week 4 only; Weeks 1–3 stay as they are.');
  assert.equal(S.doorUploadPartialSentence(['4'], { 4: 2 }), 'Week 4 in this file goes in as rotation Week 2. Apply replaces Week 2 only; Weeks 1, 3 and 4 stay as they are.');
  assert.equal(S.doorUploadPartialSentence(['1', '3'], {}), 'Apply replaces Weeks 1 and 3 only; Weeks 2 and 4 stay as they are.');
  assert.equal(S.doorUploadPartialSentence(['1', '2', '3'], {}), 'Apply replaces Weeks 1–3 only; Week 4 stays as it is.');
  const dup = out(S.doorUploadAssignCheck(['1', '3'], { 1: 2, 3: 2 }));
  assert.equal(dup.ok, false);
  assert.match(dup.error, /Two weeks in this file are set to rotation Week 2/);
  assert.equal(S.doorUploadAssignCheck(['4'], { 4: 5 }).ok, false, 'only Weeks 1–4');
  // The #191 banner says it plainly, not as a red warning.
  const c = out(S.doorUploadReadCheck({ kind: 'rotation', fileName: 'Week 4 Kitchen (Mod) only.xlsx', today: '2026-11-13', weeks: [{ week: 4, tabs: ['Week 4 Kitchen (Mod)'] }] }));
  assert.deepEqual(c.warnings, []);
  assert.equal(c.notice, 'Apply replaces Week 4 only; Weeks 1–3 stay as they are.');
  assert.ok(!/replaces the whole 4-week rotation/.test(html), 'the old "replaces the whole rotation" warning is gone');
});

test('a one-week file applied as Week 4 changes only Week 4; Weeks 1–3 stay byte for byte, with their edits', () => {
  const S = sandbox();
  const base = computerWithRotation(S);
  const before = S._store.concUploadedMenu;
  const file = S.api.parseMenuWorkbook(ONE_W4);
  assert.deepEqual(Object.keys(file.menu), ['4'], 'the one-tab copy holds Week 4 only');
  const res = out(S.api.doorApplyMenuUpload(file.menu, { 4: 4 }));
  assert.deepEqual(res, { ok: true, partial: true, replaced: [4], kept: [1, 2, 3] });
  const after = JSON.parse(S._store.concUploadedMenu);
  assert.deepEqual(Object.keys(after).sort(), ['1', '2', '3', '4'], 'still four weeks');
  for (const wk of ['1', '2', '3']) assert.equal(weekJSON(after, wk), weekJSON(JSON.parse(before), wk), 'Week ' + wk + ' byte-identical');
  assert.equal(weekJSON(after, '4'), weekJSON(file.menu, '4'), 'Week 4 is the file\'s');
  assert.match(after['4'].TUESDAY.lunch, /^Mod W4 TUESDAY Chicken Wrap/);
  assert.match(after['1'].TUESDAY.lunch, /^Old W1 TUESDAY/);
  assert.notEqual(weekJSON(after, '4'), weekJSON(base, '4'));
  // Edits: Week 2's stay, Week 4's go (they were on the meals the upload replaced).
  const ov = JSON.parse(S._store.concMenuBase);
  assert.deepEqual(ov['2'], { MONDAY: { lunch: 'Edited W2 lunch' } });
  assert.equal(ov['4'], undefined);
  assert.deepEqual(ov._meta, { standardCutover: 'x' });
});

test('the week can be changed: a file\'s Week 4 put in as Week 2 replaces Week 2 only', () => {
  const S = sandbox();
  computerWithRotation(S);
  const before = JSON.parse(S._store.concUploadedMenu);
  const file = S.api.parseMenuWorkbook(ONE_W4);
  const res = out(S.api.doorApplyMenuUpload(file.menu, { 4: 2 }));
  assert.deepEqual(res.replaced, [2]);
  const after = JSON.parse(S._store.concUploadedMenu);
  for (const wk of ['1', '3', '4']) assert.equal(weekJSON(after, wk), weekJSON(before, wk), 'Week ' + wk + ' byte-identical');
  assert.equal(weekJSON(after, '2'), weekJSON(file.menu, '4'));
  const ov = JSON.parse(S._store.concMenuBase);
  assert.equal(ov['2'], undefined, 'Week 2\'s edits go');
  assert.deepEqual(ov['4'], { FRIDAY: { dinner: 'Edited W4 dinner' } }, 'Week 4\'s stay');
});

test('a 4-week file still replaces all four and clears every edit', () => {
  const S = sandbox();
  computerWithRotation(S);
  const file = S.api.parseMenuWorkbook(FOUR_NEW);
  assert.deepEqual(Object.keys(file.menu), ['1', '2', '3', '4']);
  const res = out(S.api.doorApplyMenuUpload(file.menu, null));
  assert.equal(res.ok, true); assert.equal(res.partial, false);
  assert.equal(S._store.concUploadedMenu, JSON.stringify(file.menu));
  for (const wk of ['1', '2', '3', '4']) assert.match(JSON.parse(S._store.concUploadedMenu)[wk].MONDAY.dinner, /^New W/);
  assert.deepEqual(out(S.overlaySaves), [{}]);
});

test('no full menu on this computer: a one-week file is refused out loud, nothing written', () => {
  const S = sandbox();
  const file = S.api.parseMenuWorkbook(ONE_W4);
  const res = out(S.api.doorApplyMenuUpload(file.menu, { 4: 4 }));
  assert.equal(res.ok, false);
  assert.match(res.error, /doesn’t have the kitchen’s full menu yet/);
  assert.equal(S._store.concUploadedMenu, undefined);
  assert.equal(S.overlaySaves.length, 0);
  // Two of the file's weeks on one rotation week: refused, nothing written.
  const S2 = sandbox();
  computerWithRotation(S2);
  const two = S2.api.parseMenuWorkbook(book({ 'Week 1 Kitchen': kitchen(1, 'Two'), 'Week 3 Kitchen': kitchen(3, 'Two') }));
  const before = S2._store.concUploadedMenu;
  assert.equal(S2.api.doorApplyMenuUpload(two.menu, { 1: 3, 3: 3 }).ok, false);
  assert.equal(S2._store.concUploadedMenu, before);
  // The pure merge never touches its inputs.
  const baseCopy = JSON.stringify(JSON.parse(before));
  const fileCopy = JSON.stringify(two.menu);
  S2.api.doorMergeUploadWeeks(JSON.parse(before), two.menu, { 1: 1, 3: 3 });
  assert.equal(JSON.stringify(two.menu), fileCopy);
  assert.equal(JSON.stringify(JSON.parse(before)), baseCopy);
});

test('the review asks which week (pre-picked to the week read), says what Apply does and that Publish sends it', () => {
  const up = fnBlock('showMenuUploadReview');
  assert.match(up, /const partial = fileWeeks\.length < 4;/);
  assert.match(up, /\$\{partial \? doorUploadWeekPickerHTML\(fileWeeks\) : ''\}/, 'the picker, only for a partial file');
  assert.match(up, /const assign = partial \? doorUploadPickedWeeks\(modal, fileWeeks\) : null;\s*const res = doorApplyMenuUpload\(finalMenu, assign\);/, 'Apply merges a partial file');
  assert.match(up, /This will replace the current 4-week rotation\./, 'a 4-week file reads as before');
  assert.match(up, /Press <strong>⇪ Publish<\/strong> afterwards to send it to the kitchen/);
  assert.ok(!/saveUploadedMenu\(finalMenu\)/.test(up), 'Apply no longer writes the file as the whole base itself');
  const ctx = { escapeHtml: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;') };
  vm.createContext(ctx);
  vm.runInContext(coreBlock('rex-week') + '\n' + fnBlock('doorUploadWeekPickerHTML') + '\nthis.f = doorUploadWeekPickerHTML;', ctx);
  const h = ctx.f(['4']);
  assert.match(h, /Which rotation week is this\?/);
  assert.match(h, /data-file-week="4"[^>]*>.*<option value="4" selected>Week 4<\/option>/);
  assert.equal((h.match(/ selected/g) || []).length, 1);
  assert.match(h, /Apply replaces Week 4 only; Weeks 1–3 stay as they are\./);
  assert.match(html, /const DOOR_APP_VERSION = 'v31-standard\.(7\d|[89]\d)';/, 'the build stamp moved');
});
