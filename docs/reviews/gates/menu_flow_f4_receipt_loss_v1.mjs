// Independent rollback/legacy-writer boundary. A known publisher losing its
// receipt makes prior quantities uncertain; missing metadata is not an older sequence.
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import {webcrypto} from 'node:crypto';
import {candidate,inputs,clone,SERVICE,NOW,MAX_AGE} from './fixtures/menu_flow_f4_cases.mjs';
const hub=new URL('../CONC_Production_Hub.html',import.meta.url);
const html=fs.readFileSync(process.env.HOUSE_FLOW_HTML||(fs.existsSync(hub)?hub:new URL('../index.html',import.meta.url)),'utf8');
const a='/* HOUSE_TESTABLE_CORE_START flow-validity */',b='/* HOUSE_TESTABLE_CORE_END flow-validity */';
function core(){assert.ok(html.includes(a)&&html.includes(b),'actual inline core');const c=vm.createContext({crypto:webcrypto,TextEncoder,Date,console});vm.runInContext(html.slice(html.indexOf(a)+a.length,html.indexOf(b)),c);return c;}
async function ready(){const c=core(),s=c.houseFlowCreateState({maxAgeMs:MAX_AGE});assert.equal(await c.houseFlowPromote(s,c.houseFlowBegin(s),candidate(),{now:NOW,source:'live'}),true);return{c,s};}
function unknown(c,s){const r=c.houseFlowResolve(s,SERVICE,NOW+1);assert.equal(r.status,'unavailable');assert.equal(r.counts,null);}
function lose(c,s,g=s.generation){c.houseFlowObserve(s,g,undefined,{family:'menu',site:SERVICE.site,source:'live'});}
function legacy(){const x=candidate();for(const f of ['menu','overlay','registry','routing'])delete x[f]._meta.flow;x.menu.menu['2'].FRIDAY.dinner='Synthetic Legacy Replacement';return x;}
for(const family of ['menu','overlay','registry','routing'])for(const broken of ['missing','malformed'])test('F4 receipt loss: '+family+' '+broken+' receipt immediately invalidates known quantities',async()=>{
  const {c,s}=await ready(),g=c.houseFlowBegin(s);
  c.houseFlowObserve(s,g,broken==='missing'?undefined:{schema:1,publication:{epoch:'synthetic-epoch-one',sequence:'invalid'}},{family,site:SERVICE.site,source:'live'});
  unknown(c,s);
});
test('F4 receipt loss: a complete changed legacy candidate cannot leave prior counts certified',async()=>{
  const {c,s}=await ready();assert.equal(await c.houseFlowPromote(s,c.houseFlowBegin(s),legacy(),{now:NOW+1,source:'live'}),false);unknown(c,s);
});
test('F4 receipt loss: durable uncertainty rejects old same-occurrence cache after restart',async()=>{
  const {c,s}=await ready();lose(c,s);
  const restored=c.houseFlowCreateState({maxAgeMs:MAX_AGE,snapshot:clone(c.houseFlowSnapshot(s))});
  assert.equal(await c.houseFlowPromote(restored,c.houseFlowBegin(restored),candidate(),{now:NOW+1,source:'cache',observedAt:NOW}),false);unknown(c,restored);
});
test('F4 receipt loss: a later request with the old live occurrence cannot erase uncertainty',async()=>{
  const {c,s}=await ready();lose(c,s);
  assert.equal(await c.houseFlowPromote(s,c.houseFlowBegin(s),candidate(),{now:NOW+1,source:'live'}),false);unknown(c,s);
});
test('F4 receipt loss control: a higher coherent live occurrence recovers automatically',async()=>{
  const {c,s}=await ready();lose(c,s);
  assert.equal(await c.houseFlowPromote(s,c.houseFlowBegin(s),candidate(inputs(142),2),{now:NOW+1,source:'live'}),true);
  assert.equal(c.houseFlowResolve(s,SERVICE,NOW+1).counts.Regular,142);
});
test('F4 receipt loss control: an old request callback cannot invalidate the active generation',async()=>{
  const {c,s}=await ready(),old=s.generation;c.houseFlowBegin(s);lose(c,s,old);
  assert.equal(c.houseFlowResolve(s,SERVICE,NOW+1).status,'valid');
});
test('F4 receipt loss control: initial legacy boot is unverified and permits first legitimate activation',async()=>{
  const c=core(),s=c.houseFlowCreateState({maxAgeMs:MAX_AGE});
  assert.equal(await c.houseFlowPromote(s,c.houseFlowBegin(s),legacy(),{now:NOW,source:'live'}),false);unknown(c,s);
  assert.equal(await c.houseFlowPromote(s,c.houseFlowBegin(s),candidate(),{now:NOW+1,source:'live'}),true);
});
