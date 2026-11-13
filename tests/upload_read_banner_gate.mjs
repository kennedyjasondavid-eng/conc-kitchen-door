// tests/upload_read_banner_gate.mjs — a menu upload says which week, dates and tab it read, and warns when the file
// name says otherwise (Week4_Setup_Friction_Notes_2026-11-11.md item 3, 2026-11-13).
// Prevents: picking the wrong one of two near-identical files (the 4-week workbook and a one-tab copy) and getting a
// plausible review of the wrong week with nothing on screen to say so.
// Fixed examples only (never the live menu): made-up workbooks shaped like SheetJS's, and a fixed "today".
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
function core() {
  const ctx = { console };
  vm.createContext(ctx);
  const s = html.indexOf('/* DOOR_TESTABLE_CORE_START rex-week */');
  const e = html.indexOf('/* DOOR_TESTABLE_CORE_END rex-week */');
  vm.runInContext(html.slice(s, e) + '\n' + fnBlock('getSundayStart') + '\n' + fnBlock('doorRotationWeekOf') +
    '\nthis.api = { doorUploadReadCheck, doorCycleWeekOfKey, doorCycleWeekDates, doorFileNameWeek, doorRotationWeekOf, DOOR_CYCLE_ANCHOR };', ctx);
  return ctx.api;
}
const C = (() => { try { return core(); } catch (e) { return { err: e }; } })();
const TODAY = '2026-11-13';   // a Friday in Week 3; Nov 15–21 is Week 4

test('the cycle: anchor 2026-06-07 is Week 1, and every week agrees with DOOR\'s rotation', () => {
  assert.ok(!C.err, 'the rex-week core defines the upload check: ' + (C.err && C.err.message));
  assert.equal(C.DOOR_CYCLE_ANCHOR, '2026-06-07');
  assert.equal(C.doorCycleWeekOfKey('2026-06-07'), 1);
  assert.equal(C.doorCycleWeekOfKey('2026-06-28'), 4, 'Jun 28–Jul 4 is Week 4 (the ledger)');
  assert.equal(C.doorCycleWeekOfKey('2026-07-05'), 1, 'and Jul 5 wraps to Week 1');
  assert.equal(C.doorCycleWeekOfKey('2026-11-21'), 4, 'Saturday stays in its week');
  for (let i = -40; i < 80; i++) {
    const d = new Date(2026, 5, 7 + i * 3, 12);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    assert.equal(C.doorCycleWeekOfKey(key), C.doorRotationWeekOf(d), key);
  }
  assert.deepEqual(out(C.doorCycleWeekDates(4, TODAY)), { start: '2026-11-15', end: '2026-11-21' });
  assert.deepEqual(out(C.doorCycleWeekDates(3, TODAY)), { start: '2026-11-08', end: '2026-11-14' }, 'the current week counts');
  assert.deepEqual(out(C.doorCycleWeekDates(1, TODAY)), { start: '2026-11-22', end: '2026-11-28' });
});

test('the week a file name names', () => {
  assert.ok(!C.err, String(C.err));
  assert.equal(C.doorFileNameWeek('Week 4 18 Oct - 24 Oct.xlsx'), 4);
  assert.equal(C.doorFileNameWeek('Week 1 - Menu Oct 25 - Oct 31 -.xlsx'), 1);
  assert.equal(C.doorFileNameWeek('Wk2_menu.xlsx'), 2);
  assert.equal(C.doorFileNameWeek('Week4 Kitchen (Mod) only.xlsx'), 4);
  assert.equal(C.doorFileNameWeek('4_week_rotation-CURRENT-Menus_as_of_July_22_2026.xlsx'), null, 'a 4-week workbook names no week');
  assert.equal(C.doorFileNameWeek('Week 12 menu.xlsx'), null);
  assert.equal(C.doorFileNameWeek('menu.xlsx'), null);
});

test('Rex\'s week sheet: the right file reads plainly, the wrong one warns', () => {
  assert.ok(!C.err, String(C.err));
  const ok = out(C.doorUploadReadCheck({ kind: 'rex', fileName: 'Week 4 15 Nov - 21 Nov.xlsx', today: TODAY,
    weeks: [{ week: 4, start: '2026-11-15', tabs: ['Week 4 Kitchen (Mod)'] }] }));
  assert.equal(ok.title, 'Week 4 · Nov 15 – Nov 21');
  assert.deepEqual(ok.weeks[0].tabs, ['Week 4 Kitchen (Mod)']);
  assert.deepEqual(ok.warnings, []);
  // A file named for Week 4 read as Week 1 (the friction log's case).
  const wrong = out(C.doorUploadReadCheck({ kind: 'rex', fileName: 'Week 4 15 Nov - 21 Nov.xlsx', today: TODAY,
    weeks: [{ week: 1, start: '2026-11-22', tabs: ['Week 1 Kitchen'] }] }));
  assert.equal(wrong.title, 'Week 1 · Nov 22 – Nov 28');
  assert.equal(wrong.warnings.length, 2);
  assert.match(wrong.warnings[0], /file name says Week 4, but DOOR read Week 1 from the tab “Week 1 Kitchen”/);
  assert.match(wrong.warnings[1], /week of Nov 15 – Nov 21, which is Week 4 in DOOR’s cycle, but DOOR read Week 1/);
  // Right week, but the review set to another turn of it.
  const moved = out(C.doorUploadReadCheck({ kind: 'rex', fileName: 'Week 4 15 Nov - 21 Nov.xlsx', today: TODAY,
    weeks: [{ week: 4, start: '2026-12-13', tabs: ['Week 4'] }] }));
  assert.deepEqual(moved.warnings, ['The file name says the week of Nov 15 – Nov 21, but this review is set to Dec 13 – Dec 19.']);
  // No week or date in the name: nothing to compare, nothing warned.
  assert.deepEqual(out(C.doorUploadReadCheck({ kind: 'rex', fileName: 'rex menu.xlsx', today: TODAY, weeks: [{ week: 2, tabs: ['Sheet1'] }] })).warnings, []);
});

// SheetJS-shaped workbooks: sheet names, the saved-on tab, and each sheet's rows as its own name (stubbed reader).
const wb = (names, activeTab) => ({ SheetNames: names, Sheets: Object.fromEntries(names.map(n => [n, n])), Workbook: { Views: [{ activeTab: activeTab || 0 }] } });
const FOUR = ['Week 1 Kitchen', 'Week 1 Intake', 'Week 2 Kitchen', 'Week 2 Intake', 'Week 3 Kitchen', 'Week 3 Intake', 'Week 4 Kitchen', 'Week 4 Intake', 'Week 4 Kitchen (Mod)'];
function parseWb(book) {
  const ctx = {
    book,
    XLSX: { utils: { sheet_to_json: (sheet) => [[sheet]] } },
    parseMenuFromSheetRows: (sheets) => {   // stand-in: a week is "read" when it has a tab; the real parser is tested elsewhere
      const menu = {}, sheetsUsed = {};
      Object.keys(sheets).forEach(wk => { const s = sheets[wk]; if (s.kitchen || s.intake) { menu[wk] = {}; sheetsUsed[wk] = { kitchen: !!s.kitchen, intake: !!s.intake }; } });
      return { menu, divergences: [], sheetsUsed };
    },
  };
  vm.createContext(ctx);
  vm.runInContext(fnBlock('parseMenuWorkbook') + '\nthis.r = parseMenuWorkbook(this.book);', ctx);
  return out(ctx.r);
}
const rotationCheck = (fileName, parsed) => out(C.doorUploadReadCheck({ kind: 'rotation', fileName, today: TODAY,
  weeks: Object.keys(parsed.menu).map(wk => ({ week: Number(wk), tabs: (parsed.tabs || {})[wk] })) }));

test('Menu Config upload: names each week\'s tabs and dates; a one-tab copy says it holds only that week', () => {
  assert.ok(!C.err, String(C.err));
  const four = parseWb(wb(FOUR, 8));
  assert.deepEqual(four.tabs, { 1: ['Week 1 Kitchen', 'Week 1 Intake'], 2: ['Week 2 Kitchen', 'Week 2 Intake'], 3: ['Week 3 Kitchen', 'Week 3 Intake'], 4: ['Week 4 Kitchen (Mod)', 'Week 4 Intake'] });
  const c4 = rotationCheck('4_week_rotation-CURRENT-Menus_as_of_Nov_11_2026.xlsx', four);
  assert.equal(c4.title, 'Weeks 1–4');
  assert.deepEqual(c4.weeks.map(w => w.dates), ['Nov 22 – Nov 28', 'Nov 29 – Dec 5', 'Nov 8 – Nov 14', 'Nov 15 – Nov 21']);
  assert.deepEqual(c4.warnings, []);
  // The one-tab copy, picked by mistake in Menu Config.
  const c1 = rotationCheck('Week 4 Kitchen (Mod) only.xlsx', parseWb(wb(['Week 4 Kitchen (Mod)'])));
  assert.equal(c1.title, 'Week 4 · Nov 15 – Nov 21');
  assert.equal(c1.warnings.length, 1);
  assert.match(c1.warnings[0], /holds only Week 4\. Applying it replaces the whole 4-week rotation/);
  // A file named for Week 4 that holds a Week 1 tab.
  const c1b = rotationCheck('Week 4 15 Nov - 21 Nov.xlsx', parseWb(wb(['Week 1 Kitchen'])));
  assert.match(c1b.warnings[0], /file name says Week 4, but DOOR read Week 1 from the tab “Week 1 Kitchen”/);
  assert.match(c1b.warnings[1], /which is Week 4 in DOOR’s cycle, but DOOR read Week 1/);
  // A 4-week workbook named for one week replaces all four: said, not blocked.
  const c4b = rotationCheck('Week 4 menu.xlsx', four);
  assert.deepEqual(c4b.warnings, ['The file name says Week 4, but this file holds Weeks 1–4, and applying it replaces all of them.']);
});

test('both reviews show it at the top, in large type, escaped, and a warning never blocks', () => {
  assert.ok(!C.err, String(C.err));
  const ctx = { escapeHtml: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') };
  vm.createContext(ctx);
  vm.runInContext(fnBlock('doorUploadReadHTML') + '\nthis.f = doorUploadReadHTML;', ctx);
  const check = C.doorUploadReadCheck({ kind: 'rex', fileName: 'Week 4 <b>.xlsx', today: TODAY, weeks: [{ week: 1, tabs: ['<img src=x>'] }] });
  const h = ctx.f(check, 'Week 4 <b>.xlsx', '3 tabs in the file');
  assert.match(h, /font-size:24px;font-weight:800;[^>]*>Week 1 · Nov 22 – Nov 28</, 'the week and dates in large type');
  assert.match(h, /Read from the tab “&lt;img src=x&gt;”/, 'the tab, escaped');
  assert.ok(!/<img|<b>/.test(h), 'nothing from the file is markup');
  assert.match(h, /class="door-upload-warning" role="alert"[^>]*>⚠ The file name says Week 4/);
  const rex = fnBlock('doorRenderRexWeekReview');
  const body = rex.indexOf('class="modal-body"');
  assert.ok(body > 0 && rex.indexOf("doorUploadReadHTML(doorUploadReadCheck({ kind: 'rex'") > body, 'Rex\'s review opens with it');
  assert.ok(rex.indexOf('doorUploadReadHTML(') < rex.indexOf('rex-week-start'), 'above the week picker');
  assert.match(rex, /weeks: \[\{ week: R\.rex\.week, start: R\.start, tabs: \[R\.rex\.sheetName\] \}\]/, 'with the dates being reviewed');
  assert.match(rex, /id="rex-week-save"' \+ \(ask\.length \|\| auto\.length \? '' : ' disabled'\)/, 'Save is unchanged by a warning');
  const up = fnBlock('showMenuUploadReview');
  assert.match(up, /doorUploadReadHTML\(doorUploadReadCheck\(\{ kind: 'rotation'/, 'the Menu Config upload too');
  assert.ok(up.indexOf('doorUploadReadHTML(') < up.indexOf('summary.join'), 'at the top');
  assert.match(up, /id="menu-upload-confirm-btn">Apply New Menu</, 'Apply stays available');
});

test('the build stamp moved', () => {
  assert.match(html, /const DOOR_APP_VERSION = 'v31-standard\.69';/);
});
