// G1, the DOOR site guard, in the real page (conc-kitchen-house HOUSE_MULTI_SITE_MENUS_PLAN_2026-11-18 §6). With
// Lansdowne picked, every write action refuses in words, no storage key changes, nothing is sent (the publisher and every
// GitHub write are spied on), a send skips as other_site and the outbox keeps it. Switched back to Rexdale, the same
// actions work as before. Made-up residents only; the published menu and overlay; network blocked. Authored red on main.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { pathToFileURL } from 'node:url';
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(path.resolve('../conc-kitchen-expo/package.json'))('playwright'); }
const { chromium } = pw;
const source = path.resolve(process.env.DOOR_GATE_HTML || 'index.html');
const results = [], errors = [];
const check = (name, pass, detail) => { results.push({ name, pass: !!pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (!pass ? ' ' + JSON.stringify(detail).slice(0, 700) : '')); };
const menu = JSON.parse(fs.readFileSync('menu_current.json', 'utf8')).menu;
const overlay = JSON.parse(fs.readFileSync('menu_overlay.json', 'utf8'));
const COPY = 'DOOR’s published menu and resident list are Rexdale’s. Switch to Rexdale to change them. Other sites’ menus come later.';
const browser = await chromium.launch();
const writes = [];
const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
p.on('pageerror', (e) => errors.push(e.message));
p.on('dialog', async (d) => { await d.accept(); });
await p.route(/^https?:/, (r) => { const m = r.request().method(); if (m !== 'GET' && m !== 'HEAD') writes.push(m + ' ' + r.request().url()); return r.abort(); });
await p.addInitScript(({ m, o }) => {
  if (sessionStorage.getItem('_s')) return; sessionStorage.setItem('_s', '1');
  localStorage.setItem('concUploadedMenu', JSON.stringify(m)); localStorage.setItem('concMenuBase', JSON.stringify(o));
  localStorage.setItem('concAltFlagSweepV1', 'done'); localStorage.setItem('concOperatorName', 'QA');
  const d = new Date(Date.now() + 9 * 864e5), key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  localStorage.setItem('concMealSwaps', JSON.stringify({ [key + '-lunch']: { specialName: 'Audit Swap', veg: '', allergens: [] } }));
  localStorage.setItem('concSpecialMeals', JSON.stringify({ [key + '-dinner']: { specialName: 'Audit Special', veg: '', allergens: [] } }));
  window.Chart = function () { return { destroy() {}, update() {} }; };
}, { m: menu, o: overlay });
await p.goto(pathToFileURL(source).href);
await p.waitForFunction(() => typeof openMenuEdit === 'function');
await p.waitForTimeout(800);
try {
  // Made-up residents (no real room or name), then Lansdowne.
  await p.evaluate(() => {
    REGISTRY_LIST.splice(0, REGISTRY_LIST.length,
      { room: '9101', name: 'Test Resident A', tags: ['Regular'], rawRestriction: 'Regular', section: 'Regular', history: [{ date: '2026-01-01', change: 'x' }] },
      { room: '9102', name: 'Test Resident B', tags: ['GF'], rawRestriction: 'GF', section: 'Gluten Free', history: [] });
    REGISTRY_LIST.forEach((r) => { REGISTRY_MAP[r.room.toLowerCase()] = r; });
    window.doorAsk = async () => true;
    window.__toasts = []; const t = window.showToast; window.showToast = (m) => { window.__toasts.push(String(m)); };
    window.__pub = []; const real = window._doPublishToGitHub;
    window._doPublishToGitHub = async (manual) => { const e = { manual, r: null }; window.__pub.push(e); e.r = await real(manual); return e.r; };
    selectSite('lansdowne');
  });
  const banner = await p.evaluate(() => { const el = document.getElementById('door-site-guard-banner'); return { shown: el && el.style.display === 'block', text: el ? el.textContent : '', refused: el && el.hasAttribute('data-refused') }; });
  check('Lansdowne picked: a quiet banner says why, not red', banner.shown && banner.text.includes(COPY) && !banner.refused, banner);
  // Every write action, refused in words; nothing in storage changes; nothing is sent.
  const run = await p.evaluate(async () => {
    const snap = () => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; };
    const before = snap();
    const keys = []; const realSafe = window.doorSetItemSafe; window.doorSetItemSafe = (k, v) => { keys.push(k); return realSafe(k, v); };
    const swapKey = Object.keys(loadMealSwaps())[0], specialKey = Object.keys(loadSpecialMeals())[0];
    const acts = {
      saveMenuEdit: () => { openMenuEdit(1, 'MONDAY', 'lunch'); return saveMenuEdit(); },
      // Re-pinned 2026-11-19 (Edit Menu redesign S6b, D5): the meal panel's saveEditFlags, makePermanent, revertMealSwap
      // and applyMealSwap are retired. Their writes moved to the meal view: the every-week write (_finishMenuSave), the
      // one-date change (doorSaveJustOn, chosen with doorSetSaveWhen('date')), Put back the original (revertMenuEdit) and
      // the banner's Revert (revertSwapFromBanner).
      everyWeekSave: () => { openMenuEdit(1, 'MONDAY', 'lunch'); return _finishMenuSave('Audit Lunch', '', {}); },
      oneDateSave: () => { openMenuEdit(1, 'MONDAY', 'lunch'); doorSetSaveWhen('date'); try { return _finishMenuSave('Audit Lunch', '', {}); } finally { doorSetSaveWhen('week'); } },
      makeSwapPermanentFromBanner: () => makeSwapPermanentFromBanner(swapKey),
      revertMenuEdit: () => revertMenuEdit(), revertSwapFromBanner: () => revertSwapFromBanner(swapKey),
      clearAllSwaps: () => clearAllSwaps(), clearPastSpecials: () => clearPastSpecials(),
      saveSpecialMeal: () => saveSpecialMeal(), removeSpecialMeal: () => removeSpecialMeal(specialKey), enterSlotSwapMode: () => enterSlotSwapMode(),
      executeSlotSwap: () => executeSlotSwap({ week: 1, day: 'MONDAY', period: 'lunch' }, { week: 1, day: 'TUESDAY', period: 'lunch' }),
      publishMenuFromConfig: () => publishMenuFromConfig(), doorUsePublishedMenuDays: () => doorUsePublishedMenuDays(), revertLastChange: () => revertLastChange(),
      triggerRexWeekUpload: () => triggerRexWeekUpload(), doorSaveRexWeek: () => doorSaveRexWeek(), triggerMenuUpload: () => triggerMenuUpload(),
      doorApplyMenuUpload: () => doorApplyMenuUpload(getMenuData(), null), addChange: () => addChange(), saveChangeEdit: () => saveChangeEdit(),
      removeFromQueue: () => removeFromQueue('x'), clearQueue: () => clearQueue(), generateFiles: () => generateFiles(), revertLastGenerate: () => revertLastGenerate(),
      commitImportToQueue: () => commitImportToQueue(), addToIntakeQueue: () => addToIntakeQueue(), commitIntakeQueue: () => commitIntakeQueue(),
      saveDirectFromForm: () => saveDirectFromForm(), addAnaphRoom: () => { const i = document.getElementById('anaph-input'); if (i) i.value = '9101'; return addAnaphRoom(); },
      removeAnaphRoom: () => removeAnaphRoom('9101'), saveInlineNote: () => saveInlineNote('9101'), batchConfirmCompliance: () => batchConfirmCompliance(),
      batchSetDeadline: () => batchSetDeadline(), /* batchResolveCompliance retired 2026-11-22, compliance C1 */ submitResolve: () => submitResolve(),
      reopenComplianceItem: () => reopenComplianceItem('9101'), updateComplianceField: () => updateComplianceField('9101', 'moderateNote', 'x'),
      revertResident: () => revertResident('9101', 0), confirmRevertResidentFromEditor: () => confirmRevertResidentFromEditor('9101', 0),
      seedRegistryFromRoster: () => seedRegistryFromRoster([{ room: '9103', name: 'Test C', rawRestriction: 'Regular' }]),
      nrAddPending: () => nrAddPending('9101', 's'), nrAddAmbiguous: () => nrAddAmbiguous('9101', 's', 'n', 'c'), nrRemovePending: () => nrRemovePending('9101', 0),
      nrDoneReview: () => nrDoneReview('9101'), nrUndoReview: () => nrUndoReview('9101'),
      doorRulesAddWord: () => doorRulesAddWord('menu'), doorRulesTakeBackWord: () => doorRulesTakeBackWord('menu', 'x'), doorRulesAddLead: () => doorRulesAddLead(),
      doorRulesRemoveLead: () => doorRulesRemoveLead('x'), doorRulesUndo: () => doorRulesUndo(), doorPlatesAddRule: () => doorPlatesAddRule('trigger'),
      doorPlatesTakeBackRule: () => doorPlatesTakeBackRule('x'),
      openUploadDialog: () => openUploadDialog(), handleImportFile: () => handleImportFile(new File(['Room,Restriction\n9101,GF'], 'list.csv')),
    };
    const out = {};
    for (const [name, fn] of Object.entries(acts)) {
      const t0 = window.__toasts.length; let res, err = null;
      try { res = await fn(); } catch (e) { err = String(e && e.message || e); }
      const said = window.__toasts.slice(t0).some((m) => m.includes('Switch to Rexdale to change them'));
      out[name] = { said, err, res: res && typeof res === 'object' ? res.ok : res };
    }
    if (typeof closeMenuEdit === 'function') closeMenuEdit(true);
    const after = snap();
    const changed = Object.keys(Object.assign({}, before, after)).filter((k) => before[k] !== after[k] && k !== 'conc_selected_site');
    window.doorSetItemSafe = realSafe;
    return { out, changed, keys, pub: window.__pub.length };
  });
  const silent = Object.entries(run.out).filter(([, v]) => !v.said).map(([k, v]) => k + (v.err ? ' (' + v.err + ')' : ''));
  check('every write action refuses in words (' + Object.keys(run.out).length + ' actions)', silent.length === 0, silent);
  check('no storage key changes', run.changed.length === 0 && run.keys.length === 0, { changed: run.changed, keys: run.keys });
  check('nothing is sent: the publisher is never called by a refused action, and no GitHub write is made', run.pub === 0 && writes.length === 0, { pub: run.pub, writes });
  const refusedBanner = await p.evaluate(() => document.getElementById('door-site-guard-banner').hasAttribute('data-refused'));
  check('after a refusal the banner turns red', refusedBanner, refusedBanner);
  // A send while another site is picked: skipped as other_site, kept in the outbox, nothing written.
  const send = await p.evaluate(async () => {
    const before = doorOutboxRead().length;
    await publishAndSync('audit send');
    const drained = doorOutboxDrain('audit');
    const list = doorOutboxRead();
    return { before, after: list.length, reason: list.length ? list[list.length - 1].reason : null, last: window.__pub[window.__pub.length - 1], drained };
  });
  check('a send skips as other_site and the outbox keeps it; the drain sends nothing', send.after === send.before + 1 && send.reason === 'other_site'
    && send.last && send.last.r && send.last.r.reason === 'other_site' && send.drained === 0 && writes.length === 0, send);
  // Review fold (P3-1): on to another site, the banner is quiet again.
  const bloor = await p.evaluate(() => { selectSite('bloor'); const el = document.getElementById('door-site-guard-banner'); return { refused: el.hasAttribute('data-refused'), color: el.style.color, text: el.textContent }; });
  check('on to another site after a refusal, the banner is quiet again', !bloor.refused && bloor.color === '' && /Bloor/.test(bloor.text), bloor);
  // Back to Rexdale: the same actions work as before.
  const back = await p.evaluate(async () => {
    const drains = []; const realDrain = window.doorOutboxDrain; window.doorOutboxDrain = (t) => { drains.push(t); return realDrain(t); };
    selectSite('rexdale');
    window.doorOutboxDrain = realDrain;
    const drainedOnSwitch = drains.includes('site');   // review fold P3-2: what waited is sent (this page has no key, so nothing goes out)
    const skipCleared = !(JSON.parse(localStorage.getItem('concLastPublishSkip') || 'null') || {}).reason || JSON.parse(localStorage.getItem('concLastPublishSkip')).reason !== 'other_site';
    const banner = document.getElementById('door-site-guard-banner').style.display;
    const swapsBefore = Object.keys(loadMealSwaps()).length;
    await clearAllSwaps();
    const swapsAfter = Object.keys(loadMealSwaps()).length;
    const i = document.getElementById('anaph-input'); if (i) i.value = '9102';
    await addAnaphRoom();
    const anaph = anaphRooms.includes('9102');
    const pubBefore = window.__pub.length;
    await publishMenuFromConfig().catch(() => {});
    const special = Object.keys(loadSpecialMeals())[0];
    await removeSpecialMeal(special);
    return { drainedOnSwitch, skipCleared, banner, swapsBefore, swapsAfter, anaph, published: window.__pub.length > pubBefore, specialGone: !loadSpecialMeals()[special],
      skip: (window.__pub[window.__pub.length - 1] || {}).r };
  });
  check('Rexdale: the banner goes', back.banner === 'none', back);
  check('Rexdale: the other-site skip is cleared and the outbox is sent', back.skipCleared && back.drainedOnSwitch, back);
  check('Rexdale: clearing swaps, the anaphylactic list and removing a special meal work as before', back.swapsAfter < back.swapsBefore && back.anaph && back.specialGone, back);
  check('Rexdale: sending reaches the publisher and is not skipped as another site', back.published && !(back.skip && back.skip.reason === 'other_site'), back);
  // Review fold (P2-1): a computer saved to Lansdowne is guarded from the first moment of the page, before the picker.
  const q = await browser.newPage();
  await q.route(/^https?:/, (r) => { const m = r.request().method(); if (m !== 'GET' && m !== 'HEAD') writes.push(m + ' ' + r.request().url()); return r.abort(); });
  await q.addInitScript(() => {
    if (sessionStorage.getItem('_b')) return; sessionStorage.setItem('_b', '1');
    localStorage.setItem('conc_selected_site', 'lansdowne');
    document.addEventListener('DOMContentLoaded', () => { try { window.__earlyEditable = doorSiteEditable(); window.__earlySite = typeof currentSite !== 'undefined' && currentSite ? currentSite.key : null; } catch (e) { window.__earlyEditable = 'err ' + e.message; } });
    window.Chart = function () { return { destroy() {}, update() {} }; };
  });
  await q.goto(pathToFileURL(source).href);
  await q.waitForFunction(() => typeof openMenuEdit === 'function');
  const early = await q.evaluate(() => ({ editable: window.__earlyEditable, site: window.__earlySite }));
  check('saved to Lansdowne: guarded before the picker is set up (boot sends refused)', early.editable === false && !early.site, early);
  await q.close();
  check('no GitHub write at any point', writes.length === 0, writes);
  check('no uncaught browser errors', errors.length === 0, errors);
} finally { await browser.close(); }
const failed = results.filter((r) => !r.pass).length;
console.log((results.length - failed) + '/' + results.length + ' passed');
if (failed) process.exit(1);
