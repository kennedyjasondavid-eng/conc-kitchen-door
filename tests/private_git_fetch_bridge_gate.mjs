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

test('constructor is inert and missing explicit capabilities never discover defaults',()=>{
 const {c,forbidden}=api(),cfg=copy(config);for(const capabilities of[{}, {fetch(){}}])assert.equal(c.doorPrivateGitFetchBridgeV1Create(cfg,capabilities).ok,false);
 const s=setup(()=>{throw Error('not called')});assert.equal(s.calls.length,0);assert.equal(s.controllers.length,0);assert.equal(s.timers.scheduled.length,0);assert.deepEqual(s.forbidden,[]);assert.deepEqual(forbidden,[]);
});
test('factory rejects mutable destinations and accessor capabilities without invoking them',()=>{
 const {c}=api(),fn=()=>{},caps={fetch:fn,setTimeout:fn,clearTimeout:fn,AbortController};
 for(const mutate of[x=>x.privateRepository.owner='https://foreign',x=>x.privateRepository.branch='../main',x=>x.privateRepository.id=x.publicRepositoryId,x=>x.url='https://foreign']){const cfg=copy(config);mutate(cfg);assert.equal(c.doorPrivateGitFetchBridgeV1Create(cfg,caps).ok,false)}
 let calls=0;const getter={...caps};Object.defineProperty(getter,'fetch',{enumerable:true,get(){calls++;return fn}});assert.equal(c.doorPrivateGitFetchBridgeV1Create(config,getter).ok,false);assert.equal(calls,0);
});
test('valid byte stream returns detached exact bytes with native-style privacy init and cleanup',async()=>{
 const bytes=encoded('{"synthetic":"é😀"}'),r=response(ROOT,[bytes.subarray(0,7),bytes.subarray(7,15),bytes.subarray(15)]),s=setup(()=>r.value),input=req(ROOT,bytes.length);
 const out=await s.bridge.request(input);assert.equal(out.status,200);assert.equal(out.url,ROOT);assert.equal(out.redirected,false);assert.deepEqual([...out.bytes],[...bytes]);
 const init=s.calls[0].init;assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.mode,'cors');assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');assert.equal(init.referrerPolicy,'no-referrer');assert.equal(init.headers.Authorization,'Bearer '+TOKEN);assert.ok(!Object.hasOwn(init.headers,'Cookie'));assert.equal(init.signal,s.controllers[0].signal);assert.equal(init.signal.aborted,false);
 assert.equal(r.stats.bulk,0);assert.equal(r.stats.gets,1);assert.equal(r.stats.releases,1);assert.equal(r.stats.cancels,0);assert.equal(s.timers.scheduled[0].ms,15000);assert.equal(s.timers.active.size,0);assert.equal(s.timers.cleared.length,1);s.timers.scheduled[0].fn();assert.equal(init.signal.aborted,false);assert.deepEqual(s.forbidden,[]);
 bytes.fill(0);assert.notEqual(out.bytes[0],0);
});
test('raw invalid UTF8 bytes are preserved for fatal decoding by the outer transport',async()=>{const r=response(ROOT,[new Uint8Array([0xff,0xc0,0x80])]),s=setup(()=>r.value),out=await s.bridge.request(req(ROOT,3));assert.deepEqual([...out.bytes],[255,192,128]);assert.equal(r.stats.bulk,0)});
test('metadata/ref/immutable commit/tree/blob routes accept their bounded canonical paths',async()=>{
 for(const[url,cap]of[[ROOT,M],[ROOT+'/git/ref/heads/main',M],[ROOT+'/git/commits/'+HEAD,M],[ROOT+'/git/trees/'+TREE,2*M],[ROOT+'/git/blobs/'+BLOB,6*M]]){const s=setup(u=>response(u,[encoded('{}')]).value);assert.equal((await s.bridge.request(req(url,cap))).status,200);assert.equal(s.calls.length,1)}
});
for(const url of['https://foreign.invalid/data',ROOT+'?x=1',ROOT+'#x',ROOT+'/',ROOT+'/contents/accepted.json',ROOT+'/git/trees/'+TREE+'?recursive=false',ROOT+'/git/ref/heads/other','https://api.github.com.evil/repos/synthetic-owner/private-data','http://api.github.com/repos/synthetic-owner/private-data','https://api.github.com:443/repos/synthetic-owner/private-data','https://user:secret@api.github.com/repos/synthetic-owner/private-data',ROOT+'/git/commits/'+HEAD.toUpperCase(),ROOT+'%2fother'])test('noncanonical/foreign URL rejects before fetch: '+url,async()=>{const s=setup(()=>{throw Error('must not fetch')});await rejected(s.bridge.request(req(url)),'invalid-request');assert.equal(s.calls.length,0);assert.equal(s.controllers.length,0);assert.equal(s.timers.scheduled.length,0)});
test('method/header/request-control bounds cannot choose cookies or generic fetch init',async()=>{
 const changes=[r=>r.method='DELETE',r=>r.method='HEAD',r=>r.redirect='follow',r=>r.timeoutMs=1,r=>r.maxResponseBytes=M+1,r=>r.maxResponseBytes=0,r=>r.maxResponseBytes=Infinity,r=>r.credentials='include',r=>r.headers.Cookie='secret',r=>r.headers.Accept='text/plain',r=>r.headers['X-GitHub-Api-Version']='other',r=>r.headers.authorization=r.headers.Authorization,r=>r.headers.Authorization='Bearer bad\nheader',r=>r.headers.Authorization='Bearer '+'a'.repeat(2001),r=>r.body='{}'];
 for(const change of changes){const s=setup(()=>{throw Error('must not fetch')}),r=req();change(r);await rejected(s.bridge.request(r),'invalid-request');assert.equal(s.calls.length,0);assert.equal(s.controllers.length,0)}
});
test('request accessors reject without invocation and malformed Unicode never reaches fetch',async()=>{
 const s=setup(()=>{throw Error('must not fetch')});let calls=0;const r=req();Object.defineProperty(r.headers,'Authorization',{enumerable:true,get(){calls++;return'Bearer '+TOKEN}});await rejected(s.bridge.request(r),'invalid-request');assert.equal(calls,0);
 const p=post();p.body+='\ud800';await rejected(s.bridge.request(p),'invalid-request');assert.equal(s.calls.length,0);
});
test('fixed GraphQL acceptance wire is the ONLY POST shape',async()=>{const p=post(),s=setup(u=>response(u,[encoded('{"data":{}}')]).value);assert.equal((await s.bridge.request(p)).status,200);assert.equal(s.calls[0].url,'https://api.github.com/graphql');assert.equal(s.calls[0].init.body,p.body);assert.equal(s.calls[0].init.headers['Content-Type'],'application/json');assert.equal(s.calls.length,1)});
test('GraphQL cannot change document/ref/message/path/deletion or body limits',async()=>{
 const mutations=[p=>p.query='{viewer{login}}',p=>p.operationName='Other',p=>p.variables.input.branch.branchName='other',p=>p.variables.input.branch.repositoryNameWithOwner='foreign/repo',p=>p.variables.input.expectedHeadOid='main',p=>p.variables.input.message.headline=SECRET,p=>p.variables.input.message.body=SECRET,p=>p.variables.input.fileChanges.deletions=[{path:'README.md'}],p=>p.variables.input.fileChanges.additions[0].path='../accepted.json',p=>p.variables.input.fileChanges.additions[0].path='generations/'+OP+'/manifest.json',p=>p.variables.input.fileChanges.additions[1].contents='not base64!',p=>p.variables.input.fileChanges.additions.push(p.variables.input.fileChanges.additions[0]),p=>p.variables.input.clientMutationId='not-uuid'];
 for(const mutate of mutations){const s=setup(()=>{throw Error('must not fetch')}),r=post(),body=JSON.parse(r.body);mutate(body);r.body=JSON.stringify(body);await rejected(s.bridge.request(r),'invalid-request');assert.equal(s.calls.length,0)}
 const s=setup(()=>{throw Error('must not fetch')}),r=post();r.body=' '.repeat(12*M)+r.body;await rejected(s.bridge.request(r),'invalid-request');assert.equal(s.calls.length,0);
});
test('body streaming cap rejects first overflowing chunk before further reads or bulk buffering',async()=>{
 for(const length of[null,'1']){const r=response(ROOT,[new Uint8Array([1,2,3]),new Uint8Array([4,5,6]),encoded(SECRET)],{length}),s=setup(()=>r.value);const e=await rejected(s.bridge.request(req(ROOT,5)),'response-bounds-exceeded');assert.equal(e.doorPrivateGitCode,'bounds-exceeded');assert.equal(r.stats.reads,2);assert.equal(r.stats.cancels,1);assert.equal(r.stats.releases,1);assert.equal(r.stats.bulk,0);assert.equal(s.controllers[0].signal.aborted,true);assert.equal(s.timers.active.size,0);assert.ok(!JSON.stringify(r.stats.cancelReasons).includes(TOKEN))}
});
test('declared over-cap length rejects before reader acquisition; malformed length is invalid',async()=>{
 for(const length of['6','bad']){const r=response(ROOT,[encoded(SECRET)],{length}),s=setup(()=>r.value);await rejected(s.bridge.request(req(ROOT,5)),length==='bad'?'response-invalid':'response-bounds-exceeded');assert.equal(r.stats.gets,0);assert.equal(r.stats.reads,0);assert.equal(r.stats.cancels,1);assert.equal(s.controllers[0].signal.aborted,true)}
});
test('exact byte cap succeeds even when declared compressed-length hint differs',async()=>{const r=response(ROOT,[encoded('é'),encoded('😀')],{length:'2'}),s=setup(()=>r.value),out=await s.bridge.request(req(ROOT,6));assert.equal(out.bytes.byteLength,6);assert.equal(r.stats.bulk,0);assert.equal(r.stats.cancels,0)});
test('valid full blob response can reach the fixed6MiB wire ceiling',async()=>{const r=response(ROOT+'/git/blobs/'+BLOB,[new Uint8Array(3*M),new Uint8Array(3*M)]),s=setup(()=>r.value),out=await s.bridge.request(req(ROOT+'/git/blobs/'+BLOB,6*M));assert.equal(out.bytes.byteLength,6*M);assert.equal(r.stats.reads,3);assert.equal(r.stats.bulk,0)});
test('deadline covers stalled response headers and ignores a late response', {timeout:5000},async()=>{
 let resolveFetch,entered;const start=new Promise(r=>entered=r),s=setup(()=>{entered();return new Promise(r=>resolveFetch=r)}),pending=s.bridge.request(req());await start;const assertion=rejected(pending,'request-timeout');s.timers.fireAll();await assertion;assert.equal(s.controllers[0].signal.aborted,true);assert.equal(s.timers.active.size,0);
 const late=response(ROOT,[encoded(SECRET)]);resolveFetch(late.value);await eventLoop();assert.equal(late.stats.reads,0);assert.equal(late.stats.cancels,1);
});
test('deadline covers stalled stream read and does not await stuck cancel', {timeout:5000},async()=>{
 let startedResolve;const started=new Promise(r=>startedResolve=r),stats={reads:0,cancels:0,releases:0};const s=setup(()=>({status:200,type:'cors',url:ROOT,redirected:false,headers:new Headers(),body:{getReader(){return{read(){stats.reads++;startedResolve();return new Promise(()=>{})},cancel(){stats.cancels++;return new Promise(()=>{})},releaseLock(){stats.releases++}}}}}));
 const pending=s.bridge.request(req());await started;const assertion=rejected(pending,'request-timeout');s.timers.fireAll();await assertion;assert.equal(stats.reads,1);assert.equal(stats.cancels,1);assert.equal(stats.releases,1);assert.equal(s.controllers[0].signal.aborted,true);assert.equal(s.timers.active.size,0);
});
test('oversize cleanup never awaits a stalled cancel promise', {timeout:5000},async()=>{const r=response(ROOT,[encoded(SECRET)],{cancelStalls:true}),s=setup(()=>r.value);await rejected(s.bridge.request(req(ROOT,1)),'response-bounds-exceeded');assert.equal(r.stats.cancels,1);assert.equal(r.stats.releases,1);assert.equal(s.timers.active.size,0)});
test('stream/network/CORS failures are fixed errors with timer/lock cleanup and no raw secrets',async()=>{
 const r=response(ROOT,[],{streamFailure:true}),s=setup(()=>r.value);await rejected(s.bridge.request(req()),'response-invalid');assert.equal(r.stats.releases,1);assert.equal(s.timers.active.size,0);assert.equal(s.controllers[0].signal.aborted,true);
 const network=setup(()=>Promise.reject(Error('CORS '+TOKEN+' '+SECRET)));await rejected(network.bridge.request(req()),'network-unavailable');assert.equal(network.timers.active.size,0);assert.equal(network.controllers[0].signal.aborted,true);assert.deepEqual(network.forbidden,[]);
});
for(const[why,change]of[['changed URL',r=>r.url='https://foreign.invalid/'+TOKEN],['redirect flag',r=>r.redirected=true],['opaque',r=>r.type='opaque'],['opaque redirect',r=>r.type='opaqueredirect'],['redirect status',r=>r.status=302]])test('reject response '+why+' without body reads',async()=>{const r=response(ROOT,[encoded(SECRET)]);change(r.value);const s=setup(()=>r.value);await rejected(s.bridge.request(req()),['opaque','opaque redirect'].includes(why)?'response-invalid':'redirect-rejected');assert.equal(r.stats.reads,0);assert.equal(r.stats.cancels,1);assert.equal(s.controllers[0].signal.aborted,true)});
test('HTTP error body is canceled and not exposed as private content or an absent-path receipt',async()=>{const r=response(ROOT,[encoded(TOKEN+' '+SECRET)],{status:403}),s=setup(()=>r.value),out=await s.bridge.request(req());assert.equal(out.status,403);assert.equal(out.bytes.byteLength,0);assert.equal(r.stats.reads,0);assert.equal(r.stats.cancels,1);assert.equal(s.timers.active.size,0);assert.ok(!JSON.stringify(out).includes(TOKEN))});
test('factory config/function refs and request frame are captured against caller mutation',async()=>{
 let finish,entered;const started=new Promise(r=>entered=r),cfg=copy(config),s=setup((url)=>{entered();return new Promise(r=>finish=()=>r(response(url,[encoded('{}')]).value))},cfg),r=req(),pending=s.bridge.request(r);await started;
 cfg.privateRepository.owner='foreign';s.capabilities.fetch=()=>{throw Error('retarget')};r.url='https://foreign.invalid';r.headers.Authorization='Bearer CHANGED';r.maxResponseBytes=1;finish();const out=await pending;assert.equal(out.url,ROOT);assert.equal(s.calls[0].url,ROOT);assert.equal(s.calls[0].init.headers.Authorization,'Bearer '+TOKEN);assert.equal(out.bytes.byteLength,2);
});
test('concurrent calls own different controllers/deadlines and one timeout cannot abort the other', {timeout:5000},async()=>{
 const resolves=[];const s=setup((url,init)=>new Promise(r=>resolves.push(()=>r(response(url,[encoded('{}')]).value)))),p1=s.bridge.request(req()),p2=s.bridge.request(req());await eventLoop();assert.equal(s.controllers.length,2);assert.notEqual(s.controllers[0],s.controllers[1]);const failed=rejected(p1,'request-timeout');s.timers.fire(s.timers.scheduled[0].id);await failed;assert.equal(s.controllers[1].signal.aborted,false);resolves[1]();assert.equal((await p2).bytes.byteLength,2);resolves[0]();await eventLoop();assert.equal(s.timers.active.size,0);
});
function privateBackend({denied=false,invalidUTF8=false}={}){return(url)=>{let value;
 if(url===ROOT){if(denied)return response(url,[encoded(SECRET)],{status:403}).value;if(invalidUTF8)return response(url,[new Uint8Array([0xff])]).value;value={id:9001,full_name:'synthetic-owner/private-data',private:true,permissions:{push:true}};}
 else if(url===ROOT+'/git/ref/heads/main')value={ref:'refs/heads/main',object:{type:'commit',sha:HEAD}};
 else if(url===ROOT+'/git/commits/'+HEAD)value={sha:HEAD,tree:{sha:TREE},parents:[]};
 else if(url===ROOT+'/git/trees/'+TREE)value={sha:TREE,truncated:false,tree:[{path:'README.md',mode:'100644',type:'blob',sha:BLOB,size:2}]};
 else throw Error('unexpected synthetic URL '+TOKEN);return response(url,[encoded(JSON.stringify(value))]).value;};}
test('explicit connection test composes actual transport through bridge without POST or private frame leakage',async()=>{
 const s=setup(privateBackend()),credentials=[],derive=[];const out=plain(await s.bridge.testConnection({getCredential:async scope=>{credentials.push(copy(scope));return TOKEN},deriveProjectionBasis:async value=>{derive.push(value);throw Error('not needed for empty branch')}}));
 assert.deepEqual(out,{ok:true,status:'private-read-verified',repositoryId:9001,head:HEAD,acceptedStatus:'absent',writeVerified:false});assert.equal(s.calls.length,4);assert.ok(s.calls.every(r=>r.init.method==='GET'));assert.deepEqual(credentials,[{repositoryId:9001,permission:'contents-write'}]);assert.equal(derive.length,0);assert.ok(!JSON.stringify(out).includes(TOKEN));assert.ok(!JSON.stringify(out).includes(SECRET));assert.ok(!Object.hasOwn(out,'frame'));assert.ok(!Object.hasOwn(out,'package'));assert.deepEqual(s.forbidden,[]);
});
test('connection test requires explicit callable credentials/basis and never reads stored defaults',async()=>{const s=setup(privateBackend());for(const caps of[{}, {getCredential:async()=>TOKEN}])assert.equal((await s.bridge.testConnection(caps)).ok,false);assert.equal(s.calls.length,0);assert.deepEqual(s.forbidden,[])});
test('denied credentials/HTTP/invalidUTF8 remain fixed failures, never empty connected success',async()=>{
 const denied=setup(privateBackend()),r=plain(await denied.bridge.testConnection({getCredential:async()=>{throw Error(TOKEN+' '+SECRET)},deriveProjectionBasis:async()=>''}));assert.equal(r.ok,false);assert.equal(r.code,'credential-unavailable');assert.equal(denied.calls.length,0);
 for(const mode of[{denied:true},{invalidUTF8:true}]){const s=setup(privateBackend(mode)),out=plain(await s.bridge.testConnection({getCredential:async()=>TOKEN,deriveProjectionBasis:async()=>''}));assert.equal(out.ok,false);assert.ok(!JSON.stringify(out).includes(TOKEN));assert.ok(!JSON.stringify(out).includes(SECRET));assert.ok(!Object.hasOwn(out,'frame'));assert.ok(s.calls.every(c=>c.init.method==='GET'));}
});
