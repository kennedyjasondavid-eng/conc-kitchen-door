// 2026-10-08 (Jason: "follow your leans, go ahead with 1, 2 and 3"): the last browser confirm() boxes in DOOR
// move to DOOR's own dialog (doorAsk). Same reasons as the Save and Daily Entry passes (save_dialog_styled_gate,
// daily_entry_ask_gate): confirm() blocks the page, looks unlike the rest of DOOR, and an automated browser can
// silently dismiss it.
//
// Ten questions across nine places:
//   publish path  — the registry preflight (kitchen has a newer resident list), send from an out-of-date page,
//                   send despite a data problem, Disconnect;
//   menu screens  — make permanent (edit panel and Active Swaps banner), revert a swap or permanent change,
//                   clear all swaps, remove a special meal, reset an edited menu meal.
//
// The registry preflight had two buttons where Cancel meant "send this computer's OLDER list". With doorAsk,
// Escape and a click outside mean go back, so the older list is now its own button and going back sends nothing.
//
// Authored-to-fail against pre-slice origin/main: every one of these places calls confirm(), the file still has
// confirm() calls in code, and the preflight has no way to stop the publish.
// DOOR_GATE_HTML=<path> runs the gate against another copy of index.html.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(process.env.DOOR_GATE_HTML || path.join(root, 'index.html'), 'utf8');

function blockFrom(start) {
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return html.slice(start, i);
}
function fnBlock(name) {
  const m = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(html);
  assert.ok(m, 'could not find function ' + name);
  return blockFrom(m.index);
}
function methodBlock(name) {
  const m = new RegExp('\\n\\s*(?:async\\s+)?' + name + '\\s*\\([^)]*\\)\\s*\\{').exec(html);
  assert.ok(m, 'could not find method ' + name);
  return blockFrom(m.index);
}
const code = (src) => src.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
const nativeConfirm = /(^|[^.\w$])confirm\s*\(/;

const ASKS = {
  doorRegistryPublishPreflight: 1,
  _doPublishToGitHub: 2,
  makePermanent: 1,
  revertMealSwap: 1,
  clearAllSwaps: 1,
  makeSwapPermanentFromBanner: 1,
  removeSpecialMeal: 1,
  revertMenuEdit: 1,
};

test('1. each question asks through doorAsk, and the function waits for the answer', () => {
  for (const [name, n] of Object.entries(ASKS)) {
    const fn = fnBlock(name);
    assert.match(fn, new RegExp('^async\\s+function\\s+' + name + '\\s*\\('), name + ' waits for the answer');
    assert.equal((fn.match(/await doorAsk\(/g) || []).length, n, name + ' asks ' + n + ' question(s) through doorAsk');
    assert.ok(!nativeConfirm.test(code(fn)), 'no confirm() in ' + name);
  }
  const forget = methodBlock('forgetToken');
  assert.match(forget, /^\s*async\s+forgetToken\s*\(/, 'Disconnect waits for the answer');
  assert.match(forget, /await doorAsk\(/, 'Disconnect asks through doorAsk');
  assert.ok(!nativeConfirm.test(code(forget)), 'no confirm() in Disconnect');
});

test('2. no browser confirm() is left anywhere in DOOR', () => {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
  const lines = code(scripts).split('\n').filter(l => nativeConfirm.test(l));
  assert.deepEqual(lines.map(l => l.trim()), [], 'no confirm( calls in code');
});

test('3. every doorAsk here names its title and both buttons', () => {
  const blocks = Object.keys(ASKS).map(fnBlock).concat([methodBlock('forgetToken')]);
  for (const fn of blocks) {
    const calls = fn.match(/await doorAsk\(\{[\s\S]*?\}\)/g) || [];
    for (const c of calls) {
      assert.match(c, /title:/, 'a title: ' + c.slice(0, 60));
      assert.match(c, /goLabel:/, 'a go button: ' + c.slice(0, 60));
      assert.match(c, /cancelLabel:/, 'a go-back button: ' + c.slice(0, 60));
    }
  }
});

// The preflight's three answers: use the kitchen's list, send this computer's older list, or go back.
function preflight(answer) {
  const calls = { pull: [], asked: [] };
  const sb = {
    console, calls,
    getRegistryProvenanceTs: () => new Date('2026-05-20T12:00:00Z').getTime(),
    doorFetchRemoteRegistryMeta: async () => ({ registryModifiedAt: '2026-09-11T12:19:54.146Z' }),
    pullStateFromGitHub: async (m) => { calls.pull.push(m); },
    doorAsk: async (o) => { calls.asked.push(o); return answer; },
  };
  vm.createContext(sb);
  vm.runInContext(fnBlock('doorRegistryPublishGate') + '\n' + fnBlock('doorRegistryPublishPreflight'), sb);
  return sb;
}

test('4. registry preflight: a separate button sends the older list; Go back sends nothing', async () => {
  const use = preflight(true);
  const r1 = await vm.runInContext('doorRegistryPublishPreflight(true)', use);
  assert.equal(r1.adopted, true, 'the kitchen list is used');
  assert.equal(use.calls.pull.length, 1);
  const ask = use.calls.asked[0];
  assert.ok(ask.altLabel, 'a third button for the older list');
  assert.match(ask.altLabel, /older/i);

  const older = preflight('alt');
  const r2 = await vm.runInContext('doorRegistryPublishPreflight(true)', older);
  assert.equal(r2.forced, true, 'the older list is sent on purpose');
  assert.equal(older.calls.pull.length, 0);

  const back = preflight(false);
  const r3 = await vm.runInContext('doorRegistryPublishPreflight(true)', back);
  assert.equal(r3.cancelled, true, 'Go back stops the publish');
  assert.equal(r3.forced, false, 'Go back never sends the older list');
  assert.equal(back.calls.pull.length, 0);

  const pub = fnBlock('_doPublishToGitHub');
  assert.match(pub, /_registryPreflight\.cancelled[\s\S]{0,400}return\s*\{\s*skipped\s*:\s*true/, 'a cancelled preflight sends nothing');
});

test('5. doorAsk can offer a third button that answers "alt"', () => {
  const ask = fnBlock('doorAsk');
  assert.match(ask, /altLabel/, 'doorAsk reads altLabel');
  assert.match(ask, /finish\(\s*'alt'\s*\)/, 'the third button answers "alt"');
});

function runRemoveSpecial(answer) {
  const store = { meals: { '2026-10-10-dinner': { specialName: 'BBQ' } } };
  const ctx = vm.createContext({ answer, store, rendered: 0 });
  vm.runInContext(
    'function loadSpecialMeals() { return store.meals; } function saveSpecialMeals(m) { store.meals = m; }' +
    'function renderMenuConfig() { rendered++; }' +
    'async function doorAsk() { return answer; }' +
    fnBlock('removeSpecialMeal') + ';globalThis.run = removeSpecialMeal;', ctx);
  return ctx;
}

test('6. remove a special meal: Go back keeps it, Remove removes it', async () => {
  const keep = runRemoveSpecial(false);
  await keep.run('2026-10-10-dinner');
  assert.ok('2026-10-10-dinner' in keep.store.meals, 'Go back keeps the special meal');
  const remove = runRemoveSpecial(true);
  await remove.run('2026-10-10-dinner');
  assert.ok(!('2026-10-10-dinner' in remove.store.meals), 'Remove removes it');
});

function runClearSwaps(answer) {
  const ctx = vm.createContext({ answer, saved: null, REVERTED: [] });
  vm.runInContext(
    'let mealSwaps = { "1-MONDAY-lunch": {} };' +
    'const REVERTED_SWAP_KEYS = { add: k => REVERTED.push(k) };' +
    'function loadMealSwaps() { return { "2099-01-01-lunch": { specialName: "x" } }; }' +
    'function saveMealSwaps(s) { saved = s; } function logMenuEvent() {} function renderMenuConfig() {}' +
    'function alert() {}' +
    'async function doorAsk() { return answer; }' +
    fnBlock('clearAllSwaps') + ';globalThis.run = clearAllSwaps; globalThis.swaps = () => mealSwaps;', ctx);
  return ctx;
}

test('7. clear all swaps: Go back changes nothing, Clear swaps clears them', async () => {
  const keep = runClearSwaps(false);
  await keep.run();
  assert.equal(keep.saved, null, 'nothing saved');
  assert.equal(Object.keys(keep.swaps()).length, 1, 'session swap kept');
  const clear = runClearSwaps(true);
  await clear.run();
  assert.equal(Object.keys(clear.saved).length, 0, 'saved swaps cleared');
  assert.equal(Object.keys(clear.swaps()).length, 0);
});

test('8. the menu screens re-check the open meal after the answer', () => {
  for (const name of ['makePermanent', 'revertMealSwap']) {
    assert.match(fnBlock(name), /await doorAsk\([\s\S]*?\}\);?[\s\S]{0,200}mcEditKey\s*!==/, name + ' stops if another meal is open');
  }
  assert.match(fnBlock('revertMenuEdit'), /await doorAsk\([\s\S]*?\}\);?[\s\S]{0,200}mcMenuEditKey\s*!==/, 'revertMenuEdit stops if another meal is open');
});
