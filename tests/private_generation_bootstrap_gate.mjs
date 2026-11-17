// Frozen gate-author contract before builder. All identities/payloads synthetic.
// No live reads, operational registry, generated resident IDs or transport calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';
const html=fs.readFileSync(process.env.PRIVATE_BOOTSTRAP_HTML||new URL('../index.html',import.meta.url),'utf8');
const clone=v=>structuredClone(v),plain=v=>JSON.parse(JSON.stringify(v));
const sha=s=>createHash('sha1').update('SYNTHETIC '+s).digest('hex');
const digest=s=>'sha256:'+createHash('sha256').update(s).digest('hex');
const P0=sha('README head'),U0=sha('public code head'),U1=sha('first public release'),U2=sha('later public code head');
const frame={
 A:{generationId:'11111111-1111-4111-8111-111111111111',operationId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',privateCommit:sha('private accepted A'),publicInputWitness:digest('witness A'),basis:digest('independent basis A')},
 B:{generationId:'22222222-2222-4222-8222-222222222222',operationId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',privateCommit:sha('private accepted B'),publicInputWitness:digest('witness B'),basis:digest('independent basis B')},
 C:{generationId:'33333333-3333-4333-8333-333333333333',operationId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',privateCommit:sha('private accepted C'),publicInputWitness:digest('witness C'),basis:digest('independent basis C')}
};
const config={schema:1,privateRepositoryId:9001,publicRepositoryId:9002};
const repositoryIds={private:9001,public:9002};
const repo=privateRepo=>({id:privateRepo?9001:9002,visibility:privateRepo?'private':'public',permissions:{push:true}});
const ref=(x='A')=>{const f=frame[x];return{schema:1,generationId:f.generationId,privateCommit:f.privateCommit,operationId:f.operationId,publicInputWitness:f.publicInputWitness}};
const candidate=(x='A')=>{const f=frame[x];return{schema:1,generationId:f.generationId,operationId:f.operationId,publicInputWitness:f.publicInputWitness,publicProjectionBasisDigest:f.basis}};
const absent=(path,head)=>({status:'absent',source:'authenticated-git-tree',path,atCommit:head});
const present=(path,head,value)=>({...absent(path,head),status:'present',value:clone(value)});
function bundle(x='A',parent=x==='A'?null:frame.A.generationId){
 const f=frame[x],files={'registry.json':JSON.stringify({schema:1,residents:[{synthetic:'one'},{synthetic:'two'}]}),
 'menu.json':JSON.stringify({schema:1,breakfastDefinitions:{state:'unresolved'},synthetic:true})};
 const pointer={schema:1,generationId:f.generationId,operationId:f.operationId,parentAcceptedGenerationId:parent};
 return{repository:repo(true),commit:f.privateCommit,accepted:pointer,
 manifest:{schema:1,generationId:f.generationId,operationId:f.operationId,parentAcceptedGenerationId:parent,intent:'accepted-edit',
 privateFiles:Object.entries(files).map(([path,body])=>({path,sha256:digest(body)})),publicInputWitness:f.publicInputWitness,
 publicProjectionBasisDigest:f.basis,createdAt:'2026-11-17T00:00:00Z'},files};
}
function projection(x='A'){
 const resolution=(state,known)=>({schema:1,state,expectedResidents:2,ordinaryResolved:known?2:0,ordinaryUnresolved:known?0:2,
 separateResidents:0,separateDefinitionState:'not-required',quantitiesComplete:known,definitionRevision:'synthetic-definition',
 catalogueRevision:'synthetic-catalogue',inputRevision:frame[x].publicInputWitness});
 return{schema:1,generationRef:ref(x),registrySummary:{total:2,active:2,anaphylactic:0,privateCanary:'CONFIDENTIAL'},services:[
 {key:'1|MONDAY|breakfast',menu:{regular:'Synthetic breakfast',vegan:'',halal:''},components:[],sectionCounts:{},
 resolution:resolution('unavailable',false),componentAllocations:{'Must not emit partial breakfast':1},privateCanary:'CONFIDENTIAL'},
 {key:'1|MONDAY|lunch',menu:{regular:'Synthetic lunch',vegan:'',halal:''},components:[{recipeId:'synthetic-lunch',name:'Synthetic lunch',role:'main'}],
 sectionCounts:{Regular:2},componentAllocations:{'Synthetic lunch':2},resolution:resolution('complete',true)}]};
}
function observation(accepted=null,serving=null,publicHead=serving?U1:U0){
 const head=accepted?frame[accepted].privateCommit:P0;
 return{schema:1,private:{repository:repo(true),head,accepted:accepted?present('accepted.json',head,bundle(accepted).accepted):absent('accepted.json',head),
 ...(accepted?{package:bundle(accepted),expectedProjectionBasisDigest:frame[accepted].basis}:{})},
 public:{repository:repo(false),head:publicHead,pin:serving?present('protocol-v1/publication.json',publicHead,ref(serving)):absent('protocol-v1/publication.json',publicHead),
 ...(serving?{package:bundle(serving),projection:projection(serving),expectedProjectionBasisDigest:frame[serving].basis}:{})}};
}
const receipt=(privateRepo,commit,parent)=>({kind:'authenticated-git-cas-commit',repository:repo(privateRepo),commit:{sha:commit,parents:[parent]},refUpdate:{before:parent,after:commit,compareAndSwap:true}});
const privateEvent=(x='A',parent=null)=>({type:'private-accepted',operationId:frame[x].operationId,
 receipt:receipt(true,frame[x].privateCommit,parent?frame[parent].privateCommit:P0),package:bundle(x,parent?frame[parent].generationId:null)});
const publicEvent=(x='A',head=U1)=>({type:'public-committed',operationId:frame[x].operationId,
 receipt:receipt(false,head,U0),pin:present('protocol-v1/publication.json',head,ref(x)),package:bundle(x),projection:projection(x)});
function api(crypto=webcrypto){
 const regions=['private-generation-v1','private-bootstrap-v1'];let source='';
 for(const region of regions){const begin='/* DOOR_TESTABLE_CORE_START '+region+' */',end='/* DOOR_TESTABLE_CORE_END '+region+' */';
 const a=html.indexOf(begin),z=html.indexOf(end,a+begin.length);assert.ok(a>=0&&z>a,'pure marked '+region+' core must exist');source+=html.slice(a+begin.length,z)+'\n'}
 const noIO=()=>{throw Error('Inactive bootstrap attempted I/O')};
 const c=vm.createContext({crypto,TextEncoder,TextDecoder,console,fetch:noIO,localStorage:{getItem:noIO,setItem:noIO,removeItem:noIO}});
 vm.runInContext(source,c);
 for(const name of ['doorPrivateBootstrapV1Observe','doorPrivateBootstrapV1Plan','doorPrivateBootstrapV1Apply','doorPrivateBootstrapV1Recover'])assert.equal(typeof c[name],'function',name);
 return c;
}
const observe=async(c,o=observation())=>{const r=plain(await c.doorPrivateBootstrapV1Observe(o,config));assert.equal(r.ok,true);assert.deepEqual(r.state.repositoryIds,repositoryIds);return r.state};
const plan=(c,s,x='A')=>{const r=plain(c.doorPrivateBootstrapV1Plan(s,candidate(x),config));assert.equal(r.ok,true);assert.equal(r.effect,'write-private');assert.deepEqual(r.operation.repositoryIds,repositoryIds);return r.operation};
const apply=async(c,s,op,e)=>plain(await c.doorPrivateBootstrapV1Apply(s,op,e,config));
async function acceptedA(c){const state=await observe(c),op=plan(c,state),r=await apply(c,state,op,privateEvent());assert.equal(r.ok,true);return r}
async function preparedPublic(c){const r=await acceptedA(c),p=await apply(c,r.state,r.operation,{type:'public-prepare',operationId:frame.A.operationId,projection:projection()});assert.equal(p.ok,true);return p}
async function acceptedB(c){const a=await acceptedA(c),op=plan(c,a.state,'B'),r=await apply(c,a.state,op,privateEvent('B','A'));assert.equal(r.ok,true);return r}

test('actual pure bootstrap APIs exist without storage or transport callers',()=>{api()});
test('configuration rejects unsupported schema, same repository IDs and nonpositive/noninteger IDs',async()=>{
 for(const cfg of[{...config,schema:99},{...config,publicRepositoryId:config.privateRepositoryId},{...config,privateRepositoryId:0},{...config,privateRepositoryId:1.5}])
 assert.equal((await api().doorPrivateBootstrapV1Observe(observation(),cfg)).ok,false);
});
test('README-only authority is explicitly uninitialized with real captured heads and no dummy references',async()=>{
 const c=api(),o=observation(),before=JSON.stringify(o),s=await observe(c,o);
 assert.equal(s.phase,'uninitialized');assert.equal(s.accepted,null);assert.equal(s.serving,null);assert.equal(s.privateHead,P0);assert.equal(s.publicHead,U0);
 assert.equal(JSON.stringify(o),before);assert.ok(!JSON.stringify(s).includes('residents'));
});
for(const [label,change]of[
 ['403',o=>o.private.accepted={status:'error',statusCode:403}],['network failure',o=>o.private.accepted={status:'unknown',reason:'network'}],
 ['Pages 404',o=>o.private.accepted.source='pages-http-404'],['missing read',o=>delete o.private.accepted],
 ['wrong read commit',o=>o.private.accepted.atCommit=sha('other head')],['mutable branch',o=>o.private.head='main'],
 ['wrong private path',o=>o.private.accepted.path='door_state.json'],['wrong public path',o=>o.public.pin.path='publication.json'],
 ['absence carrying value',o=>o.private.accepted.value={}]
])test('absence is not manufactured from '+label,async()=>{const o=observation();change(o);assert.equal((await api().doorPrivateBootstrapV1Observe(o,config)).ok,false)});
for(const [label,change]of[
 ['wrong private repository',o=>o.private.repository.id=9991],['changed private visibility',o=>o.private.repository.visibility='public'],
 ['view-only private access',o=>o.private.repository.permissions.push=false],['wrong public repository',o=>o.public.repository.id=9992],
 ['unverified public write capability',o=>delete o.public.repository.permissions]
])test('fixed authority rejects '+label,async()=>{const o=observation();change(o);assert.equal((await api().doorPrivateBootstrapV1Observe(o,config)).ok,false)});
test('private accepted input with no public pin is durable accepted-never-served, not initialized',async()=>{
 const c=api(),s=await observe(c,observation('A'));assert.equal(s.phase,'accepted-never-served');assert.deepEqual(s.accepted,ref());assert.equal(s.serving,null);
 assert.ok(!JSON.stringify(s).includes('breakfastDefinitions'));
});
for(const [label,change]of[
 ['prepared-only',o=>o.private.package.manifest.intent='prepare-only'],['changed file',o=>o.private.package.files['registry.json']+=' '],
 ['missing independent basis',o=>delete o.private.expectedProjectionBasisDigest],['wrong independent basis',o=>o.private.expectedProjectionBasisDigest=frame.B.basis],
 ['pointer parent mismatch',o=>o.private.accepted.value.parentAcceptedGenerationId=frame.C.generationId],
 ['bundle pointer-only wrong parent',o=>o.private.package.accepted.parentAcceptedGenerationId=frame.C.generationId],
 ['bundle pointer schema missing',o=>delete o.private.package.accepted.schema],['bundle pointer schema unsupported',o=>o.private.package.accepted.schema=99],
 ['bundle pointer parent missing',o=>delete o.private.package.accepted.parentAcceptedGenerationId]
])test('accepted observation rejects '+label,async()=>{const o=observation('A');change(o);assert.equal((await api().doorPrivateBootstrapV1Observe(o,config)).ok,false)});
test('public pin without private accepted authority cannot bootstrap from a public fallback',async()=>{assert.equal((await api().doorPrivateBootstrapV1Observe(observation(null,'A'),config)).ok,false)});
test('newer accepted and older serving packages independently validate different projection bases',async()=>{
 const c=api(),s=await observe(c,observation('B','A'));assert.equal(s.phase,'initialized');assert.deepEqual(s.accepted,ref('B'));assert.deepEqual(s.serving,ref());
 assert.equal(c.doorPrivateV1ServingEligibility(s.accepted,s.serving).eligible,false);
});
test('serving package must come from its exact pin, never private latest or accepted basis',async()=>{
 for(const mutate of[o=>o.public.package=bundle('B'),o=>o.public.expectedProjectionBasisDigest=frame.B.basis,o=>o.public.projection.generationRef=ref('B'),
 o=>o.public.package.accepted.parentAcceptedGenerationId=frame.C.generationId,o=>delete o.public.package.accepted.schema,o=>delete o.public.package.accepted.parentAcceptedGenerationId]){
 const o=observation('B','A');mutate(o);assert.equal((await api().doorPrivateBootstrapV1Observe(o,config)).ok,false)}
});
test('first plan captures nullable parents and its own precommit basis without guessing a target commit',async()=>{
 const c=api(),s=await observe(c),op=plan(c,s);assert.equal(op.expectedPrivateHead,P0);assert.equal(op.expectedPublicHead,U0);
 assert.equal(op.parentAccepted,null);assert.equal(op.expectedServing,null);assert.equal(op.publicProjectionBasisDigest,frame.A.basis);
 assert.equal(op.phase,'prepared');assert.ok(!Object.hasOwn(op,'privateCommit'));op.generationId='changed';assert.equal(s.accepted,null);
});
test('plan rejects guessed commit, reused identity and initialized bootstrap reset',async()=>{
 const c=api(),none=await observe(c);assert.equal(c.doorPrivateBootstrapV1Plan(none,{...candidate(),privateCommit:frame.A.privateCommit},config).ok,false);
 const pending=await observe(c,observation('A'));assert.equal(c.doorPrivateBootstrapV1Plan(pending,candidate(),config).ok,false);
 const initialized=await observe(c,observation('A','A'));assert.equal(c.doorPrivateBootstrapV1Plan(initialized,candidate('B'),config).ok,false);
});
test('persisted state and operation cannot be retargeted by changing configured repository IDs',async()=>{
 const c=api(),s=await observe(c),op=plan(c,s),cfg={...config,privateRepositoryId:9991};
 assert.equal(c.doorPrivateBootstrapV1Plan(s,candidate('B'),cfg).ok,false);
 assert.equal((await c.doorPrivateBootstrapV1Apply(s,op,privateEvent(),cfg)).ok,false);
 const newRepo=observation();newRepo.private.repository.id=9991;
 assert.equal((await c.doorPrivateBootstrapV1Recover(op,newRepo,cfg)).ok,false);
 const badState=clone(s);badState.repositoryIds.private=9991;assert.equal(c.doorPrivateBootstrapV1Plan(badState,candidate(),config).ok,false);
});
test('first private CAS obtains the actual receipt commit and never invents serving authority',async()=>{
 const c=api(),r=await acceptedA(c);assert.equal(r.state.phase,'accepted-never-served');assert.deepEqual(r.state.accepted,ref());assert.equal(r.state.privateHead,frame.A.privateCommit);
 assert.equal(r.state.publicHead,U0);assert.equal(r.state.serving,null);assert.equal(r.operation.privateCommit,frame.A.privateCommit);assert.equal(r.operation.phase,'accepted-release-pending');
});
for(const [label,change]of[
 ['wrong repo',e=>e.receipt.repository.id=9991],['wrong parent',e=>e.receipt.commit.parents=[sha('not leased')]],
 ['non-CAS ref update',e=>e.receipt.refUpdate.compareAndSwap=false],['wrong ref predecessor',e=>e.receipt.refUpdate.before=sha('not leased')],
 ['branch instead of returned commit',e=>e.receipt.commit.sha='main'],['different package commit',e=>e.package.commit=frame.B.privateCommit],
 ['manifest self-rebound basis',e=>e.package.manifest.publicProjectionBasisDigest=frame.B.basis],
 ['bundle pointer-only wrong parent',e=>e.package.accepted.parentAcceptedGenerationId=frame.B.generationId],
 ['bundle pointer missing schema',e=>delete e.package.accepted.schema],['bundle pointer unsupported schema',e=>e.package.accepted.schema=99],
 ['bundle pointer missing parent',e=>delete e.package.accepted.parentAcceptedGenerationId],
 ['accepted/manifest parent not captured null',e=>{e.package.accepted.parentAcceptedGenerationId=frame.B.generationId;e.package.manifest.parentAcceptedGenerationId=frame.B.generationId}]
])test('private acceptance rejects '+label+' before changing authority',async()=>{const c=api(),s=await observe(c),op=plan(c,s),e=privateEvent(),before=JSON.stringify(s);change(e);
 assert.equal((await apply(c,s,op,e)).ok,false);assert.equal(JSON.stringify(s),before)});
test('private timeout is unconfirmed, never proof accepted or absent',async()=>{
 const c=api(),s=await observe(c),op=plan(c,s),r=await apply(c,s,op,{type:'private-unconfirmed',operationId:frame.A.operationId});
 assert.equal(r.ok,true);assert.equal(r.state.accepted,null);assert.equal(r.state.serving,null);assert.equal(r.operation.phase,'private-unconfirmed');assert.ok(!r.operation.privateCommit);
});
test('same private acknowledgement is idempotent and a competing initializer cannot overwrite it',async()=>{
 const c=api(),r=await acceptedA(c),again=await apply(c,r.state,r.operation,privateEvent());assert.equal(again.ok,true);assert.deepEqual(again.state,r.state);
 const old=await observe(c),competing=plan(c,old,'B'),before=JSON.stringify(r.state);
 assert.equal((await apply(c,r.state,competing,privateEvent('B'))).ok,false);assert.equal(JSON.stringify(r.state),before);
});
test('public prepare preserves valid lunch while unknown breakfast demand stays omitted and raw evidence stripped',async()=>{
 const c=api(),r=await preparedPublic(c);assert.equal(r.effect.type,'write-public');assert.equal(r.effect.expectedPublicHead,U0);assert.equal(r.effect.expectedServing,null);
 assert.equal(r.effect.projection.services[0].resolution.state,'unavailable');assert.ok(!Object.hasOwn(r.effect.projection.services[0],'componentAllocations'));
 assert.equal(r.effect.projection.services[1].componentAllocations['Synthetic lunch'],2);assert.ok(!JSON.stringify(r.effect).includes('CONFIDENTIAL'));
});
test('newer accepted private intake before first public prepare stops stale release, not private editing',async()=>{
 const c=api(),a=await acceptedA(c),b=await acceptedB(c),before=JSON.stringify(b.state);
 const r=await apply(c,b.state,a.operation,{type:'public-prepare',operationId:frame.A.operationId,projection:projection()});
 assert.equal(r.ok,false);assert.equal(JSON.stringify(b.state),before);assert.deepEqual(b.state.accepted,ref('B'));assert.equal(b.state.serving,null);
});
test('public failure leaves private accepted input intact and honestly never served',async()=>{
 const c=api(),p=await preparedPublic(c),r=await apply(c,p.state,p.operation,{type:'public-unconfirmed',operationId:frame.A.operationId});
 assert.equal(r.ok,true);assert.deepEqual(r.state.accepted,ref());assert.equal(r.state.serving,null);assert.equal(r.state.phase,'accepted-never-served');assert.equal(r.operation.phase,'accepted-release-pending');
});
test('first public commit uses verified pin/readback and has no private activation tail',async()=>{
 const c=api(),p=await preparedPublic(c),r=await apply(c,p.state,p.operation,publicEvent());assert.equal(r.ok,true);assert.equal(r.state.phase,'initialized');
 assert.equal(r.state.publicHead,U1);assert.equal(r.state.privateHead,frame.A.privateCommit);assert.deepEqual(r.state.serving,ref());assert.equal(r.operation.phase,'released');
 assert.equal(r.operation.latestInputReleased,true);assert.equal(r.operation.needsRebase,false);assert.ok(!r.effect||r.effect.type!=='write-private');
});
for(const [label,change]of[
 ['stale public lease',e=>e.receipt.refUpdate.before=sha('other public parent')],['unverified pin absence/HTTP readback',e=>e.pin.source='pages-http'],
 ['pin at different commit',e=>e.pin.atCommit=U2],['different pin',e=>e.pin.value=ref('B')],['private latest fallback',e=>e.package=bundle('B')],
 ['different projection',e=>e.projection=projection('B')]
])test('first public acknowledgement rejects '+label,async()=>{const c=api(),p=await preparedPublic(c),e=publicEvent(),before=JSON.stringify(p.state);change(e);
 assert.equal((await apply(c,p.state,p.operation,e)).ok,false);assert.equal(JSON.stringify(p.state),before)});
test('private change during first public write is retained with truthful stale released serving frame',async()=>{
 const c=api(),p=await preparedPublic(c),b=await acceptedB(c),r=await apply(c,b.state,p.operation,publicEvent());assert.equal(r.ok,true);
 assert.deepEqual(r.state.accepted,ref('B'));assert.equal(r.state.privateHead,frame.B.privateCommit);assert.deepEqual(r.state.serving,ref());
 assert.equal(r.operation.phase,'released-stale');assert.equal(r.operation.latestInputReleased,false);assert.equal(r.operation.needsRebase,true);
});
test('duplicate private ACK after release cannot downgrade released operation or public authority',async()=>{
 const c=api(),p=await preparedPublic(c),released=await apply(c,p.state,p.operation,publicEvent()),again=await apply(c,released.state,released.operation,privateEvent());
 assert.equal(again.ok,true);assert.deepEqual(again.state,released.state);assert.equal(again.operation.phase,'released');assert.equal(again.operation.latestInputReleased,true);
});
test('late unconfirmed events cannot downgrade accepted or released history',async()=>{
 const c=api(),a=await acceptedA(c),p=await preparedPublic(c),released=await apply(c,p.state,p.operation,publicEvent()),b=await acceptedB(c),stale=await apply(c,b.state,p.operation,publicEvent());
 for(const r of[a,p,released,stale])assert.equal((await apply(c,r.state,r.operation,{type:'private-unconfirmed',operationId:frame.A.operationId})).ok,false);
 for(const r of[released,stale])assert.equal((await apply(c,r.state,r.operation,{type:'public-unconfirmed',operationId:frame.A.operationId})).ok,false);
 const old=await observe(c),notAccepted=plan(c,old);assert.equal((await apply(c,old,notAccepted,{type:'public-unconfirmed',operationId:frame.A.operationId})).ok,false);
});
test('old public ACK keeps later verified code HEAD with same pin, but rejects superseding pin',async()=>{
 const c=api(),p=await preparedPublic(c),released=await apply(c,p.state,p.operation,publicEvent()),later=await observe(c,observation('A','A',U2));
 const again=await apply(c,later,released.operation,publicEvent());assert.equal(again.ok,true);assert.equal(again.state.publicHead,U2);assert.deepEqual(again.state.serving,ref());
 const superseding=await observe(c,observation('B','B',U2)),before=JSON.stringify(superseding);assert.equal((await apply(c,superseding,released.operation,publicEvent())).ok,false);assert.equal(JSON.stringify(superseding),before);
});
test('restart before private commit retries SAME IDs only against the same authoritative absence leases',async()=>{
 const c=api(),s=await observe(c),op=plan(c,s),r=plain(await c.doorPrivateBootstrapV1Recover(op,observation(),config));assert.equal(r.ok,true);assert.equal(r.action,'retry-private');
 assert.equal(r.operation.generationId,op.generationId);assert.equal(r.operation.operationId,op.operationId);assert.equal(r.state.serving,null);assert.equal(r.latestInputReleased,false);
 const advanced=observation();advanced.private.head=sha('README advance');advanced.private.accepted.atCommit=advanced.private.head;
 assert.equal((await c.doorPrivateBootstrapV1Recover(op,advanced,config)).action,'reread-rebase');
});
test('lost private ACK recovers commit only from verified actual matching accepted pointer/package',async()=>{
 const c=api(),s=await observe(c),op=plan(c,s),r=plain(await c.doorPrivateBootstrapV1Recover(op,observation('A'),config));
 assert.equal(r.ok,true);assert.equal(r.action,'resume-public');assert.equal(r.operation.privateCommit,frame.A.privateCommit);assert.deepEqual(r.state.accepted,ref());assert.equal(r.state.serving,null);
});
test('two initializer/newer accepted restart is superseded and never replayed',async()=>{
 const c=api(),s=await observe(c),op=plan(c,s),r=plain(await c.doorPrivateBootstrapV1Recover(op,observation('B'),config));assert.equal(r.ok,true);
 assert.equal(r.action,'superseded');assert.equal(r.needsRebase,true);assert.deepEqual(r.state.accepted,ref('B'));assert.equal(r.latestInputReleased,false);
});
test('restart acknowledges landed first public frame without duplicate write; newer private stays newer',async()=>{
 const c=api(),p=await preparedPublic(c);for(const latest of['A','B']){const r=plain(await c.doorPrivateBootstrapV1Recover(p.operation,observation(latest,'A'),config));
 assert.equal(r.ok,true);assert.equal(r.action,'ack-released');assert.equal(r.latestInputReleased,latest==='A');assert.equal(r.needsRebase,latest!=='A');assert.deepEqual(r.state.accepted,ref(latest));assert.deepEqual(r.state.serving,ref());}
});
test('restart after public code head advance requires explicit parent review, never substitutes lease',async()=>{
 const c=api(),a=await acceptedA(c),r=plain(await c.doorPrivateBootstrapV1Recover(a.operation,observation('A',null,U2),config));
 assert.equal(r.ok,true);assert.equal(r.action,'review-public-head');assert.equal(r.operation.expectedPublicHead,U0);assert.equal(r.state.publicHead,U2);
});
test('already released operation cannot resume/retry from regressed old parent or absence',async()=>{
 const c=api(),p=await preparedPublic(c),released=await apply(c,p.state,p.operation,publicEvent()),b=await acceptedB(c),stale=await apply(c,b.state,p.operation,publicEvent());
 for(const history of[released,stale])for(const o of[observation(),observation('A')]){const r=plain(await c.doorPrivateBootstrapV1Recover(history.operation,o,config));
 assert.ok(r.ok===false||['review','superseded'].includes(r.action));assert.ok(!['retry-private','resume-public'].includes(r.action));assert.notEqual(r.latestInputReleased,true);}
});
test('prepared-only/unavailable restart cannot acknowledge acceptance or serving',async()=>{
 const c=api(),s=await observe(c),op=plan(c,s),o=observation();o.private.orphanPackage=bundle();o.private.orphanPackage.manifest.intent='prepare-only';
 const r=plain(await c.doorPrivateBootstrapV1Recover(op,o,config));assert.equal(r.ok,true);assert.equal(r.action,'retry-private');assert.equal(r.state.accepted,null);
 const denied=observation('A');denied.private.accepted={status:'error',statusCode:403};const bad=plain(await c.doorPrivateBootstrapV1Recover(op,denied,config));assert.ok(bad.ok===false||bad.action==='review');assert.notEqual(bad.latestInputReleased,true);
});
test('observe snapshots both independent frame bases before digest await; caller cannot retarget authority',async()=>{
 let release,entered;const waiting=new Promise(r=>entered=r),hold=new Promise(r=>release=r);let first=true;
 const crypto={subtle:{digest:async(...args)=>{if(first){first=false;entered();await hold}return webcrypto.subtle.digest(...args)}}};
 const c=api(crypto),o=observation('B','A'),cfg=clone(config),pending=c.doorPrivateBootstrapV1Observe(o,cfg);await waiting;
 o.private.head=frame.C.privateCommit;o.private.accepted.value.generationId=frame.C.generationId;o.public.expectedProjectionBasisDigest=frame.C.basis;cfg.privateRepositoryId=9991;release();
 const result=plain(await pending);assert.equal(result.ok,true);assert.deepEqual(result.state.accepted,ref('B'));assert.deepEqual(result.state.serving,ref());
});
test('apply snapshots operation, commit receipt and config before digest await',async()=>{
 let release,entered;const waiting=new Promise(r=>entered=r),hold=new Promise(r=>release=r);let first=true;
 const crypto={subtle:{digest:async(...args)=>{if(first){first=false;entered();await hold}return webcrypto.subtle.digest(...args)}}};
 const c=api(crypto),s=await observe(c),op=plan(c,s),e=privateEvent(),cfg=clone(config),pending=c.doorPrivateBootstrapV1Apply(s,op,e,cfg);await waiting;
 op.generationId=frame.C.generationId;e.receipt.commit.sha=frame.C.privateCommit;e.package.accepted.generationId=frame.C.generationId;cfg.privateRepositoryId=9991;s.privateHead=frame.C.privateCommit;s.repositoryIds.private=9991;release();
 const result=plain(await pending);assert.equal(result.ok,true);assert.deepEqual(result.state.accepted,ref());assert.equal(result.operation.privateCommit,frame.A.privateCommit);
});
test('unknown private payload fields are not spread into references, operations or public effects',async()=>{
 const c=api(),o=observation();o.private.privateCanary='CONFIDENTIAL';const s=await observe(c,o);s.privateCanary='CONFIDENTIAL';
 const cand={...candidate(),privateCanary:'CONFIDENTIAL'},p=plain(c.doorPrivateBootstrapV1Plan(s,cand,config));assert.equal(p.ok,true);assert.ok(!JSON.stringify(p).includes('CONFIDENTIAL'));
 p.operation.privateCanary='CONFIDENTIAL';const e=privateEvent();e.privateCanary='CONFIDENTIAL';const a=await apply(c,s,p.operation,e);assert.equal(a.ok,true);assert.ok(!JSON.stringify(a).includes('CONFIDENTIAL'));
 const pub=await apply(c,a.state,a.operation,{type:'public-prepare',operationId:frame.A.operationId,projection:projection(),privateCanary:'CONFIDENTIAL'});
 assert.equal(pub.ok,true);assert.ok(!JSON.stringify(pub).includes('CONFIDENTIAL'));
 const r=plain(await c.doorPrivateBootstrapV1Recover(a.operation,observation('A'),{...config,privateCanary:'CONFIDENTIAL'}));
 assert.equal(r.ok,true);assert.ok(!JSON.stringify(r).includes('CONFIDENTIAL'));
});
