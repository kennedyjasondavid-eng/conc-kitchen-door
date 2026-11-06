// Fixed inputs for old menu decisions; current production code still exports and routes them.
// This fixture contains menu/editor fields only. The residents below are invented.
import fs from 'node:fs';
import vm from 'node:vm';
import { liftCornDoor } from './corn_gate_runtime.mjs';

export const copy = value => JSON.parse(JSON.stringify(value));
export const historical = JSON.parse(fs.readFileSync(new URL('../fixtures/menu_regressions_2026-11-06.json', import.meta.url), 'utf8'));
export const syntheticResident = (room, tags = [], extra = {}) => ({
  room, section: 'Regular', tags, restrictions: [], allergenFlags: [], accommodations: [], preferences: [], avoidances: [],
  isAnaph: false, _tierMigrated: true, ...extra,
});
export const regressionResidents = [
  syntheticResident('case_regular'), syntheticResident('case_vegan', ['Vegan']),
  syntheticResident('case_halal', ['Halal']), syntheticResident('case_soft', ['Soft Meals']),
  syntheticResident('case_lactose', ['Lactose Intolerant']),
  syntheticResident('case_anaph', ['No Coconut'], { isAnaph: true, anaphTags: ['noCoconut'] }),
];

export function historicalMenu(html) {
  const runtime = liftCornDoor(html);
  const built = runtime.publishMenu(historical.menu, historical.overlay, []);
  return { menu: copy(built.before), overlay: copy(historical.overlay), runtime };
}

export function routingFor(html, menu, residents = regressionResidents, anaphRooms = []) {
  html = html.replace(/\r\n?/g, '\n');
  const { ctx } = liftCornDoor(html).engine(menu, null, residents, anaphRooms);
  const fn = name => {
    const start = html.indexOf('function ' + name + '(');
    const end = html.indexOf('\n}\n', start);
    if (start < 0 || end < start) throw new Error('Missing routing function ' + name);
    return html.slice(start, end) + '\n}\n';
  };
  ctx.DOOR_SCHEMA_VERSIONS = { routing_by_meal: 31 };
  vm.runInContext(['doorSplitDishes', 'getAltMeal', 'buildRoutingByMealJSON'].map(fn).join('\n'), ctx);
  const routing = copy(ctx.buildRoutingByMealJSON());
  if (routing._meta.componentErrors?.length) throw new Error(JSON.stringify(routing._meta.componentErrors));
  return routing;
}
