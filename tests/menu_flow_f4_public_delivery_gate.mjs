// Source-verified public contract: DOOR Pages never serves its editor overlay.
// The effective overlay is already included in the normalized public menu digest.
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import {webcrypto} from 'node:crypto';
import {candidate,inputs,clone,SERVICE,NOW,MAX_AGE} from './fixtures/menu_flow_f4_cases.mjs';
const hub=new URL('../CONC_Production_Hub.html',import.meta.url);
const html=fs.readFileSync(process.env.HOUSE_FLOW_HTML||(fs.existsSync(hub)?hub:new URL('../index.html',import.meta.url)),'utf8');
const a='/* HOUSE_TESTABLE_CORE_START flow-validity */',b='/* HOUSE_TESTABLE_CORE_END flow-validity */';
function core(){assert.ok(html.includes(a)&&html.includes(b));const c=vm.createContext({crypto:webcrypto,TextEncoder,Date,console});vm.runInContext(html.slice(html.indexOf(a)+a.length,html.indexOf(b)),c);return c;}
const publicOnly=(n=148,seq=1)=>{const x=candidate(inputs(n),seq);delete x.overlay;return x;};
async function ready(c,x=candidate()){const s=c.houseFlowCreateState({maxAgeMs:MAX_AGE});assert.equal(await c.houseFlowPromote(s,c.houseFlowBegin(s),x,{now:NOW,source:'live'}),true);return s;}
test('F4 public delivery: the portable allowlist is the seven actually served JSON artifacts',()=>{
  const f=JSON.parse(fs.readFileSync(new URL('./fixtures/door_public_flow_allowlist.json',import.meta.url),'utf8')).publicJSON;
  assert.deepEqual(f,['meal_swaps.json','meal_swaps_reverted.json','menu_current.json','registry_summary.json','routing_by_meal.json','special_meals.json','special_meals_removed.json']);
  const workflow=new URL('../.github/workflows/pages.yml',import.meta.url);
  // The sibling EXPO repository also has pages.yml; it is not DOOR's delivery contract.
  // Check the real local workflow only in the DOOR repository, identified by its launcher.
  if(fs.existsSync(new URL('../KitchenDOOR_Push.hta',import.meta.url))){assert.ok(fs.existsSync(workflow));const s=fs.readFileSync(workflow,'utf8'),loop=/^\s*for f in ([^;\n]+); do/m.exec(s);assert.ok(loop);assert.deepEqual(loop[1].trim().split(/\s+/).sort(),f);}
});
test('F4 public delivery: coherent public menu/registry/routing and maps certify without private overlay',async()=>{
  const c=core(),s=await ready(c,publicOnly());assert.equal(c.houseFlowResolve(s,SERVICE,NOW).counts.Regular,148);
});
test('F4 public delivery: unavailable optional overlay does not block a coherent public refresh',async()=>{
  const c=core(),s=await ready(c);const x=publicOnly(142,2);x.overlay=null;
  assert.equal(await c.houseFlowPromote(s,c.houseFlowBegin(s),x,{now:NOW+1,source:'live'}),true);assert.equal(c.houseFlowResolve(s,SERVICE,NOW+1).counts.Regular,142);
});
test('F4 public delivery: absence of an optional overlay is not known receipt loss',async()=>{
  const c=core(),s=await ready(c),g=c.houseFlowBegin(s);c.houseFlowObserve(s,g,undefined,{family:'overlay',site:SERVICE.site,source:'live'});
  assert.equal(c.houseFlowResolve(s,SERVICE,NOW+1).status,'valid');
});
test('F4 public delivery: an optional authenticated overlay receipt still witnesses supersession',async()=>{
  const c=core(),s=await ready(c),g=c.houseFlowBegin(s),newer=candidate(inputs(142),2);
  c.houseFlowObserve(s,g,newer.overlay._meta.flow,{family:'overlay',site:SERVICE.site,source:'live'});
  assert.equal(c.houseFlowResolve(s,SERVICE,NOW+1).status,'unavailable');
  delete newer.overlay;assert.equal(await c.houseFlowPromote(s,g,newer,{now:NOW+1,source:'live'}),true);
});
test('F4 public delivery: a present conflicting private overlay cannot be silently ignored',async()=>{
  const c=core(),s=await ready(c),x=candidate();x.overlay=clone(candidate(inputs(142),2).overlay);
  assert.equal(await c.houseFlowPromote(s,c.houseFlowBegin(s),x,{now:NOW+1,source:'live'}),false);assert.equal(c.houseFlowResolve(s,SERVICE,NOW+1).status,'unavailable');
});
test('F4 public delivery: a present malformed private overlay cannot be silently ignored',async()=>{
  const c=core(),s=await ready(c),x=candidate();x.overlay._meta.flow={schema:1};
  assert.equal(await c.houseFlowPromote(s,c.houseFlowBegin(s),x,{now:NOW+1,source:'live'}),false);assert.equal(c.houseFlowResolve(s,SERVICE,NOW+1).status,'unavailable');
});
test('F4 public delivery: missing required public registry still invalidates certification',async()=>{
  const c=core(),s=await ready(c),x=publicOnly();delete x.registry;
  assert.equal(await c.houseFlowPromote(s,c.houseFlowBegin(s),x,{now:NOW+1,source:'live'}),false);assert.equal(c.houseFlowResolve(s,SERVICE,NOW+1).status,'unavailable');
});
