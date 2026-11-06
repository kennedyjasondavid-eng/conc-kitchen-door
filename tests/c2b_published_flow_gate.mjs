// C2b data-run guard: validate the actual publication through the shared core.
// Full existing artifact/resident/allergen tests still run; this is additive.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {candidate,inputs,swappedInputs,clone,NOW} from './fixtures/menu_flow_f4_cases.mjs';
const modulePath=new URL('../scripts/check_published_flow.mjs',import.meta.url);
const implementation=fs.existsSync(modulePath)?await import(modulePath):null;
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const paths=['menu_current.json','menu_overlay.json','registry_summary.json','routing_by_meal.json','door_state.json',
  'meal_swaps.json','meal_swaps_reverted.json','special_meals.json','special_meals_removed.json','door_flow_publication.json'];
const validate=async files=>{assert.ok(implementation,'published-flow guard implementation required');return implementation.validatePublishedFlow(files,{html,now:NOW});};
function bundle(source=inputs()) {
  const c=candidate(source),flow=clone(c.menu._meta.flow);
  return {'menu_current.json':c.menu,'menu_overlay.json':c.overlay,'registry_summary.json':c.registry,'routing_by_meal.json':c.routing,
    'door_state.json':{_meta:clone(c.menu._meta),residents:clone(source.registry.residents),anaphRooms:clone(source.registry.anaphRooms)},
    'meal_swaps.json':c.swaps,'meal_swaps_reverted.json':c.reverted,'special_meals.json':c.specials,'special_meals_removed.json':c.removed,
    'door_flow_publication.json':{_meta:{site:'rexdale'},schema:1,flow}};
}
const strip=files=>{const x=clone(files);for(const name of paths)if(x[name]?._meta)delete x[name]._meta.flow;
  delete x['door_flow_publication.json'];delete x['routing_by_meal.json'].flow;return x;};
test('C2b checked-in publication is evaluated without browser or live network',async()=>{
  const files=Object.fromEntries(paths.flatMap(name=>{const url=new URL('../'+name,import.meta.url);return fs.existsSync(url)?[[name,JSON.parse(fs.readFileSync(url,'utf8'))]]:[];}));
  const result=await validate(files);assert.equal(result.ok,true,JSON.stringify(result));
  assert.ok(['legacy','active'].includes(result.mode));
});
test('C2b complete current synthetic publication and ordinary edited/date-swapped input pass',async()=>{
  for(const source of [inputs(),swappedInputs()]){const result=await validate(bundle(source));assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.mode,'active');}
});
test('C2b wholly legacy publication remains valid before activation',async()=>{
  const result=await validate(strip(bundle()));assert.equal(result.ok,true);assert.equal(result.mode,'legacy');
});
for(const path of paths)test('C2b active publication cannot omit required '+path,async()=>{
  const files=bundle();delete files[path];assert.equal((await validate(files)).ok,false);
});
for(const path of ['menu_current.json','menu_overlay.json','registry_summary.json','routing_by_meal.json','door_state.json'])test('C2b partial/downgraded receipt: '+path,async()=>{
  const files=bundle();delete files[path]._meta.flow;assert.equal((await validate(files)).ok,false);
});
test('C2b private counter cannot bless receipt-less public artifacts',async()=>{
  const files=strip(bundle());files['door_flow_publication.json']=bundle()['door_flow_publication.json'];assert.equal((await validate(files)).ok,false);
});
test('C2b mixed occurrence, epoch and site are refused',async()=>{
  for(const mutate of [f=>f['routing_by_meal.json']._meta.flow.publication.sequence++,
    f=>f['door_state.json']._meta.flow.publication.epoch='different',
    f=>f['registry_summary.json']._meta.site='different',
    f=>f['door_flow_publication.json'].flow.publication.sequence++,
    f=>f['door_flow_publication.json']._meta.site='different']){
    const files=bundle();mutate(files);assert.equal((await validate(files)).ok,false);
  }
});
test('C2b menu/dated tampering and missing dated projection fail the actual reader contract',async()=>{
  for(const mutate of [f=>f['menu_current.json'].menu['2'].FRIDAY.dinner='Different unstamped dish',
    f=>f['meal_swaps.json']['2026-11-06-dinner'].specialName='Different unstamped dated meal',
    f=>delete f['routing_by_meal.json'].flow.dated['2026-11-06']]){
    const files=bundle(swappedInputs());mutate(files);assert.equal((await validate(files)).ok,false);
  }
});
test('C2b invalid portion counts and wrong projection revision fail',async()=>{
  for(const mutate of [f=>f['routing_by_meal.json'].flow.rotation['2'].FRIDAY.dinner.counts.Regular=-1,
    f=>f['routing_by_meal.json'].flow.rotation['2'].FRIDAY.dinner.counts._components['Fixture Rice']=1.5,
    f=>f['routing_by_meal.json'].flow.inputRevision='sha256:'+'0'.repeat(64)]){
    const files=bundle();mutate(files);assert.equal((await validate(files)).ok,false);
  }
});
test('C2b honest unavailable dated routing remains acceptable; no invented zero required',async()=>{
  const files=bundle(swappedInputs());files['routing_by_meal.json'].flow.dated['2026-11-06'].dinner={status:'unavailable',reason:'anaphylactic-input-unknown'};
  assert.equal((await validate(files)).ok,true);
});
test('C2b validation never edits the submitted operational data',async()=>{
  const files=bundle(),before=JSON.stringify(files);await validate(files);assert.equal(JSON.stringify(files),before);
});
