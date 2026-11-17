// Independent finite-JSON boundary: reject inherited behavior without invoking it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {api,material} from './fixtures/serving_protocol_v1_cases.mjs';
test('custom prototype cannot invoke inherited Symbol.toStringTag or be admitted as JSON',async()=>{
  const {c}=api(),m=material(),prototype=Object.create(null);let invoked=0;
  Object.defineProperty(prototype,Symbol.toStringTag,{get(){invoked++;return 'Object';}});
  Object.setPrototypeOf(m.registry,prototype);
  assert.equal((await c.houseServingV1Prepare(m)).ok,false);
  assert.equal(invoked,0);
});
