// Corn gate seam: executes DOOR's own readers, overlay, sweep and routing functions.
// Test recipes/menus and synthetic residents are supplied by the caller; no registry snapshot is embedded.
import vm from 'node:vm';
export function liftCornDoor(html) {
function between(a,b) {const s=html.indexOf(a),e=html.indexOf(b,s);if(s<0||e<=s)throw Error('missing '+a);return html.slice(s,e);}
function fn(n){return between('function '+n+'(','\n}\n')+'\n}\n';}
const fnOpt=n=>html.includes('function '+n+'(')?fn(n):'';
const lineOf=p=>{const s=html.indexOf(p);if(s<0)throw Error(p);return html.slice(s,html.indexOf('\n',s))+'\n';};
const DAYS=['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
const core=vm.createContext({});
vm.runInContext(between('/* DOOR_TESTABLE_CORE_START shared-recipes */','/* DOOR_TESTABLE_CORE_END shared-recipes */')+'\n'+between('/* DOOR_TESTABLE_CORE_START publish-validation */','/* DOOR_TESTABLE_CORE_END publish-validation */'),core);
const fb=vm.createContext({});vm.runInContext(lineOf('const DOOR_RECIPE_DATA_FALLBACK = ')+'this.fallback=DOOR_RECIPE_DATA_FALLBACK;',fb);
function sweep(overlay) {const c=vm.createContext({__OV:JSON.parse(JSON.stringify(overlay))});vm.runInContext(between('const MAIN_SLOT_IDS','function sweepAltFlagPollution(')+fn('sweepAltFlagPollution')+'function loadMenuBaseOverlay(){return __OV;} function saveMenuBaseOverlay(){}',c);return c.sweepAltFlagPollution({dryRun:true});}
function publishMenu(weeks, overlay, ticks) {
  // Capture the normal save and publish path in memory; no credentials, network or registry.
  const storage={concUploadedMenu:JSON.stringify(weeks),concMenuBase:JSON.stringify(overlay)},side=[];
  const c=vm.createContext({localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>{storage[k]=String(v);}},
    PublishAuth:{sidePublish:(...args)=>side.push(args)},currentSite:{id:'gate'},__ticks:ticks});
  vm.runInContext([
    between('/* DOOR_TESTABLE_CORE_START publish-validation */','/* DOOR_TESTABLE_CORE_END publish-validation */'),
    between('const DOOR_SCHEMA_VERSIONS = ','\n\nfunction getDoorBuildStamp'),
    'var MENU_DATA={}, _doorPublishMenuOverlayOverride=null, _doorMenuUsedBakedFallback=false;',
    lineOf('const DOOR_BRASSICA_RE = '),
    ...['loadUploadedMenu','loadMenuBaseOverlay','saveMenuBaseOverlay','getDoorPublishMenuOverlayOverride',
      'mergeDoorMenuDataWithOverlay','doorApplyTextDetectedFlags','getMenuData','emptyMealFlags',
      'flagsToMenuAllergens','buildMenuJSON'].map(fn),
    'this.before=buildMenuJSON().menu;var edit=loadMenuBaseOverlay();',
    '__ticks.forEach(t=>{edit[t.wk][t.day][t.period+"_flags"].hasCorn=true;edit[t.wk][t.day][t.period+"_slots"].main.flags.hasCorn=true;});',
    'saveMenuBaseOverlay(edit);this.after=buildMenuJSON().menu;',
  ].join('\n'),c);
  return {before:c.before,after:c.after,saved:JSON.parse(storage.concMenuBase),side};
}
function engine(weeks, feed, registry = []) {
  const state = {residents: registry, anaphRooms: []};
  const TAG_LABELS = html.match(/const TAG_LABELS_MAP = \{[\s\S]*?\n\};/)[0];
  const c = { console, REGISTRY_LIST: state.residents.map((r) => ({ ...r })), anaphRooms: [...state.anaphRooms], DOOR_RECIPE_DATA: feed || null,
    getMenuData: () => weeks, loadSpecialMeals: () => ({}), loadMealSwaps: () => ({}) };
  vm.createContext(c);
  vm.runInContext([
    TAG_LABELS, lineOf('const DOOR_RECIPE_DATA_FALLBACK = '),
    between('const ROUTING_TAGS = new Set([', 'function migrateResidentTiers('),
    between('const ROUTING_RULES = [', '// ============================================================') + between('function computeSections(', 'let mcWeek ='),
    between('/* DOOR_TESTABLE_CORE_START compliance-conflicts */', '/* DOOR_TESTABLE_CORE_END compliance-conflicts */'),
    fn('formatConflictNote'), fn('getRoomBase'), fn('findRoommates'), fn('doorIsAnaphResident'), fn('getAnaphConflictRooms'),
    between('const HUB_ALLERGEN_MAP = {', '\n};\n') + '\n};\n', fn('flagsToAllergenStr'), fn('emptyMealFlags'), fn('hasCarbAccommodation'),
    fn('getVegAltAllergenStr'), fn('mergeVegAltAllergenFloor'), fn('getVegAltSlotAllergenStr'),
    between('const DOOR_DECLARED_FREE = ', '\n'), fn('stripDeclaredFreeAllergens'),
    fn('getSundayStart'), fn('nextDateForSlot'), fnOpt('doorRotationWeekOf'), fnOpt('doorDateKey'), fnOpt('doorDatedMealFlags'),
    fnOpt('doorDatedMealFor'), fnOpt('doorApplyDatedMeal'),
    between('const CONFLICT_MAP = [', '\n];\n') + '\n];\n', fnOpt('doorAllergenStrFlags'), fnOpt('doorSectionLineNotes'), fnOpt('doorSectionAllergenStr'),
    'if (typeof doorDatedMealFor !== "function") this.doorDatedMealFor = () => null;',
    html.includes('const DOOR_KITCHEN_ALT_FIELDS = ') ? lineOf('const DOOR_KITCHEN_ALT_FIELDS = ') : '',
    html.includes('const DOOR_DISH_PART_EMPTY = ') ? between('const DOOR_DISH_PART_EMPTY = ', '\nfunction doorEmptyDishParts(') + '\n' : '',
    fnOpt('doorKitchenAlternatives'), fnOpt('doorAddKitchenPlateFlags'), fnOpt('doorRegularServiceNote'),
    fn('computePlatingData'),
  ].join('\n'), c, { filename: 'index.html#w1b-engine', timeout: 30000 });
  const byRoom = Object.fromEntries(state.residents.map((r) => [r.room, r]));
  const out = {};
  for (const wk of ['1', '2', '3', '4']) for (const day of DAYS) for (const period of ['breakfast', 'lunch', 'dinner']) {
    const pd = c.computePlatingData(period, wk, day);
    if (!pd) continue;
    const seat = {}, notes = {};
    pd.anaphSect.forEach((r) => { seat[r.room] = 'anaph'; });
    pd.sections.forEach((s) => s.residents.forEach((r) => {
      seat[r.room] = s.rule.key;
      if (s.rule.key !== 'regular') notes[r.room] = c.doorSectionLineNotes(byRoom[r.room], s, pd.mealFlags, c.doorSectionAllergenStr(s, pd));
    }));
    (pd.regularNotes || []).forEach((n) => { notes[n.room] = [n.conflictNote, n.serviceNote].filter(Boolean).join(' · '); });
    out[wk + '|' + day + '|' + period] = { seat, notes, veg: pd.vegAllergenStr || '', halal: (pd.ctx && pd.ctx.halalAllergenStr) || '' };
  }
  return { out, ctx: c, conflictMap: vm.runInContext('CONFLICT_MAP', c) };
}
return {engine,core,sweep,publishMenu,fallback:fb.fallback};
}
