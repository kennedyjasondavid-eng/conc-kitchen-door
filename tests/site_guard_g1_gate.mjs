// G1, the DOOR site guard (conc-kitchen-house docs/HOUSE_MULTI_SITE_MENUS_PLAN_2026-11-18.md §2, §6). DOOR keeps one
// menu, resident list, routing, swaps, special meals and rules, all Rexdale's, under storage keys with no site in them,
// and stamps every published file rexdale. While the picker is on another site, every write to that data and every send
// is refused with one message (doorSiteGuard / doorSiteEditable); background sends skip with reason other_site and the
// outbox keeps the work. Rexdale is read through the HOUSE registry by key or alias, any case.
// The browser half (every action refused in words, no storage key changed, no file written; Rexdale works as before) is
// tests/browser/site_guard_g1.mjs, in CI. Authored-to-fail against main.
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
function constLine(name) {
  const m = new RegExp('const ' + name + ' = [^\\n]*').exec(html);
  assert.ok(m, 'could not find const ' + name);
  return m[0];
}
const REG = { schema: 1, sites: [{ key: 'rexdale', aliases: ['rex'], name: 'Rexdale' }, { key: 'lansdowne', aliases: ['lan'], name: 'Lansdowne' }, { key: 'bloor', aliases: ['854'], name: 'Bloor' }] };
function ctx() {
  const toasts = [];
  const banner = { style: {}, textContent: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } };
  const store = {};
  const c = { currentSite: null, doorHouseSitesNow: () => REG, store,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }, showToast: (m) => toasts.push(m), toasts, banner,
    document: { getElementById: (id) => (id === 'door-site-guard-banner' ? banner : null) } };
  vm.createContext(c);
  vm.runInContext([fnBlock('doorHouseSiteFor'), constLine('DOOR_EDITABLE_SITE_KEY'), constLine('DOOR_SITE_GUARD_COPY'),
    fnBlock('doorSiteEditable'), fnBlock('doorRenderSiteGuardBanner'), fnBlock('doorSiteGuard'),
    'this.pick = (s) => { currentSite = s; };'].join('\n'), c);
  return c;
}
const COPY = 'DOOR’s published menu and resident list are Rexdale’s. Switch to Rexdale to change them. Other sites’ menus come later.';

test('G1-1 Rexdale is editable however the record names it; every other site is not', () => {
  const c = ctx();
  assert.equal(c.doorSiteEditable(), true, 'no site picked yet: DOOR starts on Rexdale');
  for (const key of ['rexdale', 'Rexdale', 'REX', 'rex']) { c.pick({ key, name: 'x' }); assert.equal(c.doorSiteEditable(), true, key); }
  for (const key of ['lansdowne', 'lan', 'bloor', '854', 'unknown-site']) { c.pick({ key, name: 'x' }); assert.equal(c.doorSiteEditable(), false, key); }
  // Review fold (P2-1): before the picker is set up at load, the site saved on this computer counts.
  c.pick(null);
  c.store.conc_selected_site = 'lansdowne'; assert.equal(c.doorSiteEditable(), false, 'saved Lansdowne, picker not set up yet');
  c.store.conc_selected_site = 'rexdale'; assert.equal(c.doorSiteEditable(), true);
  c.store.conc_selected_site = 'unknown'; assert.equal(c.doorSiteEditable(), true, 'nothing saved: DOOR starts on Rexdale');
  c.SITE_CONFIGS = { rexdale: {}, lansdowne: {} };
  c.store.conc_selected_site = 'old-site'; assert.equal(c.doorSiteEditable(), true, 'a saved key DOOR has no details for falls back to Rexdale, as at load');
  c.store.conc_selected_site = 'lansdowne'; assert.equal(c.doorSiteEditable(), false);
});

test('G1-2 one message, from one place: a quiet banner while another site is picked, red only once refused', () => {
  const c = ctx();
  assert.equal(constLine('DOOR_SITE_GUARD_COPY'), 'const DOOR_SITE_GUARD_COPY = \'' + COPY + '\';');
  c.pick({ key: 'lansdowne', name: 'Lansdowne' });
  c.doorRenderSiteGuardBanner(false);
  assert.equal(c.banner.style.display, 'block');
  assert.match(c.banner.textContent, /^DOOR is set to Lansdowne\. DOOR’s published menu/);
  assert.equal(c.banner.attrs['data-refused'], undefined, 'no red until something is refused');
  assert.equal(c.doorSiteGuard(), false);
  assert.equal(c.toasts[0], 'Not saved. ' + COPY);
  assert.equal(c.banner.attrs['data-refused'], '1');
  // Review fold (P3-1): on to another site, the banner is quiet again.
  c.pick({ key: 'bloor', name: 'Bloor' });
  c.doorRenderSiteGuardBanner(false);
  assert.equal(c.banner.attrs['data-refused'], undefined); assert.equal(c.banner.style.color, '');
  assert.match(fnBlock('selectSite'), /if \(!_wasEditable && doorSiteEditable\(\)\) \{[\s\S]*doorOutboxDrain\('site'\)/, 'back on Rexdale, what waited is sent');
  c.pick({ key: 'rexdale', name: 'Rexdale' });
  assert.equal(c.doorSiteGuard(), true);
  c.doorRenderSiteGuardBanner(false);
  assert.equal(c.banner.style.display, 'none');
  assert.match(fnBlock('selectSite'), /doorRenderSiteGuardBanner\(false\);/);
  assert.match(html, /<div id="door-site-guard-banner" role="status"/);
});

// Every action that writes the menu, resident list, routing, swaps, special meals, rules or overlay, found through the
// code (callers of the storage writers and the publisher), refuses first.
// Re-pinned 2026-11-19 (Edit Menu redesign S6b, D5): saveEditFlags, makePermanent, revertMealSwap and applyMealSwap are
// retired with the meal panel. Their writes moved to _finishMenuSave (every week), doorSaveJustOn (one date, reached only
// through _finishMenuSave's guard, checked below), revertMenuEdit and revertSwapFromBanner, all guarded.
const GUARDED = ['saveMenuEdit', '_finishMenuSave', 'doorRepairMealTicks', 'doorWriteAnswersOnly',
  'makeSwapPermanentFromBanner', 'revertMenuEdit', 'revertSwapFromBanner', 'clearAllSwaps', 'clearPastSpecials',
  'saveSpecialMeal', 'removeSpecialMeal', 'enterSlotSwapMode', 'executeSlotSwap', 'publishMenuFromConfig', 'doorUsePublishedMenuDays', 'revertLastChange',
  'triggerRexWeekUpload', 'doorSaveRexWeek', 'triggerMenuUpload', 'addChange', 'saveChangeEdit', 'removeFromQueue', 'clearQueue', 'generateFiles',
  'revertLastGenerate', 'commitImportToQueue', 'addToIntakeQueue', 'commitIntakeQueue', 'saveDirectFromForm', 'addAnaphRoom', 'removeAnaphRoom',
  'saveInlineNote', 'batchConfirmCompliance', 'batchSetDeadline', 'batchResolveCompliance', 'submitResolve', 'reopenComplianceItem',
  'updateComplianceField', 'revertResident', 'confirmRevertResidentFromEditor', 'seedRegistryFromRoster', 'nrAddPending', 'nrAddAmbiguous',
  'nrRemovePending', 'nrDoneReview', 'nrUndoReview', 'doorRulesAddWord', 'doorRulesTakeBackWord', 'doorRulesAddLead', 'doorRulesRemoveLead',
  'doorRulesUndo', 'doorPlatesAddRule', 'doorPlatesTakeBackRule', 'openUploadDialog', 'handleImportFile'];
test('G1-3 every write action refuses first, before it reads a box or writes anything', () => {
  for (const name of GUARDED) {
    const body = fnBlock(name);
    const firstLine = body.split('\n')[1];
    assert.match(firstLine, /^\s*if \(typeof doorSiteGuard === 'function' && !doorSiteGuard\(\)\) return false;/, name);
  }
  // The one-date change: its only caller is _finishMenuSave, after the guard; nothing else calls it.
  const fin = fnBlock('_finishMenuSave');
  assert.ok(fin.indexOf('doorSiteGuard()') >= 0 && fin.indexOf('doorSiteGuard()') < fin.indexOf('return doorSaveJustOn('), 'the one-date change is refused first');
  assert.equal((html.match(/doorSaveJustOn\(/g) || []).length, 2, 'doorSaveJustOn: its definition and the one guarded call');
  assert.match(fnBlock('doorApplyMenuUpload').split('\n')[1], /!doorSiteEditable\(\)\) \{ doorSiteGuard\(\); return \{ ok: false, error: DOOR_SITE_GUARD_COPY \}; \}/);
});

test('G1-4 every send path: the publisher skips with other_site before any read, background sends keep the work', () => {
  const pub = fnBlock('_doPublishToGitHub');
  const skip = pub.indexOf("reason:'other_site'");
  assert.ok(skip > 0 && skip < pub.indexOf('PublishAuth.getCredentialsForManualPublish') && skip < pub.indexOf('doorPublishReadRevision'), 'skips before credentials or any read');
  assert.match(fnBlock('publishAndSync'), /doorOutboxAppend\(context, result\.reason\)/, 'a skip is kept in the outbox, never dropped');
  assert.match(fnBlock('publishAndSync'), /result\.reason === 'other_site' \? ' ' \+ DOOR_SITE_GUARD_COPY/);
  assert.match(fnBlock('doorOutboxDrain'), /!doorSiteEditable\(\)\) return 0;/, 'the drain sends nothing for another site and keeps the outbox');
  for (const f of ['ghPushFile', 'ghPushFilesAtomic']) assert.match(fnBlock(f).split('\n')[1], /!doorSiteEditable\(\)\) throw new Error\(DOOR_SITE_GUARD_COPY\)/, f);
  const sideAt = html.indexOf('  sidePublish(path, content, label, visible) {');
  const side = html.slice(sideAt, html.indexOf('return ghPushFile(creds, path, content)', sideAt));
  assert.match(side, /!doorSiteEditable\(\)\) \{[\s\S]{0,500}reason:'other_site'/, 'side publishes skip before ghPushFile');
  assert.match(constLine('DOOR_PUBLISH_SKIP_REASONS') + html.slice(html.indexOf('const DOOR_PUBLISH_SKIP_REASONS'), html.indexOf('const DOOR_PUBLISH_SKIP_REASONS') + 3000), /other_site:/);
});

test('G1-5 nothing published changes: the stamps still read rexdale, no schema or version moves', () => {
  assert.ok((html.match(/currentSite\.id\)\|\|'rexdale'/g) || []).length >= 5, 'published files stay stamped rexdale');
  assert.doesNotMatch(fnBlock('selectSite'), /concUploadedMenu|concMenuBase|concRegistryState|saveRegistry|publishAndSync/, 'the picker still changes paths and labels only');
});
