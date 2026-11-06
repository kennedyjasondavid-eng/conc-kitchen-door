// Manual C2a falsification probe, loaded with node --import. Not a new CI allocation or default-suite test.
// Overrides reads in this process only: no product/data file is written, no network is used.
// C2A_VARIANT: baseline, comment, swap, replace, swap-corn, replace-corn, zero-lactose, zero-anaph,
// wrong-live-brassica, wrong-corn, wrong-lactose, lost-anaph.
// C2A_SOURCE_HTML may pin the product source while another authorized slice is under construction.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { liftCornDoor } from '../helpers/corn_gate_runtime.mjs';
import { routingFor } from '../helpers/historical_menu.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = fs.readFileSync.bind(fs);
const json = name => JSON.parse(read(path.join(root, name), 'utf8'));
const variant = process.env.C2A_VARIANT;
const changed = new Map();
const html = read(process.env.C2A_SOURCE_HTML || path.join(root, 'index.html'), 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
changed.set('index.html', html);
const fn = name => {
  const start = html.indexOf('function ' + name + '('), end = html.indexOf('\n}\n', start);
  if (start < 0 || end < start) throw new Error('Missing ' + name);
  return html.slice(start, end) + '\n}\n';
};

if (variant === 'baseline') { /* source pin only */ }
else if (variant === 'comment') changed.set('index.html', html + '\n<!-- C2a: an inert application edit. -->\n');
else if (['swap', 'replace', 'swap-corn', 'replace-corn', 'zero-lactose', 'zero-anaph'].includes(variant)) {
  const menu = json('menu_current.json'), overlay = json('menu_overlay.json'), state = json('door_state.json');
  if (['swap', 'replace', 'swap-corn', 'replace-corn'].includes(variant)) {
    const swap = variant.startsWith('swap');
    let wk = swap ? '1' : '2', period = swap ? 'breakfast' : 'dinner';
    let a = swap ? 'SUNDAY' : 'THURSDAY', b = swap ? 'MONDAY' : 'FRIDAY';
    if (variant.endsWith('-corn')) {
      const source=liftCornDoor(html).fallback;
      let target;
      outer: for (const [week,days] of Object.entries(menu.menu)) for (const [dayName,day] of Object.entries(days)) {
        for (const meal of ['breakfast','lunch','dinner']) {
          const main=day[meal+'_slots']?.main;
          if(!main)continue;
          const rows=main.recipeId ? source.filter(r=>r.recipeId===main.recipeId) : source.filter(r=>r.recipeName===main.recipeName);
          if(rows.length!==1 || !rows[0].allergens?.some(x=>/^Corn(?:\s*\(|$)/i.test(x)))continue;
          const other=Object.keys(days).find(name=>name!==dayName && days[name][meal] && days[name][meal]!==day[meal]);
          if(other){target={week,dayName,meal,other};break outer;}
        }
      }
      if(!target)throw new Error('Corn movement probe needs one exact known current source binding');
      ({week:wk,dayName:a,meal:period,other:b}=target);
    }
    const isMeal = k => (k.startsWith(period) && !k.endsWith('_original')) || k === 'allergens_' + period;
    const take = day => Object.fromEntries(Object.entries(day).filter(([k]) => isMeal(k)));
    const oldA = take(menu.menu[wk][a]), oldB = take(menu.menu[wk][b]);
    const set = (day, meal) => { Object.keys(day).filter(isMeal).forEach(k => delete day[k]); Object.assign(day, structuredClone(meal)); };
    for (const data of [menu.menu, overlay]) {
      set(data[wk][a], oldB);
      if (swap) set(data[wk][b], oldA);
    }
    overlay._meta.dayEditedAt[wk + '|' + a] = Date.now();
    if (swap) overlay._meta.dayEditedAt[wk + '|' + b] = Date.now();
  } else {
    state.residents = variant === 'zero-anaph'
      ? state.residents.filter(r => !r.isAnaph && !state.anaphRooms.includes(r.room))
      : state.residents.filter(r => !(r.tags || []).includes('Lactose Intolerant'));
    const remaining = new Set(state.residents.map(r => r.room));
    state.anaphRooms = state.anaphRooms.filter(room => remaining.has(room));
    state._meta.count = state.residents.length;
  }
  // Rebuild the candidate through the production exporter and plating engine; don't forge good counts.
  const runtime = liftCornDoor(html);
  menu.menu = runtime.publishMenu(menu.menu, overlay, []).before;
  const routing = routingFor(html, menu.menu, state.residents, state.anaphRooms);
  const receipt = { exported: menu._meta.exported, hash: runtime.core.doorContentHash(menu.menu) };
  const { ctx } = runtime.engine(menu.menu, null, state.residents);
  ctx.anaphRooms = state.anaphRooms;
  vm.runInContext(fn('buildRegistrySummaryJSON'), ctx);
  const summary = ctx.buildRegistrySummaryJSON();
  for (const data of [state, routing, summary]) data._meta = { ...data._meta, builtFromMenu: receipt };
  for (const [name, data] of Object.entries({ 'menu_current.json': menu, 'menu_overlay.json': overlay, 'door_state.json': state,
    'routing_by_meal.json': routing, 'registry_summary.json': summary })) changed.set(name, JSON.stringify(data));
} else if (variant === 'wrong-live-brassica') {
  const menu = json('menu_current.json');
  let changedFlag = false;
  outer: for (const days of Object.values(menu.menu)) for (const day of Object.values(days)) {
    for (const period of ['breakfast', 'lunch', 'dinner']) {
      if (day[period + '_flags']?.hasBrassicas && /broccoli|cabbage|cauliflower/i.test(day[period] || '')) {
        day[period + '_flags'].hasBrassicas = false;
        changedFlag = true;
        break outer;
      }
    }
  }
  if (!changedFlag) throw new Error('Missing current-menu brassica mutation target');
  changed.set('menu_current.json', JSON.stringify(menu));
} else if (variant === 'wrong-corn') {
  const match = html.match(/const DOOR_RECIPE_DATA_FALLBACK = (.*);\n/);
  if (!match) throw new Error('Missing fallback');
  const feed = JSON.parse(match[1]), target = feed.find(r => r.recipeName === 'Peas and Corn');
  if (!target?.allergens.some(a => /^Corn\b/.test(a))) throw new Error('Missing Corn mutant target');
  target.allergens = target.allergens.filter(a => !/^Corn\b/.test(a));
  changed.set('index.html', html.replace(match[0], 'const DOOR_RECIPE_DATA_FALLBACK = ' + JSON.stringify(feed) + ';\n'));
} else if (variant === 'wrong-lactose') {
  const from = "'Lactose Intolerant': 'hasDairy'";
  if (!html.includes(from)) throw new Error('Missing lactose mutant target');
  changed.set('index.html', html.replace(from, "'Lactose Intolerant': 'hasGluten'"));
} else if (variant === 'lost-anaph') {
  changed.set('index.html', html.replace(fn('doorIsAnaphResident'), 'function doorIsAnaphResident(r) { return false; }\n'));
} else throw new Error('Unknown C2A_VARIANT: ' + variant);

fs.readFileSync = function (file, options) {
  const absolute = path.resolve(file instanceof URL ? fileURLToPath(file) : String(file));
  const relative = path.relative(root, absolute);
  if (changed.has(relative)) {
    const value = changed.get(relative), encoding = typeof options === 'string' ? options : options?.encoding;
    return encoding ? value : Buffer.from(value);
  }
  return read(file, options);
};
console.log('# C2a read-only variation: ' + variant);
