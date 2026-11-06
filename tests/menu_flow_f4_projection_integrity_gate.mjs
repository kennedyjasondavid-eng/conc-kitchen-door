// Independent F4 core review supplements. Original frozen core/fixture files remain unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {candidate,inputs,swappedInputs,clone,SERVICE,NOW,MAX_AGE} from './fixtures/menu_flow_f4_cases.mjs';
const hub=new URL('../CONC_Production_Hub.html',import.meta.url);
const html=fs.readFileSync(process.env.HOUSE_FLOW_HTML||(fs.existsSync(hub)?hub:new URL('../index.html',import.meta.url)),'utf8');
function core(){
  const a='/* HOUSE_TESTABLE_CORE_START flow-validity */',b='/* HOUSE_TESTABLE_CORE_END flow-validity */',s=html.indexOf(a),e=html.indexOf(b,s);
  assert.ok(s>=0&&e>s,'actual inline core is required');
  const c=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,URL,Date,console});vm.runInContext(html.slice(s+a.length,e),c);return c;
}
async function resolve(value){
  const c=core(),state=c.houseFlowCreateState({maxAgeMs:MAX_AGE}),g=c.houseFlowBegin(state);
  const accepted=await c.houseFlowPromote(state,g,clone(value),{now:NOW,source:'live'});
  return {accepted,result:JSON.parse(JSON.stringify(c.houseFlowResolve(state,SERVICE,NOW)))};
}
async function unknown(value){const {result}=await resolve(value);assert.equal(result.status,'unavailable');assert.equal(result.counts,null);}
const KEY='2026-11-06-dinner';

test('F4 integrity: an active dated meal with an omitted projection cannot certify rotation counts',async()=>{
  const x=candidate(swappedInputs());delete x.routing.flow.dated['2026-11-06'];await unknown(x);
});
test('F4 integrity: an extra dated projection without an effective dated meal cannot replace rotation',async()=>{
  const x=candidate();x.routing.flow.dated=clone(candidate(swappedInputs()).routing.flow.dated);await unknown(x);
});
for(const [field,value] of [['week','3'],['day','THURSDAY'],['kind','celebration']])test('F4 integrity: wrong dated '+field+' is not certified',async()=>{
  const x=candidate(swappedInputs());x.routing.flow.dated['2026-11-06'].dinner[field]=value;await unknown(x);
});
for(const field of ['section','component'])test('F4 integrity: fractional '+field+' counts are not portions',async()=>{
  const x=candidate(swappedInputs()),counts=x.routing.flow.dated['2026-11-06'].dinner.counts;
  if(field==='section')counts.Regular=1.5;else counts._components['Fixture Sausages']=1.25;
  await unknown(x);
});
test('F4 integrity: special precedence cannot be relabelled as a swap projection',async()=>{
  const i=swappedInputs();i.dated.specials[KEY]={specialName:'Fixture Celebration Rice',createdAt:'2026-11-06T10:00:00Z'};
  const x=candidate(i);x.routing.flow.dated['2026-11-06'].dinner.kind='swap';await unknown(x);
});
test('F4 integrity control: a valid special wins over the underlying swap',async()=>{
  const i=swappedInputs();i.dated.specials[KEY]={specialName:'Fixture Celebration Rice',createdAt:'2026-11-06T10:00:00Z'};
  const {accepted,result}=await resolve(candidate(i));assert.equal(accepted,true);
  assert.equal(result.status,'valid');assert.equal(result.counts._components['Fixture Celebration Rice'],148);
});
test('F4 integrity control: removed special exposes its still-valid underlying swap',async()=>{
  const i=swappedInputs();i.dated.specials[KEY]={specialName:'Fixture Removed Special',createdAt:'2026-11-06T09:00:00Z'};
  i.dated.removed[KEY]='2026-11-06T10:00:00Z';
  const x=candidate(i);
  // Fixed expected projection comes from the underlying known swap, not a generic resolver copied into the test.
  x.routing.flow.dated=clone(candidate(swappedInputs()).routing.flow.dated);
  const {accepted,result}=await resolve(x);assert.equal(accepted,true);assert.equal(result.counts._components['Fixture Sausages'],148);
});
test('F4 integrity control: a reverted swap uses rotation, not an old dated projection',async()=>{
  const i=swappedInputs();i.dated.reverted[KEY]='2026-11-06T10:00:00Z';
  const {accepted,result}=await resolve(candidate(i));assert.equal(accepted,true);assert.equal(result.counts._components['Fixture Rice'],148);
});
test('F4 integrity control: a new swap after the same key tombstone remains effective',async()=>{
  const i=swappedInputs();i.dated.reverted[KEY]='2026-11-06T10:00:00Z';i.dated.swaps[KEY].createdAt='2026-11-06T11:00:00Z';
  const {accepted,result}=await resolve(candidate(i));assert.equal(accepted,true);assert.equal(result.counts._components['Fixture Sausages'],148);
});
test('F4 integrity control: an explicit unavailable effective override remains unavailable',async()=>{
  const x=candidate(swappedInputs());x.routing.flow.dated['2026-11-06'].dinner={status:'unavailable',reason:'anaphylactic-input-unknown'};
  await unknown(x);
});
