// Independent, frozen C2a falsification input. Run with node --import; no network or disk writes.
// This deliberately removes a currently correct Corn warning, keeping the bound recipe/source unchanged.
// The ordinary safety gates MUST reject this coherent candidate; this preloader is not a passing assertion.
// C2A_SOURCE_HTML optionally isolates a reviewed product revision during concurrent development.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { liftCornDoor } from '../helpers/corn_gate_runtime.mjs';
import { routingFor } from '../helpers/historical_menu.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = fs.readFileSync.bind(fs);
const json = name => JSON.parse(read(path.join(root, name), 'utf8'));
const html = read(process.env.C2A_SOURCE_HTML || path.join(root, 'index.html'), 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
const runtime = liftCornDoor(html);
const menu = json('menu_current.json'), overlay = json('menu_overlay.json'), state = json('door_state.json');
const cornSources = new Map(runtime.fallback.filter(r => (r.allergens || []).some(a => /^Corn(?:\s*\(|$)/i.test(a))).map(r => [r.recipeName, r]));
const candidates = [];
for (const [week, days] of Object.entries(menu.menu)) for (const [dayName, day] of Object.entries(days)) {
  for (const period of ['breakfast', 'lunch', 'dinner']) {
    const main = day[period + '_slots']?.main;
    if (cornSources.has(main?.recipeName) && main.flags?.hasCorn === true && day[period + '_flags']?.hasCorn === true &&
        overlay[week]?.[dayName]?.[period + '_slots']?.main?.recipeName === main.recipeName) {
      candidates.push({ week, dayName, period, recipeName: main.recipeName });
    }
  }
}
// Prefer the originally reviewed regression; if moved or removed, follow another exact known-Corn binding.
const target = candidates.find(c => c.recipeName === 'Oven Fried Chicken') || candidates[0];
assert.ok(target, 'The manual fault probe needs one exact known-Corn live binding; absence is not a safety pass.');
const { week, dayName, period, recipeName } = target;
const sourceBefore = JSON.stringify(cornSources.get(recipeName));
for (const data of [menu.menu, overlay]) {
  const day = data[week][dayName];
  assert.equal(day[period + '_flags'].hasCorn, true, 'Operational meal starts with the correct Corn warning');
  assert.equal(day[period + '_slots'].main.flags.hasCorn, true, 'Operational main slot starts with the correct Corn warning');
  day[period + '_flags'].hasCorn = false;
  day[period + '_slots'].main.flags.hasCorn = false;
}

// Run real export/routing/summary implementations so malformed receipts or inconsistent totals cannot expose the fault for us.
menu.menu = runtime.publishMenu(menu.menu, overlay, []).before;
assert.equal(menu.menu[week][dayName][period + '_flags'].hasCorn, false);
assert.equal(menu.menu[week][dayName][period + '_slots'].main.flags.hasCorn, false);
assert.equal(JSON.stringify(cornSources.get(recipeName)), sourceBefore, 'The recipe source is unchanged');
const routing = routingFor(html, menu.menu, state.residents, state.anaphRooms);
const receipt = { exported: menu._meta.exported, hash: runtime.core.doorContentHash(menu.menu) };
const { ctx } = runtime.engine(menu.menu, null, state.residents);
ctx.anaphRooms = state.anaphRooms;
const start = html.indexOf('function buildRegistrySummaryJSON('), end = html.indexOf('\n}\n', start);
assert.ok(start >= 0 && end > start, 'Missing production summary builder');
vm.runInContext(html.slice(start, end) + '\n}\n', ctx);
const summary = ctx.buildRegistrySummaryJSON();
for (const data of [state, routing, summary]) data._meta = { ...data._meta, builtFromMenu: receipt };
const changed = new Map([['index.html', html]]);
for (const [name, data] of Object.entries({ 'menu_current.json': menu, 'menu_overlay.json': overlay, 'door_state.json': state,
  'routing_by_meal.json': routing, 'registry_summary.json': summary })) changed.set(name, JSON.stringify(data));
fs.readFileSync = function (file, options) {
  const absolute = path.resolve(file instanceof URL ? fileURLToPath(file) : String(file));
  const relative = path.relative(root, absolute);
  if (!changed.has(relative)) return read(file, options);
  const value = changed.get(relative), encoding = typeof options === 'string' ? options : options?.encoding;
  return encoding ? value : Buffer.from(value);
};
console.log('# C2a independent injected loss: exact recipe ' + recipeName + ' at W' + week + ' ' + dayName + ' ' + period + ' loses both Corn warnings; production files remain untouched.');
