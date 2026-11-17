// FROZEN independent synthetic episode gate. No real occupants, source lease or ID assignment.
import fs from'node:fs';import vm from'node:vm';import test from'node:test';import assert from'node:assert/strict';import{createHash,webcrypto}from'node:crypto';
const html=fs.readFileSync(process.env.PRIVATE_EPISODE_HTML||new URL('../index.html',import.meta.url),'utf8'),clone=structuredClone,plain=x=>JSON.parse(JSON.stringify(x));
const canon=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canon).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
const digest=v=>'sha256:'+createHash('sha256').update(canon(v)).digest('hex');
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'];
const config={schema:1,privateRepositoryId:9001};
function source(){const snapshot={schema:1,residents:[{room:'Synthetic-A',tags:['Regular'],serviceNote:'PRIVATE_EPISODE_CANARY'},{room:'Synthetic-B',tags:['Regular'],serviceNote:''}],anaphRooms:[],queue:[],reservedEpisodeIds:[],opaqueExtra:'entire snapshot must be covered'};return{schema:1,privateRepositoryId:9001,lease:{sourceId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',revision:'synthetic-current-r1',digest:digest(snapshot)},snapshot}}
function candidate(s=source()){return{schema:1,operationId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',expectedLease:clone(s.lease),assignments:s.snapshot.residents.map((_,sourceRow)=>({sourceRow,episodeId:ids[sourceRow]}))}}
function api(crypto={subtle:webcrypto.subtle}){let text='';for(const region of['private-generation-v1','flow-validity','private-episode-v1']){const owner=region==='flow-validity'?'HOUSE':'DOOR',begin='/* '+owner+'_TESTABLE_CORE_START '+region+' */',end='/* '+owner+'_TESTABLE_CORE_END '+region+' */',a=html.indexOf(begin),b=html.indexOf(end,a+begin.length);assert.ok(a>=0&&b>a,'actual pure '+region+' source must exist');text+=html.slice(a+begin.length,b)+'\n'}const noIO=()=>{throw Error('Inactive identity plan attempted I/O or UUID generation')};const box=vm.createContext({crypto:{...crypto,randomUUID:noIO,getRandomValues:noIO},TextEncoder,TextDecoder,fetch:noIO,localStorage:{getItem:noIO,setItem:noIO,removeItem:noIO},console});vm.runInContext(text,box);return box}
const plan=async(c,s=source(),v=candidate(s),cfg=config)=>plain(await c.doorPrivateEpisodeV1Plan(s,v,cfg));
const check=async(c,p,s=source(),cfg=config)=>plain(await c.doorPrivateEpisodeV1Check(p,s,cfg));

const uid=n=>n.toString(16).padStart(8,'0')+'-0000-4000-8000-000000000000'; // SYNTHETIC fixture IDs only.
async function initialized(c=api(),s=source()){const p=await plan(c,s);assert.equal(p.ok,true);const r=plain(await c.doorPrivateEpisodeV1Initialize(p.plan,s,config));assert.equal(r.ok,true);return r.state}
const evt=(s,type,extra={},n=10)=>({schema:1,operationId:uid(n),expectedEpochId:s.epochId,expectedStateRevision:s.revision,type,...extra});
const reduce=async(c,s,e,cfg=config)=>plain(await c.doorPrivateEpisodeV1Reduce(s,e,cfg));
const row=(s,id=ids[0])=>s.records.find(r=>r.episodeId===id);
// Independent release probes, synthetic source only.
test('multi-step batch journals once and delayed replay returns later current move',async()=>{
 const c=api(),s=await initialized(c),e=evt(s,'queue',{actions:[{type:'edit',episodeId:ids[0],expectedEpisodeRevision:1,patch:{set:{serviceNote:'first'},remove:[]}},{type:'edit',episodeId:ids[0],expectedEpisodeRevision:2,patch:{set:{serviceNote:'second'},remove:[]}}]});
 const r=await reduce(c,s,e);assert.equal(r.ok,true);assert.equal(r.state.revision,2);assert.equal(row(r.state).revision,3);assert.equal(r.state.operations.length,1);assert.equal(r.state.history.length,2);
 const moved=await reduce(c,r.state,evt(r.state,'move',{moves:[{episodeId:ids[0],expectedEpisodeRevision:3,toRoom:'Synthetic-C'}]},11));assert.equal(moved.ok,true);
 const replay=await reduce(c,plain(moved.state),e);assert.equal(replay.ok,true);assert.equal(replay.replayed,true);assert.deepEqual(replay.state,moved.state);assert.equal(row(replay.state).resident.room,'Synthetic-C');assert.equal(replay.state.requiresServingRevalidation,true);
});
test('convenience restore cannot resurrect service instructions after explicit absence',async()=>{
 const c=api(),src=source();src.snapshot.residents[0].serviceInstructions={synthetic:'old direction'};src.lease.digest=digest(src.snapshot);const s=await initialized(c,src);
 const removed=await reduce(c,s,evt(s,'edit',{episodeId:ids[0],expectedEpisodeRevision:1,patch:{set:{serviceNote:'new note'},remove:['serviceInstructions']}}));assert.equal(removed.ok,true);
 const blocked=await reduce(c,removed.state,evt(removed.state,'restore-active',{episodeId:ids[0],expectedEpisodeRevision:2,targetHistoryRevision:1,fields:['serviceInstructions']},11));assert.equal(blocked.ok,false);
 const allowed=await reduce(c,removed.state,evt(removed.state,'restore-active',{episodeId:ids[0],expectedEpisodeRevision:2,targetHistoryRevision:1,fields:['serviceNote']},12));assert.equal(allowed.ok,true);assert.equal(Object.hasOwn(row(allowed.state).resident,'serviceInstructions'),false);assert.equal(allowed.state.requiresServingRevalidation,true);
});
test('old anaphylactic room evidence never gives a fresh occupant inherited flags or clears review',async()=>{
 const c=api(),src=source();src.snapshot.residents[0].isAnaph=true;src.snapshot.anaphRooms=['Synthetic-A'];src.lease.digest=digest(src.snapshot);const s=await initialized(c,src);
 const moved=await reduce(c,s,evt(s,'move',{moves:[{episodeId:ids[0],expectedEpisodeRevision:1,toRoom:'Synthetic-C'}]}));assert.equal(moved.ok,true);assert.equal(row(moved.state).resident.isAnaph,true);
 const fresh=await reduce(c,moved.state,evt(moved.state,'intake',{newEpisodeId:ids[3],resident:{room:'Synthetic-A',tags:['Regular']}},11));assert.equal(fresh.ok,true);assert.equal(Object.hasOwn(row(fresh.state,ids[3]).resident,'isAnaph'),false);assert.deepEqual(fresh.state.sidecars.anaphRooms,['Synthetic-A']);assert.equal(fresh.state.requiresServingRevalidation,true);assert.equal(fresh.requiresServingRevalidation,true);
});
test('legacy opaque prototype-named source fields copy safely without polluting or entering metadata',async()=>{
 const c=api(),src=source();Object.defineProperty(src.snapshot.residents[0],'__proto__',{value:{syntheticSource:true},enumerable:true,writable:true});src.lease.digest=digest(src.snapshot);const p=await plan(c,src);assert.equal(p.ok,true);assert.equal(JSON.stringify(p).includes('syntheticSource'),false);
 const initializedResult=plain(await c.doorPrivateEpisodeV1Initialize(p.plan,src,config));assert.equal(initializedResult.ok,true);assert.equal(Object.hasOwn(row(initializedResult.state).resident,'__proto__'),true);assert.equal({}.syntheticSource,undefined);assert.equal(src.snapshot.residents[0].room,'Synthetic-A');
});