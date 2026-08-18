// Recipe-attach S5 — publish the binding (F-F).
// The binding (recipeName + displayText) already ships inside menu_current.json `_slots`
// because buildMenuJSON shallow-copies the whole day and _buildSlotSnapshot (S1) persists
// displayText. No new export code — this gate LOCKS that contract: the binding publishes,
// and the allergen-derived fields (allergens_<meal>, _flags) are displayText-NEUTRAL, so
// an additive display rename can never perturb the allergen feed EXPO/HUB consume.
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

function runBuild(menuDay) {
  const ctx = {
    Date, Object,
    getMenuData: () => ({ '1': { MONDAY: menuDay } }),
    DOOR_SCHEMA_VERSIONS: { menu_current: 32 },
    currentSite: { id: 'rexdale' },
  };
  vm.createContext(ctx);
  vm.runInContext([fnBlock('flagsToMenuAllergens'), fnBlock('buildMenuJSON')].join('\n\n'), ctx, { filename: 'index.html#s5-publish', timeout: 1000 });
  return ctx.buildMenuJSON().menu['1'].MONDAY;
}

const decoupledDay = () => ({
  lunch: 'Pork Al Pastor Taco, Rice',
  lunch_flags: { hasPork: true, hasSoy: true, halalCertifiedMeat: true },
  lunch_slots: {
    main: { recipeName: 'Pork Al Pastor', displayText: 'Pork Al Pastor Taco', flags: { hasPork: true, hasSoy: true } },
    starch: { manual: 'Rice', flags: {} },
  },
});

test('the binding (recipeName + displayText) is carried into the published _slots', () => {
  const out = runBuild(decoupledDay());
  assert.equal(out.lunch_slots.main.recipeName, 'Pork Al Pastor', 'recipeName published');
  assert.equal(out.lunch_slots.main.displayText, 'Pork Al Pastor Taco', 'displayText published (the binding)');
  assert.equal(out.lunch_slots.starch.manual, 'Rice', 'a manual slot is untouched');
});

test('allergen-derived fields regenerate from _flags and enforce hasPork ⇒ !halal', () => {
  const out = runBuild(decoupledDay());
  assert.equal(out.lunch_flags.halalCertifiedMeat, false, 'pork day flips halalCertifiedMeat off on export');
  assert.ok(/pork/i.test(out.allergens_lunch), 'allergens_lunch regenerated from flags (carries pork)');
  assert.ok(/soy/i.test(out.allergens_lunch), 'and soy');
});

test('displayText is allergen-NEUTRAL: renaming the display never moves allergens_<meal> or _flags', () => {
  const a = runBuild(decoupledDay());
  const renamed = decoupledDay();
  renamed.lunch_slots.main.displayText = 'Al Pastor Street Tacos';   // a different display rename
  const b = runBuild(renamed);
  assert.equal(a.allergens_lunch, b.allergens_lunch, 'the allergen line is identical regardless of the display name');
  assert.deepEqual(Object.keys(a.lunch_flags).sort(), Object.keys(b.lunch_flags).sort(), 'the flag set is identical');
  assert.equal(a.lunch_flags.hasPork, b.lunch_flags.hasPork);
  assert.equal(b.lunch_slots.main.displayText, 'Al Pastor Street Tacos', 'only the display field differs');
});

test('a legacy welded slot (no displayText) publishes with no displayText key', () => {
  const day = decoupledDay();
  delete day.lunch_slots.main.displayText;   // welded (default display)
  const out = runBuild(day);
  assert.equal('displayText' in out.lunch_slots.main, false, 'no displayText key on a non-decoupled slot (byte-neutral)');
  assert.equal(out.lunch_slots.main.recipeName, 'Pork Al Pastor', 'recipeName still published');
});
