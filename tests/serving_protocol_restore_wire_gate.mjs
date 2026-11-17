// Independent release boundaries: canonical wire and fail-closed invalid restoration.
import test from 'node:test';
import assert from 'node:assert/strict';
import {api,built,valid,plain,NOW,seal} from './fixtures/serving_protocol_v1_cases.mjs';
const opts={site:'rexdale',maxAgeMs:60000},service='1|SUNDAY|breakfast';
async function promote(c,s,outcome,source='live'){
  const b=c.houseServingV1Begin(s);
  return (await c.houseServingV1Promote(b.state,b.attempt,outcome,{source,now:NOW,observedAt:NOW})).state;
}
const counts=(c,s)=>c.houseServingV1Resolve(s,service,NOW,{purpose:'headcount'}).counts;
test('a matching seal does not make noncanonical frame bytes supported wire',async()=>{
  const {c}=api(),b=await built(c);
  b.frameBytes=new TextEncoder().encode(JSON.stringify(JSON.parse(new TextDecoder().decode(b.frameBytes)),null,2)+'\n');
  b.pointer.frame.sha256=seal(b.frameBytes);
  assert.equal((await valid(c,b)).ok,false);
});
test('invalid restored authority cannot forget its hold then admit old cache; valid live may recover',async()=>{
  const {c}=api(),validation=await valid(c,await built(c));
  let s=await promote(c,c.houseServingV1CreateState(opts),{kind:'frame',validation});
  s=await promote(c,s,{kind:'frame',validation:{ok:false,reason:'unsupported-protocol'}});
  const snapshot=plain(s);snapshot.liveHold.reason=null;
  s=c.houseServingV1CreateState({...opts,snapshot});
  s=await promote(c,s,{kind:'frame',validation},'cache');
  assert.equal(counts(c,s),null);
  s=await promote(c,s,{kind:'frame',validation});
  assert.equal(counts(c,s).Regular,2);
});
