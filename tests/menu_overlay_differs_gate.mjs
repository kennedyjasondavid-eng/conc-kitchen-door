// P4 (EXPO_DISH_EDIT_STREAMLINE_PLAN_2026-09-24.md §3 P4) — say when this computer's menu disagrees
// with the published one.
//
// After the boot / sync merge, a menu day both sides have that still differs, and whose local copy is
// NOT a newer edit (the pre-stamp case: both unstamped, local kept), is a disagreement: sending from
// here would overwrite the other computer's version (the W1 TUE Parsnip flip). Menu Config shows one
// calm line naming the days, with "Use the published one". A newer local edit is only unpublished and
// is not listed.
//
// Authored-to-fail against the #106 branch head (5bfce68): none of these functions exist.
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
  const c = { Array, JSON, Object, Number, isFinite };
  vm.createContext(c);
  vm.runInContext(html.slice(s, e), c, { timeout: 1000 });
  return c;
}
function fnBlock(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'could not find function ' + name);
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}') { depth--; if (depth === 0) { i++; break; } } }
  return html.slice(start, i);
}

const C = core();
const META = () => ({ ...C.doorNormalizeMenuOverlay({})._meta });
const PARSNIP = { lunch: 'Blackened fish, Sweet potatoes, Parsnip and Carrot' };
const SEASONAL = { lunch: 'Blackened fish, Sweet potatoes, Seasonal Vegetables' };
const ov = (day, stamp) => ({ _meta: { ...META(), ...(stamp != null ? { dayEditedAt: { '1|TUESDAY': stamp } } : {}) }, '1': { TUESDAY: { ...day } } });

test('two unstamped copies that differ: listed (sending from here would overwrite the other)', () => {
  const local = ov(SEASONAL), cloud = ov(PARSNIP);
  const merged = C.doorMergeMenuOverlayWithCloud(local, cloud).merged;
  assert.equal(merged['1'].TUESDAY.lunch, SEASONAL.lunch, 'precondition: legacy rule keeps local');
  assert.deepEqual(JSON.parse(JSON.stringify(C.doorOverlayDaysDifferingFromCloud(merged, cloud))), [{ week: '1', day: 'TUESDAY' }]);
});

test('a newer local edit is not listed — it is only unpublished', () => {
  const local = ov(SEASONAL, 300), cloud = ov(PARSNIP, 200);
  const merged = C.doorMergeMenuOverlayWithCloud(local, cloud).merged;
  assert.equal(C.doorOverlayDaysDifferingFromCloud(merged, cloud).length, 0);
});

test('a newer cloud edit is adopted by the merge, so nothing differs', () => {
  const local = ov(SEASONAL, 100), cloud = ov(PARSNIP, 200);
  const merged = C.doorMergeMenuOverlayWithCloud(local, cloud).merged;
  assert.equal(C.doorOverlayDaysDifferingFromCloud(merged, cloud).length, 0);
});

test('matching copies and local-only days are not listed', () => {
  assert.equal(C.doorOverlayDaysDifferingFromCloud(ov(PARSNIP), ov(PARSNIP)).length, 0);
  const localOnly = { _meta: META(), '2': { MONDAY: { lunch: 'x' } } };
  assert.equal(C.doorOverlayDaysDifferingFromCloud(localOnly, { _meta: META() }).length, 0);
});

test('"Use the published one" takes the published day with its stamp, writes locally only, and clears the line', () => {
  const store = { concMenuBase: JSON.stringify(ov(SEASONAL)) };
  const calls = { side: 0, toast: '', render: 0 };
  const el = { style: {}, innerHTML: '' };
  const c = {
    Array, JSON, Object, Number, isFinite, String,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    document: { getElementById: id => (id === 'mc-overlay-diff-banner' ? el : null) },
    PublishAuth: { sidePublish: () => { calls.side++; } },
    showToast: t => { calls.toast = t; },
    renderMenuConfig: () => { calls.render++; },
    escapeHtml: v => String(v).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]),
  };
  vm.createContext(c);
  const s = html.indexOf('/* DOOR_TESTABLE_CORE_START publish-validation */');
  const e = html.indexOf('/* DOOR_TESTABLE_CORE_END publish-validation */');
  vm.runInContext(html.slice(s, e), c);
  vm.runInContext(['let _doorOverlayCloudDiff = { days: [], cloud: null };', fnBlock('loadMenuBaseOverlay'), fnBlock('doorRecordOverlayCloudDiff'), fnBlock('renderOverlayDiffBanner'), fnBlock('doorUsePublishedMenuDays'),
    'this.__get = () => _doorOverlayCloudDiff;'].join('\n'), c);
  const cloud = ov(PARSNIP); cloud._meta.dayEditedAt = { '1|TUESDAY': 0 };
  const merged = C.doorMergeMenuOverlayWithCloud(ov(SEASONAL), ov(PARSNIP)).merged;
  const days = c.doorRecordOverlayCloudDiff(merged, ov(PARSNIP));
  assert.equal(days.length, 1);
  assert.equal(el.style.display, 'block', 'the line shows on Menu Config');
  assert.match(el.innerHTML, /differs from the published menu on 1 day \(Wk1 TUE\)/);
  assert.match(el.innerHTML, /Use the published one/);
  assert.equal(c.doorUsePublishedMenuDays(), 1);
  assert.equal(JSON.parse(store.concMenuBase)['1'].TUESDAY.lunch, PARSNIP.lunch, 'the published day is now this computer’s copy');
  assert.equal(calls.side, 0, 'nothing is sent — the copy already matches the published file');
  assert.equal(el.style.display, 'none', 'the line clears');
  assert.equal(calls.render, 1, 'Menu Config re-renders');
  assert.match(calls.toast, /published menu for 1 day/);
});

test('the boot fetch and the sync pull both record the disagreement; Menu Config renders the line', () => {
  assert.equal((html.match(/doorRecordOverlayCloudDiff\(mergeResult\.merged, (remote|d)\);/g) || []).length, 2);
  assert.ok(/renderMenuSourceBanner\(\);\n  renderOverlayDiffBanner\(\);/.test(html));
  assert.ok(html.includes('id="mc-overlay-diff-banner"'));
});
