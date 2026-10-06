// tests/declared_free_vegan_gate.mjs — a soy-free vegan line is not labelled SOY (2026-10-06).
// Jason: "soy-free fried rice should not flag soy." Wk3 FRI dinner serves Chicken and Mushroom Fried Rice (soy sauce)
// on the regular line and Soy-Free Mushroom Fried Rice on the vegan line. computePlatingData copies the main meal's
// allergens (minus proteins) onto the vegan plate as a safety floor, so the regular line's soy labelled the soy-free
// plate SOY. A vegan line that names itself soy-free now drops SOY from that copied floor. Nothing else moves: egg and
// mustard (which decide whether No Egg residents join the vegan pool) are never cleared by a name.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const menuCur = JSON.parse(fs.readFileSync(new URL('../menu_current.json', import.meta.url), 'utf8'));
function between(a, b) { const s = html.indexOf(a); assert.ok(s >= 0, 'missing ' + a); const e = html.indexOf(b, s); assert.ok(e > s, 'missing ' + b); return html.slice(s, e); }
function fn(name) { return between('function ' + name + '(', '\n}\n') + '\n}\n'; }
const sb = vm.createContext({});
vm.runInContext(fn('flagsToAllergenStr') + fn('mergeVegAltAllergenFloor')
  + between('const DOOR_DECLARED_FREE', 'let _LAST_SLOT_FLAGS'), sb);
const strip = (a, v) => vm.runInContext('stripDeclaredFreeAllergens(' + JSON.stringify(a) + ',' + JSON.stringify(v) + ')', sb);

test('a vegan line named soy-free drops SOY and nothing else', () => {
  assert.equal(strip('Wheat, SESAME, SOY, Mushroom, Brassicas', 'Soy-Free Mushroom Fried Rice, Spring Roll, Bok Choy'),
    'Wheat, SESAME, Mushroom, Brassicas');
  assert.equal(strip('SOY', 'soy free noodles'), '', 'case and spacing');
  assert.equal(strip('SOY, Eggs, MUSTARD', 'Soy-Free Tofu'), 'Eggs, MUSTARD', 'egg and mustard stay');
});
test('without a soy-free name the floor is unchanged', () => {
  for (const v of ['Mushroom Fried Rice', 'Soy Glazed Tofu', 'Teriyaki Tofu', '', null])
    assert.equal(strip('Wheat, SOY', v), 'Wheat, SOY', String(v));
});
test('Wk3 FRI dinner: the vegan plate floor no longer carries SOY, the regular meal still does', () => {
  const d = menuCur.menu['3'].FRIDAY;
  assert.match(d.dinner_veg, /Soy-Free/);
  assert.equal(d.dinner_flags.hasSoy, true, 'the regular line keeps its soy');
  const safe = { ...d.dinner_flags };
  for (const k of ['hasPork', 'hasBeef', 'hasChicken', 'hasTurkey', 'hasFish', 'hasShellfish']) safe[k] = false;
  sb.F = safe;
  const floor = vm.runInContext('flagsToAllergenStr(F).toUpperCase()', sb);
  assert.match(floor, /SOY/, 'the copied floor had SOY before');
  const plate = vm.runInContext('mergeVegAltAllergenFloor("", stripDeclaredFreeAllergens(flagsToAllergenStr(F).toUpperCase(), '
    + JSON.stringify(d.dinner_veg) + '))', sb);
  assert.doesNotMatch(plate, /SOY/);
  assert.match(plate, /WHEAT/, 'gluten from the spring roll stays');
});
test('computePlatingData applies it to the copied floor only, so a stored statement and the lookup still win', () => {
  assert.match(html, /vegAllergenFallback = stripDeclaredFreeAllergens\(flagsToAllergenStr\(_safeFlags\)\.toUpperCase\(\), mealVeg\);/);
  assert.match(html, /vegAllergenStored\s*\|\|\s*\n?\s*mergeVegAltAllergenFloor\(vegAllergenLookup,\s*vegAllergenFallback\)/);
  assert.ok(html.indexOf('const DOOR_DECLARED_FREE') < html.indexOf('function computePlatingData('), 'declared before use');
});
