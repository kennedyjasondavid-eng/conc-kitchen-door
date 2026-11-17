// Gate-author frozen before builder: standards-based SYNTHETIC streams/clock/fetch only; never real requests.
import fs from 'node:fs';import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';import{webcrypto,createHash}from'node:crypto';
const html=fs.readFileSync(process.env.PRIVATE_FETCH_BRIDGE_HTML||new URL('../index.html',import.meta.url),'utf8');
const copy=structuredClone,plain=x=>JSON.parse(JSON.stringify(x)),K=1024,M=K*K;
const config={schema:1,privateRepository:{id:9001,owner:'synthetic-owner',name:'private-data',branch:'main'},publicRepositoryId:9002};
const ROOT='https://api.github.com/repos/synthetic-owner/private-data',TOKEN='SYNTHETIC_TOKEN_CANARY',SECRET='PRIVATE_BODY_CANARY';
const sha=s=>createHash('sha1').update(s).digest('hex'),HEAD=sha('synthetic head'),TREE=sha('synthetic root tree'),BLOB=sha('synthetic README');
const G='11111111-1111-4111-8111-111111111111',OP='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const QUERY='mutation DoorAcceptPrivate($input:CreateCommitOnBranchInput!){createCommitOnBranch(input:$input){clientMutationId commit{oid repository{databaseId nameWithOwner} parents(first:2){totalCount nodes{oid}}} ref{name prefix repository{databaseId nameWithOwner} target{oid}}}}';
function api(){let src='';for(const region of['private-generation-v1','private-bootstrap-v1','private-git-transport-v1','private-git-fetch-bridge-v1']){
 const a=html.indexOf('/* DOOR_TESTABLE_CORE_START '+region+' */'),z=html.indexOf('/* DOOR_TESTABLE_CORE_END '+region+' */',a);assert.ok(a>=0&&z>a,region+' actual marked source exists');src+=html.slice(a,z)+'\n';}
 const forbidden=[];const noDefault=()=>{forbidden.push('default I/O or logging');throw Error('Forbidden default capability '+TOKEN)};
 const c=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,URL,atob,btoa,Headers,ReadableStream,
 fetch:noDefault,setTimeout:noDefault,clearTimeout:noDefault,AbortController:class{constructor(){noDefault()}},
 localStorage:{getItem:noDefault,setItem:noDefault,removeItem:noDefault},console:{log:noDefault,warn:noDefault,error:noDefault}});
 vm.runInContext(src,c);assert.equal(typeof c.doorPrivateGitFetchBridgeV1Create,'function');return{c,forbidden};
}
function clock(){let serial=0;const active=new Map(),scheduled=[],cleared=[];return{active,scheduled,cleared,
 setTimeout(fn,ms){const id=++serial;active.set(id,fn);scheduled.push({id,fn,ms});return id},
 clearTimeout(id){cleared.push(id);active.delete(id)},fire(id){const fn=active.get(id);if(fn){active.delete(id);fn()}},fireAll(){for(const id of[...active.keys()])this.fire(id)}}}
function response(url,chunks,{status=200,type='cors',redirected=false,length=null,cancelStalls=false,streamFailure=false}={}){
 let index=0;const stats={reads:0,gets:0,cancels:0,releases:0,bulk:0,cancelReasons:[]};
 const stream=new ReadableStream({pull(controller){if(streamFailure){controller.error(Error('stream failure '+TOKEN+' '+SECRET));return}if(index<chunks.length)controller.enqueue(chunks[index++]);else controller.close()},cancel(reason){stats.cancelReasons.push(reason)}},{highWaterMark:0});
 const body={getReader(){stats.gets++;const r=stream.getReader();return{read(){stats.reads++;return r.read()},cancel(reason){stats.cancels++;if(cancelStalls)return new Promise(()=>{});return r.cancel(reason)},releaseLock(){stats.releases++;r.releaseLock()}}},cancel(reason){stats.cancels++;if(cancelStalls)return new Promise(()=>{});return stream.cancel(reason)}};
 const bulk=()=>{stats.bulk++;throw Error('bulk buffering forbidden '+TOKEN+' '+SECRET)};
 return{value:{status,type,url,redirected,headers:new Headers(length===null?{}:{'content-length':String(length)}),body,text:bulk,json:bulk,arrayBuffer:bulk},stats};
}
const encoded=text=>new TextEncoder().encode(text);
function req(url=ROOT,limit=M){return{url,method:'GET',headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+TOKEN,'X-GitHub-Api-Version':'2022-11-28'},timeoutMs:15000,maxResponseBytes:limit,redirect:'error'}}
function post(){const r=req('https://api.github.com/graphql');r.method='POST';r.headers['Content-Type']='application/json';const contents=Buffer.from('{"synthetic":true}').toString('base64');r.body=JSON.stringify({query:QUERY,variables:{input:{branch:{repositoryNameWithOwner:'synthetic-owner/private-data',branchName:'main'},expectedHeadOid:HEAD,fileChanges:{additions:[{path:'generations/'+G+'/manifest.json',contents},{path:'generations/'+G+'/registry.json',contents},{path:'generations/'+G+'/menu.json',contents},{path:'accepted.json',contents}]},message:{headline:'Accept private DOOR generation'},clientMutationId:OP}}});return r}
function setup(fetcher,cfg=copy(config)){
 const {c,forbidden}=api(),timers=clock(),calls=[],controllers=[];
 class Controller extends AbortController{constructor(){super();controllers.push(this)}}
 const capabilities={fetch:(url,init)=>{calls.push({url,init});return fetcher(url,init)},setTimeout:timers.setTimeout.bind(timers),clearTimeout:timers.clearTimeout.bind(timers),AbortController:Controller};
 const made=c.doorPrivateGitFetchBridgeV1Create(cfg,capabilities);assert.equal(made.ok,true);assert.deepEqual(Object.keys(made.bridge).sort(),['request','testConnection']);return{c,bridge:made.bridge,capabilities,timers,calls,controllers,forbidden};
}
async function rejected(promise,code){let error;try{await promise}catch(e){error=e}assert.ok(error,'request must reject');assert.equal(error.code,code);assert.deepEqual(Object.keys(error).sort(),['code','doorPrivateGitCode']);assert.ok(!JSON.stringify(error).includes(TOKEN));assert.ok(!JSON.stringify(error).includes(SECRET));return error}
const eventLoop=()=>new Promise(resolve=>setImmediate(resolve));

// Independent release probes; SYNTHETIC native-capability equivalents only.
test('retained response chunks are copied before a producer reuses its buffer',async()=>{
 const value=encoded('original'),stats={releases:0},body={getReader(){let step=0;return{async read(){if(step++===0)return{done:false,value};value.fill(120);return{done:true}},cancel(){return Promise.resolve()},releaseLock(){stats.releases++}}}};
 const s=setup(async url=>({status:200,type:'cors',url,redirected:false,headers:new Headers(),body}));const r=await s.bridge.request(req());assert.equal(new TextDecoder().decode(r.bytes),'original');assert.equal(stats.releases,1);assert.equal(s.timers.active.size,0);
});
test('already completed EOF cannot be changed by a stale fired timeout callback',async()=>{
 const wire=response(ROOT,[encoded('done')]),s=setup(async()=>wire.value);const r=await s.bridge.request(req());assert.equal(new TextDecoder().decode(r.bytes),'done');assert.equal(s.timers.active.size,0);s.timers.scheduled[0].fn();assert.equal(s.controllers[0].signal.aborted,false);assert.equal(new TextDecoder().decode(r.bytes),'done');
});
test('unused HTTP error body cannot escape and stops without invoking bulk readers',async()=>{
 const wire=response(ROOT,[encoded(TOKEN+' '+SECRET)],{status:401}),s=setup(async()=>wire.value),r=await s.bridge.request(req());assert.equal(r.status,401);assert.equal(r.bytes.length,0);assert.equal(wire.stats.reads,0);assert.equal(wire.stats.bulk,0);assert.equal(s.controllers[0].signal.aborted,true);assert.equal(s.timers.active.size,0);
});
test('bridge has only a declaration and transport mutation query has a single source owner',()=>{
 assert.equal((html.match(/doorPrivateGitFetchBridgeV1Create\s*\(/g)||[]).length,1);assert.equal((html.match(/mutation DoorAcceptPrivate\(/g)||[]).length,1);
});