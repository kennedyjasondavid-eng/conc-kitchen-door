// Supplemental F4 contract-review case. Original frozen 47-case gate stays unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {candidate,inputs,clone,SERVICE,NOW,MAX_AGE} from './fixtures/menu_flow_f4_cases.mjs';
const hub=new URL('../CONC_Production_Hub.html',import.meta.url);
const html=fs.readFileSync(process.env.HOUSE_FLOW_HTML||(fs.existsSync(hub)?hub:new URL('../index.html',import.meta.url)),'utf8');
function core(){
  const a='/* HOUSE_TESTABLE_CORE_START flow-validity */',b='/* HOUSE_TESTABLE_CORE_END flow-validity */',s=html.indexOf(a),e=html.indexOf(b,s);
  assert.ok(s>=0&&e>s,'actual inline core is required');
  const c=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,URL,Date,console});vm.runInContext(html.slice(s+a.length,e),c);return c;
}
test('F4 routing-first: later authoritative receipt invalidates old quantities even when companions are stale',async()=>{
  const c=core(),state=c.houseFlowCreateState({maxAgeMs:MAX_AGE}),a=candidate(),b=candidate(inputs(142),2);
  let g=c.houseFlowBegin(state);assert.equal(await c.houseFlowPromote(state,g,clone(a),{now:NOW,source:'live'}),true);
  g=c.houseFlowBegin(state);c.houseFlowObserve(state,g,b.routing._meta.flow,{family:'routing',site:'rexdale',source:'live'});
  assert.equal(c.houseFlowResolve(state,SERVICE,NOW).status,'unavailable','receipt observation occurs before complete-candidate validation');
  assert.equal(await c.houseFlowPromote(state,g,{...clone(a),routing:clone(b.routing)},{now:NOW,source:'live'}),false);
  assert.equal(c.houseFlowResolve(state,SERVICE,NOW).counts,null,'rejecting the mixed candidate cannot recertify A');
  assert.equal(await c.houseFlowPromote(state,g,clone(b),{now:NOW,source:'live'}),true);
  assert.equal(c.houseFlowResolve(state,SERVICE,NOW).counts.Regular,142,'matching candidate recovers automatically');
});
