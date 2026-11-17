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

// Independent release invariant: a stale uninitialized state cannot acknowledge
// a serving frame while retaining no accepted private authority.
test('public acknowledgement cannot create initialized serving-without-accepted authority',async()=>{
 const c=api(),initial=await observe(c),prepared=await preparedPublic(c);
 const r=await apply(c,initial,prepared.operation,publicEvent());
 assert.equal(r.ok,false,'stale missing-private state must be rejected, never initialized with accepted:null');
});