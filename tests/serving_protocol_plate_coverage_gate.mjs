// Independent food-boundary probe; synthetic empty and occupied rosters only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {api,material} from './fixtures/serving_protocol_v1_cases.mjs';
test('complete occupied ordinary service requires a represented food component; verified zero remains representable',async()=>{
  const {c}=api(),m=material();
  for(const s of m.rotation){s.components=[];s.componentAllocations={};}
  m.recipes=[];
  assert.equal((await c.houseServingV1Prepare(m)).ok,false);
  m.registry.summary={total:0,active:0,anaphylactic:0};
  for(const k of Object.keys(m.registry.headcounts))m.registry.headcounts[k]=0;
  for(const s of m.rotation){s.sectionCounts.Regular=0;s.resolution.expectedResidents=0;s.resolution.ordinaryResolved=0;}
  assert.equal((await c.houseServingV1Prepare(m)).ok,true);
});
