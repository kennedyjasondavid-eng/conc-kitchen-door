// The "Stale Allergen Flags" banner is retired (2026-10-08, v31-standard.16).
//
// The banner listed every overlay meal without a `<period>_slots` snapshot and told the
// operator to open Edit Menu, click each meal and save "to refresh". That instruction was
// a no-op for allergens:
//   1. The editor's flag grid opens with the meal's SAVED flags checked (saved value wins)
//      and saveMenuEdit ORs the checkboxes into the slot union, so a re-save only ever
//      ADDS flags — it never clears an alt-slot flag.
//   2. The cleanup (`sweepAltFlagPollution`, non-dry) is one-shot per device behind
//      `concAltFlagSweepV1`; after that it only dry-runs to count meals for the banner, so a
//      re-saved meal is never cleaned either.
//   3. The residual risk it named is OVER-flagging — the safe direction, and the standard
//      cutover's union-of-streams policy ("never under-flag") makes it intended.
// The only real consequence of a missing snapshot — no recipe link for EXPO — already has
// its own per-meal editor notice (`doorLegacySlotNoticeHTML`, "save to link").
//
// This gate pins: the banner and its state are gone; saving the overlay no longer dry-runs
// the sweep; the one-shot cleanup itself is untouched and still wired to load; and running
// it never mutates a slot-less meal's flags.
//
// Authored-to-fail against pre-slice index.html: tests 1–3 red, 4–5 green (characterize the
// cleanup this slice deliberately keeps).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

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

test('1. the banner, its element and its state are gone', () => {
  assert.ok(!html.includes('Stale Allergen Flags'), 'banner copy is gone');
  assert.ok(!html.includes('mc-stale-flags-banner'), 'banner element is gone');
  assert.ok(!html.includes('renderStaleFlagsBanner'), 'banner renderer is gone');
  assert.ok(!html.includes('_STALE_FLAG_MEALS'), 'banner state is gone');
});

test('2. saving the overlay no longer dry-runs the sweep to feed a banner', () => {
  const body = fnBlock('saveMenuBaseOverlay');
  assert.ok(!/sweepAltFlagPollution/.test(body), 'saveMenuBaseOverlay does not call the sweep');
  assert.ok(/localStorage\.setItem\('concMenuBase'/.test(body), 'it still writes the overlay');
  assert.ok(/sidePublish\('menu_overlay\.json'/.test(body), 'it still side-publishes the overlay');
});

test('3. the one-shot runner only cleans — it never dry-runs for a stale list', () => {
  const body = fnBlock('runAltFlagSweepOnce');
  assert.ok(!/dryRun:\s*true/.test(body), 'no dry-run once the sweep is done');
  assert.ok(!/re-save/.test(body), 'no "manual re-save" instruction, even in the console');
});

test('4. the one-shot cleanup itself is kept and still wired to load', () => {
  assert.ok(/function sweepAltFlagPollution\(/.test(html), 'sweep still defined');
  const body = fnBlock('runAltFlagSweepOnce');
  assert.ok(/ALT_FLAG_SWEEP_KEY/.test(body), 'still gated one-shot on concAltFlagSweepV1');
  assert.ok(/sweepAltFlagPollution\(\{\s*dryRun:\s*false\s*\}\)/.test(body), 'still runs the real cleanup once');
  assert.ok(/addEventListener\('load', runAltFlagSweepOnce\)/.test(html), 'still runs at load');
  // Edit Menu save still records the per-slot snapshot (the thing D1's notice keys on).
  assert.ok(/overlay\[week\]\[day\]\[period \+ '_slots'\] = _buildSlotSnapshot\(\)/.test(fnBlock('_finishMenuSave')));
});

test('5. running the cleanup never touches a slot-less meal, and needs no banner element', () => {
  const store = {
    concMenuBase: JSON.stringify({
      '1': { MONDAY: { lunch: 'Fish & Rice', lunch_flags: { hasFish: true, hasSoy: true } } },
    }),
  };
  const saved = [];
  const ctx = {
    console: { log() {}, warn() {}, table() {} },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
    },
    document: { getElementById: () => { throw new Error('runner must not touch the DOM'); } },
    loadMenuBaseOverlay: () => JSON.parse(store.concMenuBase),
    saveMenuBaseOverlay: o => saved.push(o),
  };
  vm.createContext(ctx);
  const src = [
    "const ALT_FLAG_SWEEP_KEY = 'concAltFlagSweepV1';",
    "const MAIN_SLOT_IDS = ['main','starch','vegside','xtra','extras'];",
    "const ALT_SLOT_IDS  = ['mainalt','noporkalt','veganalt'];",
    fnBlock('sweepAltFlagPollution'),
    fnBlock('runAltFlagSweepOnce'),
    'runAltFlagSweepOnce(); runAltFlagSweepOnce();',
  ].join('\n');
  vm.runInContext(src, ctx);
  assert.equal(store.concAltFlagSweepV1, 'done', 'marks itself done');
  assert.equal(saved.length, 0, 'nothing to clean → no overlay write');
  const flags = JSON.parse(store.concMenuBase)['1'].MONDAY.lunch_flags;
  assert.deepEqual(flags, { hasFish: true, hasSoy: true }, 'slot-less meal flags untouched');
});
