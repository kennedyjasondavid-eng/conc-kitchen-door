// Gate author: inactive private-generation foundation. Frozen before builder.
// The only product seam is a pure marked core; no active storage/transport/hydration.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import{createHash,webcrypto}from'node:crypto';
const source=fs.readFileSync(process.env.PRIVATE_FOUNDATION_HTML||new URL('../index.html',import.meta.url),'utf8');
const BEGIN='/* DOOR_TESTABLE_CORE_START private-generation-v1 */',END='/* DOOR_TESTABLE_CORE_END private-generation-v1 */';
const plain=v=>JSON.parse(JSON.stringify(v)),clone=v=>structuredClone(v);let api;
function core(){if(api)return api;const a=source.indexOf(BEGIN),z=source.indexOf(END,a+BEGIN.length);assert.ok(a>=0&&z>a,'inactive private-generation-v1 marked core must exist');const noIO=()=>{throw Error('Inactive foundation attempted I/O')};const box=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,console,fetch:noIO,localStorage:{getItem:noIO,setItem:noIO,removeItem:noIO}});vm.runInContext(source.slice(a+BEGIN.length,z),box);api=box;for(const name of ['doorPrivateV1ProjectPublic','doorPrivateV1ValidatePackage','doorPrivateV1Transition','doorPrivateV1Recover','doorPrivateV1ServingEligibility'])assert.equal(typeof api[name],'function',name+' API must exist');return api}
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333',O='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';const ca='a'.repeat(40),cb='b'.repeat(40),cc='c'.repeat(40),w='sha256:'+('1'.repeat(64)),basis='sha256:'+('2'.repeat(64));
const ref=(generationId=A,privateCommit=ca)=>({schema:1,generationId,privateCommit,operationId:O,publicInputWitness:w});
const accepted=(generationId=A,privateCommit=ca)=>({generationId,privateCommit});
function snapshot(state='complete'){return{schema:1,generationRef:{...ref(),privateEvidence:'CONFIDENTIAL_PIN'},registrySummary:{total:2,active:2,anaphylactic:0,residents:[{name:'CONFIDENTIAL_RESIDENT'}],serviceInstructions:'CONFIDENTIAL_REQUEST'},services:[{key:'1|MONDAY|breakfast',menu:{regular:'Rice cereal',vegan:'Rice cereal',halal:'Rice cereal',source:'CONFIDENTIAL_MENU_SOURCE'},components:[{recipeId:'rice-cereal',name:'Rice cereal',role:'cereal',evidence:'CONFIDENTIAL_COMPONENT_SOURCE'}],sectionCounts:{Regular:1,Vegan:1},componentAllocations:{'Rice cereal':2},resolution:{schema:1,state,expectedResidents:2,ordinaryResolved:state==='complete'?2:1,ordinaryUnresolved:state==='complete'?0:1,separateResidents:0,separateDefinitionState:'not-required',quantitiesComplete:state==='complete',definitionRevision:'def-v1',catalogueRevision:'cat-v1',inputRevision:w,requests:'CONFIDENTIAL_ASSESSMENT'},sourceEvidence:'CONFIDENTIAL_SERVICE_SOURCE',originals:{name:'CONFIDENTIAL_ORIGINAL'}}],privateRegistry:{name:'CONFIDENTIAL_ROOT'}}}
function bundle(){const files={'registry.json':JSON.stringify({schema:1,residents:[{episode:'synthetic',serviceInstructions:{schema:1,entries:[]}}]}),'menu.json':JSON.stringify({schema:1,breakfastDefinitions:{services:{}}})};return{repository:{id:9001,visibility:'private'},commit:ca,accepted:{generationId:A,operationId:O},manifest:{schema:1,generationId:A,operationId:O,parentAcceptedGenerationId:null,intent:'accepted-edit',privateFiles:Object.entries(files).map(([path,body])=>({path,sha256:'sha256:'+createHash('sha256').update(body).digest('hex')})),publicInputWitness:w,publicProjectionBasisDigest:basis,createdAt:'2026-11-17T12:00:00Z'},files}}
const config={repositoryId:9001,publicProjectionBasisDigest:basis};
const baseState=()=>({schema:1,accepted:accepted(),serving:ref(),operation:null});const operation=()=>({operationId:O,generationId:B,privateCommit:cb,publicInputWitness:w,parentAccepted:accepted(),expectedServing:ref()});
function transition(s,e){return plain(core().doorPrivateV1Transition(s,e))}function prepared(){const x=transition(baseState(),{type:'prepare',operation:operation()});assert.equal(x.ok,true);return x.state}function acceptedState(){const x=transition(prepared(),{type:'private-accepted',operationId:O});assert.equal(x.ok,true);return x.state}

// Independent release/feed probes frozen before corresponding fixes.
test('private manifest cannot claim its own immutable generation as accepted parent',async()=>{
  const b=bundle();b.manifest.parentAcceptedGenerationId=b.manifest.generationId;
  assert.equal((await core().doorPrivateV1ValidatePackage(ref(),b,config)).ok,false);
});
test('complete service with ordinary recipients and declared components cannot emit empty demand',()=>{
  const x=snapshot();x.services[0].componentAllocations={};
  assert.equal(core().doorPrivateV1ProjectPublic(x).ok,false);
});
