// F4 gate-author contract. Identical portable gate in DOOR/EXPO/HUB; expected red before implementation.
// These cases are not permission to close F4 without real producer/refresh integration gates.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { clone,NOW,MAX_AGE,SERVICE,canonical,digest,inputs,receipt,candidate,swappedInputs,reorder } from './fixtures/menu_flow_f4_cases.mjs';

const page=new URL('../CONC_Production_Hub.html',import.meta.url);
const source=fs.readFileSync(process.env.HOUSE_FLOW_HTML || (fs.existsSync(page)?page:new URL('../index.html',import.meta.url)),'utf8').replace(/\r\n?/g,'\n');
function core() {
  const a='/* HOUSE_TESTABLE_CORE_START flow-validity */',b='/* HOUSE_TESTABLE_CORE_END flow-validity */';
  const s=source.indexOf(a),e=source.indexOf(b,s);
  assert.ok(s>=0 && e>s,'F4 requires the actual inline flow-validity core; do not skip its absent implementation');
  const c=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,URL,Date,console});
  vm.runInContext(source.slice(s+a.length,e),c,{filename:'product#flow-validity'});
  return c;
}
const plain=v=>JSON.parse(JSON.stringify(v));
const family=(name='menu')=>({family:name,site:'rexdale',source:'live'});
function begin(c,state){return c.houseFlowBegin(state);}
async function promote(c,state,gen,value,now=NOW,extra={}) {
  return c.houseFlowPromote(state,gen,clone(value),{now,source:'live',...extra});
}
function fresh(c){return c.houseFlowCreateState({maxAgeMs:MAX_AGE});}
async function active(c,value=candidate(),now=NOW) {
  const state=fresh(c),gen=begin(c,state);
  c.houseFlowObserve(state,gen,value.menu._meta.flow,family());
  const accepted=await promote(c,state,gen,value,now);
  assert.equal(accepted,true,'complete coherent candidate must promote');
  return {state,gen};
}
const resolve=(c,state,service=SERVICE,now=NOW)=>plain(c.houseFlowResolve(state,clone(service),now));
function unavailable(out,label){assert.equal(out.status,'unavailable',label);assert.equal(out.counts,null,label);assert.ok(typeof out.reason==='string'&&out.reason.length,label);}
function valid(out,count,label){assert.equal(out.status,'valid',label);assert.equal(out.counts.Regular,count,label);}

test('F4 fixture control: independent receipt is SHA-256 and distinguishes six synthetic discharges',()=>{
  assert.match(receipt(inputs()).inputRevision,/^sha256:[a-f0-9]{64}$/);
  assert.notEqual(receipt(inputs()).components.registry,receipt(inputs(142)).components.registry);
  assert.equal(receipt(inputs()).components.menu,receipt(inputs(142)).components.menu);
  assert.equal(candidate().routing.flow.rotation['2'].FRIDAY.dinner.counts.Regular,148);
});

test('F4 receipt: exact independent canonical SHA-256, stable under object serialization order',async()=>{
  const c=core(),x=inputs();
  assert.deepEqual(plain(await c.houseFlowReceipt(clone(x))),receipt(x));
  assert.deepEqual(plain(await c.houseFlowReceipt(reorder(x))),receipt(x));
});
test('F4 receipt: export/check/cache metadata cannot create a new logical revision',async()=>{
  const c=core(),x=inputs(),a=await c.houseFlowReceipt(clone(x));
  x._meta={exported:'2099-01-01',checkedAt:'2099-01-01'};x._cachedAt=1;
  assert.deepEqual(plain(await c.houseFlowReceipt(x)),plain(a));
});
test('F4 receipt: resident and tag set order does not change routing identity',async()=>{
  const c=core(),a=inputs();a.registry.residents[0].tags=['No Corn','Vegan'];a.registry.anaphRooms=['synthetic-001','synthetic-002'];
  const b=clone(a);b.registry.residents[0].tags.reverse();b.registry.residents.reverse();b.registry.anaphRooms.reverse();
  assert.equal((await c.houseFlowReceipt(a)).inputRevision,(await c.houseFlowReceipt(b)).inputRevision);
});
for(const [name,change] of [
  ['six discharges',x=>x.registry.residents.splice(0,6)],
  ['anaphylactic membership',x=>{x.registry.residents[0].isAnaph=true;x.registry.anaphRooms.push(x.registry.residents[0].room);}],
  ['same-label recipe binding',x=>x.menu['2'].FRIDAY.dinner_slots.main.recipeId='fixture-coconut-rice'],
  ['shared Library warning override',x=>x.recipe.sharedOverrides.push({recipeId:'fixture-rice',allergenState:'known',allergenFlags:{hasCoconut:true}})],
  ['real removal tombstone',x=>x.dated.removed['2026-11-06-dinner']='2026-11-06T11:00:00Z'],
  ['calendar basis',x=>x.calendar.cycleStart='2026-06-14']
]) test('F4 receipt changes for '+name,async()=>{
  const c=core(),a=inputs(),b=clone(a);change(b);
  assert.notEqual((await c.houseFlowReceipt(a)).inputRevision,(await c.houseFlowReceipt(b)).inputRevision);
});
test('F4 receipt: public receipt contains aggregate digests, no resident fields or record hashes',async()=>{
  const c=core(),out=plain(await c.houseFlowReceipt(inputs()));
  const text=JSON.stringify(out);
  assert.doesNotMatch(text,/synthetic-|anaphRooms|"residents"|"room"|"tags"/);
  assert.deepEqual(Object.keys(out).sort(),['calendar','components','inputRevision','schema']);
});
test('F4 receipt: nonfinite routing inputs cannot receive a certified identity',async()=>{
  const c=core(),x=inputs();x.registry.residents[0].unknownQuantity=Infinity;
  await assert.rejects(()=>c.houseFlowReceipt(x));
});

test('F4 resolution: coherent rotation yields real counts including a legitimate zero cohort',async()=>{
  const c=core();const a=await active(c);valid(resolve(c,a.state),148);
  const b=await active(c,candidate(inputs(0)));valid(resolve(c,b.state),0,'zero is a real valid cohort');
});
test('F4 resolution: dated swap applies only to exact date; next cycle returns rotation with DOOR closed',async()=>{
  const c=core(),x=candidate(swappedInputs()),{state}=await active(c,x);
  assert.deepEqual(resolve(c,state).counts._components,{'Fixture Sausages':148});
  // New service date is independent of current observation time; a make-ahead lookup can target next cycle.
  assert.deepEqual(resolve(c,state,{...SERVICE,date:'2026-12-04'}).counts._components,{'Fixture Rice':148});
});
test('F4 resolution: applicable unavailable override cannot fall through to rotation',async()=>{
  const c=core(),x=candidate(swappedInputs());x.routing.flow.dated['2026-11-06'].dinner={status:'unavailable',reason:'anaphylactic-input-unknown'};
  const {state}=await active(c,x);unavailable(resolve(c,state),'unknown dated routing cannot use ordinary meal counts');
});
test('F4 resolution: component quantities retain their own semantics and are not reconciled to sections',async()=>{
  const c=core(),x=candidate();x.routing.flow.rotation['2'].FRIDAY.dinner.counts={Regular:148,'Anaphylactic Alternative':2,_components:{'Fixture Rice':147}};
  const {state}=await active(c,x);const out=resolve(c,state);valid(out,148);assert.equal(out.counts._components['Fixture Rice'],147);
});
test('F4 resolution: missing base slot and incompatible service site/calendar coordinates are unavailable',async()=>{
  const c=core(),x=candidate();delete x.routing.flow.rotation['2'].FRIDAY.dinner;
  const state=fresh(c),g=begin(c,state);await promote(c,state,g,x);unavailable(resolve(c,state));
  const a=await active(c);
  for(const service of [{...SERVICE,site:'bloor'},{...SERVICE,week:'3'},{...SERVICE,day:'THURSDAY'},
    {...SERVICE,date:'2026-02-30'},{...SERVICE,date:'2026-11-06T12:00:00Z'}]) unavailable(resolve(c,a.state,service));
});
test('F4 resolution: Sunday rollover and DST civil dates do not shift service slots',async()=>{
  const c=core(),x=candidate(),{state}=await active(c,x);
  for(const service of [{...SERVICE,date:'2026-10-24',week:'4',day:'SATURDAY'},
    {...SERVICE,date:'2026-10-25',week:'1',day:'SUNDAY'},
    {...SERVICE,date:'2026-11-01',week:'2',day:'SUNDAY'},
    {...SERVICE,date:'2026-11-02',week:'2',day:'MONDAY'}]) valid(resolve(c,state,service),148);
});
test('F4 resolution: offline age is checked at use, not only loading; unknown cache age cannot certify',async()=>{
  const c=core(),{state}=await active(c);
  valid(resolve(c,state,SERVICE,NOW+MAX_AGE),148);
  unavailable(resolve(c,state,SERVICE,NOW+MAX_AGE+1));
  const other=fresh(c),g=begin(c,other);await promote(c,other,g,candidate(),NOW,{source:'cache',observedAt:null});
  unavailable(resolve(c,other));
});
test('F4 resolution: cached reread cannot reset original verified observation age',async()=>{
  const c=core(),{state}=await active(c),g=begin(c,state);
  await promote(c,state,g,candidate(),NOW+MAX_AGE+1,{source:'cache',observedAt:NOW});
  unavailable(resolve(c,state,SERVICE,NOW+MAX_AGE+1));
});
for(const familyName of ['menu','overlay','registry']) test('F4 known supersession: '+familyName+' receipt invalidates old quantities before routing arrives',async()=>{
  const c=core(),{state}=await active(c),g=begin(c,state),newer=candidate(inputs(142),2);
  c.houseFlowObserve(state,g,newer[familyName]._meta.flow,family(familyName));
  unavailable(resolve(c,state),'known newer input immediately invalidates old internally coherent fallback');
  assert.equal(await promote(c,state,g,newer),true);
  valid(resolve(c,state),142,'matching candidate automatically recovers without staff acknowledgement');
});
test('F4 known supersession: removal receipt prevents old swap counts and restores rotation when coherent',async()=>{
  const c=core(),a=swappedInputs(),{state}=await active(c,candidate(a));
  const b=clone(a);delete b.dated.swaps['2026-11-06-dinner'];b.dated.reverted['2026-11-06-dinner']='2026-11-06T16:00:00Z';
  const next=candidate(b,2),g=begin(c,state);c.houseFlowObserve(state,g,next.menu._meta.flow,family());
  unavailable(resolve(c,state));assert.equal(await promote(c,state,g,next),true);
  assert.deepEqual(resolve(c,state).counts._components,{'Fixture Rice':148});
});
test('F4 generations: late previous response cannot invalidate or recertify the accepted latest candidate',async()=>{
  const c=core(),state=fresh(c),old=begin(c,state),latest=begin(c,state),b=candidate(inputs(142),2);
  c.houseFlowObserve(state,latest,b.registry._meta.flow,family('registry'));assert.equal(await promote(c,state,latest,b),true);
  c.houseFlowObserve(state,old,candidate().menu._meta.flow,family());
  assert.equal(await promote(c,state,old,candidate()),false);valid(resolve(c,state),142);
});
test('F4 generations: later stale CDN response cannot resurrect a known superseded revision',async()=>{
  const c=core(),{state}=await active(c),b=candidate(inputs(142),2),g=begin(c,state);
  c.houseFlowObserve(state,g,b.registry._meta.flow,family('registry'));assert.equal(await promote(c,state,g,b),true);
  const stale=begin(c,state);c.houseFlowObserve(state,stale,candidate().menu._meta.flow,family());
  assert.equal(await promote(c,state,stale,candidate()),false);
  const out=resolve(c,state);assert.ok(out.status!=='valid'||out.counts.Regular===142,'never recertify 148');
});
test('F4 restart: known supersession survives cache restore and an old complete cached set',async()=>{
  const c=core(),{state}=await active(c),g=begin(c,state),b=candidate(inputs(142),2);
  c.houseFlowObserve(state,g,b.registry._meta.flow,family('registry'));unavailable(resolve(c,state));
  const saved=plain(c.houseFlowSnapshot(state));
  const restored=c.houseFlowCreateState({maxAgeMs:MAX_AGE,snapshot:saved}),r=begin(c,restored);
  assert.equal(await promote(c,restored,r,candidate(),NOW,{source:'cache',observedAt:NOW}),false);
  unavailable(resolve(c,restored));assert.equal(await promote(c,restored,r,b),true);valid(resolve(c,restored),142);
});
test('F4 publication: legitimate A to B to A restoration accepts same content at a newer authoritative sequence',async()=>{
  const c=core(),a=candidate(),{state}=await active(c,a),b=candidate(inputs(142),2);
  let g=begin(c,state);c.houseFlowObserve(state,g,b.registry._meta.flow,family('registry'));assert.equal(await promote(c,state,g,b),true);
  const restored=candidate(inputs(),3);
  assert.equal(restored.menu._meta.flow.inputRevision,a.menu._meta.flow.inputRevision,'content identity deliberately returns to A');
  g=begin(c,state);c.houseFlowObserve(state,g,restored.registry._meta.flow,family('registry'));unavailable(resolve(c,state));
  assert.equal(await promote(c,state,g,restored),true,'a former content hash is not permanently banned');valid(resolve(c,state),148);
  g=begin(c,state);assert.equal(await promote(c,state,g,a),false,'old occurrence of identical content remains stale');
});
test('F4 publication: a different epoch cannot silently replace the accepted epoch',async()=>{
  const c=core(),{state}=await active(c),g=begin(c,state),other=candidate(inputs(142),99,'unrecognized-reset');
  c.houseFlowObserve(state,g,other.menu._meta.flow,family());
  assert.equal(await promote(c,state,g,other),false);
  const out=resolve(c,state);assert.ok(out.status!=='valid'||out.counts.Regular===148,'no unapproved epoch counts');
});
test('F4 publication: conflicting content at the same occurrence is not a new authoritative publication',async()=>{
  const c=core(),{state}=await active(c),g=begin(c,state),conflict=candidate(inputs(142),1);
  c.houseFlowObserve(state,g,conflict.registry._meta.flow,family('registry'));
  assert.equal(await promote(c,state,g,conflict),false);
  unavailable(resolve(c,state),'contradictory authoritative occurrence cannot certify either quantity');
});
for(const sequence of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1]) test('F4 publication: invalid sequence '+sequence+' cannot certify counts',async()=>{
  const c=core(),state=fresh(c),g=begin(c,state),x=candidate(inputs(),sequence);
  assert.equal(await promote(c,state,g,x),false);unavailable(resolve(c,state));
});
for(const [name,mutate] of [
  ['menu receipt',x=>x.menu._meta.flow=candidate(inputs(142)).menu._meta.flow],
  ['overlay receipt',x=>x.overlay._meta.flow=candidate(inputs(142)).overlay._meta.flow],
  ['registry receipt',x=>x.registry._meta.flow=candidate(inputs(142)).registry._meta.flow],
  ['routing representation revision',x=>x.routing.flow.inputRevision='sha256:'+'1'.repeat(64)],
  ['changed menu body',x=>x.menu.menu['2'].FRIDAY.dinner='Different Fixture Rice'],
  ['mixed cached removal map',x=>x.removed['2026-11-06-dinner']='2026-11-06T15:00:00Z'],
  ['unavailable registry receipt',x=>delete x.registry],
  ['publication mismatch with identical content',x=>x.registry._meta.flow.publication.sequence=2],
  ['missing publication occurrence',x=>{for(const key of ['menu','overlay','registry','routing'])delete x[key]._meta.flow.publication;}],
  ['legacy metadata',x=>{for(const key of ['menu','overlay','registry','routing'])delete x[key]._meta.flow;}]
]) test('F4 atomic candidate: rejects '+name,async()=>{
  const c=core(),x=candidate();mutate(x);const state=fresh(c),g=begin(c,state);
  assert.equal(await promote(c,state,g,x),false);unavailable(resolve(c,state));
});
test('F4 validity: unsupported calendar cannot silently become standard mode',async()=>{
  const c=core(),source=inputs();source.calendar.mode='reno';const state=fresh(c),g=begin(c,state);
  assert.equal(await promote(c,state,g,candidate(source)),false);unavailable(resolve(c,state));
});
test('F4 validity: malformed negative or nonnumeric counts never become a certified quantity',async()=>{
  const c=core();
  for(const count of [-1,'148',null]) {
    const x=candidate();x.routing.flow.rotation['2'].FRIDAY.dinner.counts.Regular=count;
    const state=fresh(c),g=begin(c,state);await promote(c,state,g,x);unavailable(resolve(c,state));
  }
});
test('F4 read-only projection: staff notes, overrides, completion and stock inputs remain intact',async()=>{
  const c=core(),x=candidate();x.staff={notes:{task:'Keep kitchen note'},overrides:{task:{cookDate:'2026-11-05'}},completed:['task'],stock:{rice:6}};
  const before=canonical(x),state=fresh(c),g=begin(c,state);
  await c.houseFlowPromote(state,g,x,{now:NOW,source:'live'});resolve(c,state);
  assert.equal(canonical(x),before,'candidate validation and count lookup cannot edit source records');
  assert.equal(digest(x.staff),digest(JSON.parse(before).staff));
});
