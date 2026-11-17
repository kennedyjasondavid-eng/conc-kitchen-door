// Independent release probes: synthetic aggregates, no I/O or operational sources.
import test from 'node:test';
import assert from 'node:assert/strict';
import {api,material,built,valid,plain,NOW} from './fixtures/serving_protocol_v1_cases.mjs';
const options={site:'rexdale',maxAgeMs:60000},service='1|SUNDAY|breakfast';
const resolve=(c,s)=>c.houseServingV1Resolve(s,service,NOW,{purpose:'headcount'});
async function promoted(c,state,outcome,source='live'){
  const b=c.houseServingV1Begin(state);
  return (await c.houseServingV1Promote(b.state,b.attempt,outcome,{source,now:NOW,observedAt:NOW})).state;
}
test('restored accepted data needs actual seal validation before exposing operational counts',async()=>{
  const {c}=api(),b=await built(c),validation=await valid(c,b);
  let s=await promoted(c,c.houseServingV1CreateState(options),{kind:'frame',validation});
  const snapshot=plain(s);snapshot.accepted.validation.value.frame.material.rotation[0].sectionCounts.Regular=999;
  s=c.houseServingV1CreateState({...options,snapshot});
  assert.equal(resolve(c,s).counts,null);
  s=await promoted(c,s,{kind:'frame',validation},'cache');
  assert.equal(resolve(c,s).counts.Regular,2);
});
test('malformed successful validation envelope is a persistent live hold',async()=>{
  const {c}=api(),validation=await valid(c,await built(c));
  let s=await promoted(c,c.houseServingV1CreateState(options),{kind:'frame',validation});
  s=await promoted(c,s,{kind:'frame',validation:{ok:true,value:{}}});
  assert.equal(resolve(c,s).counts,null);
  s=await promoted(c,s,{kind:'frame',validation},'cache');
  assert.equal(resolve(c,s).counts,null);
  s=c.houseServingV1CreateState({...options,snapshot:plain(s)});
  assert.equal(resolve(c,s).counts,null);
});
test('finite JSON rejects Symbol.toStringTag accessor without invoking it',async()=>{
  const {c}=api(),m=material();let invoked=0;
  Object.defineProperty(m.registry,Symbol.toStringTag,{get(){invoked++;return 'Object';}});
  assert.equal((await c.houseServingV1Prepare(m)).ok,false);
  assert.equal(invoked,0);
});
