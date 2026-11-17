// Gate-author draft: synthetic Git/API only; no operational data or real requests.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createHash,webcrypto} from 'node:crypto';
const html=fs.readFileSync(process.env.PRIVATE_TRANSPORT_HTML||new URL('../index.html',import.meta.url),'utf8');
const copy=structuredClone,plain=v=>JSON.parse(JSON.stringify(v)),sha=s=>createHash('sha1').update(s).digest('hex'),digest=s=>'sha256:'+createHash('sha256').update(s).digest('hex');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',OA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',OB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',U0=sha('public code');
const config={schema:1,privateRepository:{id:9001,owner:'synthetic-owner',name:'private-data',branch:'main'},publicRepositoryId:9002};
const ROOT='https://api.github.com/repos/synthetic-owner/private-data',TOKEN='SYNTHETIC_CREDENTIAL_CANARY',SECRET='PRIVATE_PAYLOAD_CANARY';
const basis=files=>digest(files['registry.json']+'\n'+files['menu.json']);
function backend(){
 const objects=new Map(),calls=[],commits=[];let head;const baseline={'README.md':'Synthetic private repository'};
 const addObject=(kind,value)=>{const id=sha(kind+JSON.stringify(value));objects.set(id,{kind,value});return id};
 function tree(files,prefix=''){
  const paths=Object.keys(files).filter(p=>p.startsWith(prefix)),names=[...new Set(paths.map(p=>p.slice(prefix.length).split('/')[0]))];
  const entries=names.map(name=>{const full=prefix+name;if(Object.hasOwn(files,full)){const text=files[full],id=addObject('blob',{text});return{path:name,mode:'100644',type:'blob',sha:id,size:Buffer.byteLength(text)}}return{path:name,mode:'040000',type:'tree',sha:tree(files,full+'/')}});
  const id=sha('tree'+JSON.stringify(entries));objects.set(id,{kind:'tree',value:{sha:id,tree:entries,truncated:false}});return id;
 }
 function commit(files,parents=[]){const treeId=tree(files),id=sha(JSON.stringify({treeId,parents,serial:commits.length}));objects.set(id,{kind:'commit',value:{sha:id,tree:{sha:treeId},parents:parents.map(sha=>({sha})),files:copy(files)}});commits.push(id);return id}
 head=commit(baseline);const initial=head;
 const response=(url,body,status=200)=>({status,url,redirected:false,bytes:new TextEncoder().encode(JSON.stringify(body))});
 const mock={objects,calls,commits,initial,get head(){return head},set head(v){head=v},fault:null,onRequest:null,metadata:{id:9001,node_id:'R_SYNTHETIC',full_name:'synthetic-owner/private-data',private:true,permissions:{push:true}},
  addCommit(files,parent=head,advance=true){const id=commit(files,[parent]);if(advance)head=id;return id},files(id=head){return copy(objects.get(id).value.files)},response,
  async request(req){calls.push(copy(req));if(mock.onRequest)await mock.onRequest(req);if(mock.fault){const overridden=await mock.fault(req);if(overridden)return overridden}
   const url=req.url;if(req.method==='GET'){
    if(url===ROOT)return response(url,mock.metadata);
    if(url===ROOT+'/git/ref/heads/main')return response(url,{ref:'refs/heads/main',object:{type:'commit',sha:head}});
    const match=url.match(/\/git\/(commits|trees|blobs)\/([a-f0-9]{40})$/);if(!match)return response(url,{message:'Unexpected synthetic GET'},404);
    const obj=objects.get(match[2]);if(!obj)return response(url,{message:'Not found'},404);
    if(match[1]==='commits'&&obj.kind==='commit'){const {files,...wire}=obj.value;return response(url,wire)}
    if(match[1]==='trees'&&obj.kind==='tree')return response(url,obj.value);
    if(match[1]==='blobs'&&obj.kind==='blob')return response(url,{sha:match[2],size:Buffer.byteLength(obj.value.text),encoding:'base64',content:Buffer.from(obj.value.text).toString('base64')});
    return response(url,{message:'Wrong object type'},404);
   }
   assert.equal(url,'https://api.github.com/graphql');assert.equal(req.method,'POST');const input=JSON.parse(req.body).variables.input;
   if(input.expectedHeadOid!==head)return response(url,{data:{createCommitOnBranch:null},errors:[{message:'Expected head mismatch '+SECRET}]});
   assert.equal(input.branch.repositoryNameWithOwner,'synthetic-owner/private-data');assert.equal(input.branch.branchName,'main');assert.equal(Object.hasOwn(input.branch,'refName'),false);
   const files=mock.files();for(const add of input.fileChanges.additions)files[add.path]=Buffer.from(add.contents,'base64').toString('utf8');
   assert.ok(!input.fileChanges.deletions||input.fileChanges.deletions.length===0);
   const parent=head;head=commit(files,[parent]);const actual=head,repo={databaseId:9001,nameWithOwner:'synthetic-owner/private-data'};
   return response(url,{data:{createCommitOnBranch:{clientMutationId:input.clientMutationId,commit:{oid:actual,repository:repo,parents:{totalCount:1,nodes:[{oid:parent}]}},ref:{name:'main',prefix:'refs/heads/',repository:repo,target:{oid:actual}}}}});
  }};return mock;
}
function payload(m,id=A,operationId=OA){
 const files={'registry.json':JSON.stringify({schema:1,residents:[{synthetic:SECRET}]}),'menu.json':JSON.stringify({schema:1,synthetic:true})};
 const publicInputWitness=digest('public synthetic witness'),publicProjectionBasisDigest=basis(files);
 const operation={schema:1,repositoryIds:{private:9001,public:9002},generationId:id,operationId,publicInputWitness,publicProjectionBasisDigest,expectedPrivateHead:m.initial,expectedPublicHead:U0,parentAccepted:null,expectedServing:null,phase:'prepared'};
 const manifest={schema:1,generationId:id,operationId,parentAcceptedGenerationId:null,intent:'accepted-edit',privateFiles:Object.entries(files).map(([path,text])=>({path,sha256:digest(text)})),publicInputWitness,publicProjectionBasisDigest,createdAt:'2026-11-17T00:00:00Z'};
 return{operation,manifestText:JSON.stringify(manifest),files};
}
function materialize(p){return{['generations/'+p.operation.generationId+'/manifest.json']:p.manifestText,...Object.fromEntries(Object.entries(p.files).map(([name,text])=>['generations/'+p.operation.generationId+'/'+name,text])), 'accepted.json':JSON.stringify({schema:1,generationId:p.operation.generationId,operationId:p.operation.operationId,parentAcceptedGenerationId:p.operation.parentAccepted?.generationId||null})};}
function api(){let src='';for(const name of ['private-generation-v1','private-bootstrap-v1','private-git-transport-v1']){const a=html.indexOf('/* DOOR_TESTABLE_CORE_START '+name+' */'),z=html.indexOf('/* DOOR_TESTABLE_CORE_END '+name+' */',a);assert.ok(a>=0&&z>a,name+' marked core exists');src+=html.slice(a,z)+'\n'}const noIO=()=>{throw Error('Unexpected default I/O')};const box=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,URL,atob,btoa,fetch:noIO,localStorage:{getItem:noIO,setItem:noIO},console:{log:noIO,warn:noIO,error:noIO}});vm.runInContext(src,box);assert.equal(typeof box.doorPrivateGitTransportV1Create,'function');return box;}
function setup(m=backend(),cfg=copy(config),extra={}){const reads=[];const capabilities={request:r=>m.request(r),getCredential:async request=>{reads.push(copy(request));return TOKEN},deriveProjectionBasis:async frame=>basis(frame.files),...extra};const r=api().doorPrivateGitTransportV1Create(cfg,capabilities);assert.equal(r.ok,true);return{m,reads,transport:r.transport,cfg}}
const posts=m=>m.calls.filter(r=>r.method==='POST');

test('factory is explicit-call-only and constructor performs no credential/request/basis work',()=>{const s=setup();assert.deepEqual(Object.keys(s.transport).sort(),['acceptPrivate','observePrivate','readPackage']);assert.equal(s.m.calls.length,0);assert.equal(s.reads.length,0)});
for(const [label,mutate] of [['same IDs',c=>c.publicRepositoryId=9001],['URL owner',c=>c.privateRepository.owner='https://elsewhere'],['branch traversal',c=>c.privateRepository.branch='../main'],['unknown path option',c=>c.path='door_state.json']])test('factory rejects '+label,()=>{const c=copy(config);mutate(c);assert.equal(api().doorPrivateGitTransportV1Create(c,{request(){},getCredential(){},deriveProjectionBasis(){}}).ok,false)});
test('authenticated root-tree absence is a private partial frame, not a full bootstrap/public observation',async()=>{const s=setup(),r=plain(await s.transport.observePrivate());assert.equal(r.ok,true);assert.equal(r.frame.head,s.m.initial);assert.deepEqual(r.frame.accepted,{status:'absent',source:'authenticated-git-tree',path:'accepted.json',atCommit:s.m.initial});assert.equal(Object.hasOwn(r,'public'),false);assert.equal(posts(s.m).length,0)});
for(const [label,mutate]of [['wrong ID',m=>m.metadata.id=42],['public repository',m=>m.metadata.private=false],['wrong full name',m=>m.metadata.full_name='different/repository'],['no push',m=>m.metadata.permissions.push=false]])test('fixed repository rejects '+label+' before private content or mutation',async()=>{const m=backend();mutate(m);const s=setup(m),r=await s.transport.observePrivate();assert.equal(r.ok,false);assert.equal(m.calls.length,1);assert.equal(posts(m).length,0)});
for(const kind of ['404','403','redirect','truncated','symlink','duplicate','invalid-utf8','oversized'])test('unreadable authority '+kind+' is never absence',async()=>{
 const m=backend();m.fault=async req=>{if(!req.url.includes('/git/trees/'))return;const id=req.url.split('/').pop(),value=copy(m.objects.get(id).value);
  if(kind==='404'||kind==='403')return m.response(req.url,{message:SECRET},Number(kind));
  if(kind==='redirect')return{...m.response(req.url,value),redirected:true,url:'https://evil.invalid/'};
  if(kind==='truncated')value.truncated=true;
  if(kind==='symlink')value.tree.push({path:'accepted.json',type:'blob',mode:'120000',sha:sha('symlink')});
  if(kind==='duplicate')value.tree.push(copy(value.tree[0]));
  if(kind==='invalid-utf8')return{status:200,url:req.url,redirected:false,bytes:new Uint8Array([0xff])};
  if(kind==='oversized')return{status:200,url:req.url,redirected:false,bytes:new Uint8Array(2*1024*1024+1)};
  return m.response(req.url,value);
 };const s=setup(m),r=plain(await s.transport.observePrivate());assert.equal(r.ok,false);assert.ok(!JSON.stringify(r).includes(SECRET));assert.equal(posts(m).length,0);
});
test('missing credential is unavailable before any API request',async()=>{const s=setup(backend(),copy(config),{getCredential:async()=>''});assert.equal((await s.transport.observePrivate()).ok,false);assert.equal(s.m.calls.length,0)});
test('accept sends only four fixed paths with exact native head lease and fixed private metadata',async()=>{
 const s=setup(),p=payload(s.m),r=plain(await s.transport.acceptPrivate(p));assert.equal(r.ok,true);assert.equal(r.kind,'private-accepted-at-commit');const call=posts(s.m);assert.equal(call.length,1);const input=JSON.parse(call[0].body).variables.input;
 assert.equal(input.expectedHeadOid,p.operation.expectedPrivateHead);assert.equal(input.message.headline,'Accept private DOOR generation');assert.equal(input.clientMutationId,OA);assert.deepEqual(input.fileChanges.additions.map(a=>a.path).sort(),Object.keys(materialize(p)).sort());assert.equal(input.fileChanges.deletions?.length||0,0);assert.ok(!JSON.stringify({branch:input.branch,message:input.message}).includes(SECRET));assert.ok(!JSON.stringify(input).includes(TOKEN));assert.equal(s.m.files()['README.md'],'Synthetic private repository');
 assert.equal(r.event.receipt.commit.sha,s.m.head);assert.deepEqual(r.event.receipt.commit.parents,[p.operation.expectedPrivateHead]);assert.equal(r.event.receipt.refUpdate.compareAndSwap,true);assert.equal(r.event.package.commit,s.m.head);
});
test('observed accepted frame/package is detached and independently basis-validated',async()=>{const s=setup(),p=payload(s.m);const accepted=await s.transport.acceptPrivate(p);assert.equal(accepted.ok,true);const r=plain(await s.transport.observePrivate());assert.equal(r.ok,true);assert.equal(r.frame.accepted.value.generationId,A);assert.equal(r.frame.expectedProjectionBasisDigest,basis(p.files));r.frame.package.files['registry.json']='mutated';assert.equal((await s.transport.observePrivate()).frame.package.files['registry.json'],p.files['registry.json'])});
test('exact pinned private package never follows current HEAD or acknowledges branch acceptance',async()=>{const s=setup(),p=payload(s.m),old=s.m.addCommit({...s.m.files(),...materialize(p)},s.m.head,false);s.m.addCommit({...s.m.files(),'new-code.txt':'newer unrelated'});const ref={schema:1,generationId:A,operationId:OA,privateCommit:old,publicInputWitness:p.operation.publicInputWitness};const r=plain(await s.transport.readPackage(ref));assert.equal(r.ok,true);assert.equal(r.package.commit,old);assert.equal(Object.hasOwn(r,'event'),false);assert.equal(posts(s.m).length,0)});
test('existing generation directory is immutable even if bytes match proposed generation',async()=>{const m=backend(),p=payload(m);const files=materialize(p);delete files['accepted.json'];m.addCommit({...m.files(),...files});p.operation.expectedPrivateHead=m.head;const s=setup(m),r=await s.transport.acceptPrivate(p);assert.equal(r.ok,false);assert.equal(r.code,'generation-exists');assert.equal(posts(m).length,0)});
test('extra file path or stale independent basis cannot cause mutation',async()=>{for(const kind of ['extra','basis']){const s=setup(),p=payload(s.m);if(kind==='extra')p.files['evidence.json']=SECRET;else p.operation.publicProjectionBasisDigest=digest('forged');const r=await s.transport.acceptPrivate(p);assert.equal(r.ok,false);assert.equal(posts(s.m).length,0)}});
test('code-only private head advance is conflict, never substituted latest lease',async()=>{const s=setup(),p=payload(s.m);s.m.addCommit({...s.m.files(),'code.txt':'advanced'});const r=await s.transport.acceptPrivate(p);assert.equal(r.ok,false);assert.equal(r.code,'conflict');assert.equal(posts(s.m).length,0)});
test('two writers from same captured parent cannot both accept',async()=>{const s=setup(),p=payload(s.m),q=payload(s.m,B,OB);const results=await Promise.all([s.transport.acceptPrivate(p),s.transport.acceptPrivate(q)]);assert.equal(results.filter(r=>r.ok).length,1);assert.equal(s.m.commits.length,2);assert.equal(Object.keys(s.m.files()).filter(p=>p.endsWith('/manifest.json')).length,1)});
test('timeout after native mutation is unconfirmed; explicit reread finds actual accepted pointer without fabricated CAS event',async()=>{const s=setup(),p=payload(s.m);const original=s.m.request.bind(s.m);let once=true;s.m.request=async req=>{const r=await original(req);if(req.method==='POST'&&once){once=false;throw Error('timeout '+SECRET+' '+TOKEN)}return r};const r=plain(await s.transport.acceptPrivate(p));assert.equal(r.ok,false);assert.equal(r.code,'private-unconfirmed');assert.equal(posts(s.m).length,1);assert.ok(!JSON.stringify(r).includes(SECRET));assert.ok(!JSON.stringify(r).includes(TOKEN));assert.deepEqual(r.operation,p.operation);const frame=await s.transport.observePrivate();assert.equal(frame.ok,true);assert.equal(frame.frame.accepted.value.operationId,OA);assert.equal(Object.hasOwn(frame,'event'),false);assert.equal(posts(s.m).length,1)});
test('method inputs/config snapshot before credential await prevents retargeting captured write',async()=>{const m=backend(),cfg=copy(config),p=payload(m);let mutate;const s=setup(m,cfg,{getCredential:async()=>{mutate();return TOKEN}});mutate=()=>{cfg.privateRepository.name='wrong';p.operation.generationId=B;p.files['registry.json']='MUTATED_PRIVATE'};const original=copy(p);const r=await s.transport.acceptPrivate(p);assert.equal(r.ok,true);assert.equal(r.event.package.files['registry.json'],original.files['registry.json']);assert.equal(r.event.package.manifest.generationId,A);assert.ok(m.calls.every(r=>r.url.startsWith(ROOT)||r.url==='https://api.github.com/graphql'))});
test('private acceptance does not read or mutate public context',async()=>{const s=setup(),p=payload(s.m);p.operation.expectedPublicHead=sha('public unrelated advance context');const r=await s.transport.acceptPrivate(p);assert.equal(r.ok,true);assert.ok(s.m.calls.every(r=>r.url.startsWith(ROOT)||r.url==='https://api.github.com/graphql'))});
for(const kind of ['manifest-cap','file-cap','invalid-json','nonfinite-json','raw-lone-surrogate','escaped-lone-surrogate','manifest-extra-key','descriptor-extra-key'])test('input '+kind+' rejects before credential or request',async()=>{
 const s=setup(),p=payload(s.m);
 if(kind==='manifest-cap')p.manifestText=' '.repeat(64*1024)+p.manifestText;
 if(kind==='file-cap')p.files['registry.json']=JSON.stringify({synthetic:'a'.repeat(4*1024*1024)});
 if(kind==='invalid-json')p.files['registry.json']='{broken';
 if(kind==='nonfinite-json')p.files['registry.json']='{"synthetic":1e999}';
 if(kind==='raw-lone-surrogate')p.files['registry.json']='{"synthetic":"'+String.fromCharCode(0xd800)+'"}';
 if(kind==='escaped-lone-surrogate')p.files['registry.json']='{"synthetic":"\\ud800"}';
 if(['file-cap','invalid-json','nonfinite-json','raw-lone-surrogate','escaped-lone-surrogate'].includes(kind)){
  // Keep digest/basis bindings internally consistent so a checksum mismatch
  // cannot make a missing JSON/Unicode preflight check appear to pass.
  const m=JSON.parse(p.manifestText);p.operation.publicProjectionBasisDigest=basis(p.files);m.publicProjectionBasisDigest=p.operation.publicProjectionBasisDigest;
  m.privateFiles=Object.entries(p.files).map(([path,text])=>({path,sha256:digest(text)}));p.manifestText=JSON.stringify(m);
 }
 if(kind.startsWith('manifest-extra')||kind.startsWith('descriptor-extra')){const m=JSON.parse(p.manifestText);if(kind==='manifest-extra-key')m.privateEvidence=SECRET;else m.privateFiles[0].destination='https://evil.invalid/';p.manifestText=JSON.stringify(m)}
 const r=await s.transport.acceptPrivate(p);assert.equal(r.ok,false);assert.equal(s.reads.length,0);assert.equal(s.m.calls.length,0);
});
test('successful native acknowledgement remains exact history if a later code HEAD lands before readback',async()=>{
 const s=setup(),p=payload(s.m),original=s.m.request.bind(s.m);let landed;
 s.m.request=async req=>{const response=await original(req);if(req.method==='POST'){landed=s.m.head;s.m.addCommit({...s.m.files(),'code-after-accept.txt':'newer code'})}return response};
 const r=await s.transport.acceptPrivate(p);assert.equal(r.ok,true);assert.equal(r.event.receipt.commit.sha,landed);assert.notEqual(r.event.receipt.commit.sha,s.m.head);assert.equal(r.event.package.commit,landed);
 const observed=await s.transport.observePrivate();assert.equal(observed.ok,true);assert.equal(observed.frame.head,s.m.head);assert.equal(observed.frame.accepted.value.operationId,OA);assert.equal(Object.hasOwn(observed,'event'),false);
});
test('timeout before mutation also remains unconfirmed without blind retry or manufactured absence',async()=>{
 const s=setup(),p=payload(s.m);s.m.fault=async req=>{if(req.method==='POST')throw Error('synthetic timeout '+TOKEN+' '+SECRET)};
 const r=plain(await s.transport.acceptPrivate(p));assert.equal(r.ok,false);assert.equal(r.code,'private-unconfirmed');assert.equal(posts(s.m).length,1);assert.equal(s.m.head,s.m.initial);assert.ok(!JSON.stringify(r).includes(TOKEN));
 const next=await s.transport.observePrivate();assert.equal(next.ok,true);assert.equal(next.frame.accepted.status,'absent');assert.equal(posts(s.m).length,1);
});
for(const kind of ['invalid-base64','wrong-blob-sha','wrong-byte-size','invalid-decoded-file-utf8'])test('immutable blob '+kind+' rejects without fallback',async()=>{
 const m=backend(),p=payload(m);m.addCommit({...m.files(),...materialize(p)});
 m.fault=async req=>{if(!req.url.includes('/git/blobs/'))return;const id=req.url.split('/').pop(),text=m.objects.get(id).value.text,blob={sha:id,size:Buffer.byteLength(text),encoding:'base64',content:Buffer.from(text).toString('base64')};if(kind==='invalid-base64')blob.content='!!!!';if(kind==='wrong-blob-sha')blob.sha=sha('different blob');if(kind==='wrong-byte-size')blob.size+=1;if(kind==='invalid-decoded-file-utf8'){blob.content=Buffer.from([0xff]).toString('base64');blob.size=1}return m.response(req.url,blob)};
 const r=await setup(m).transport.observePrivate();assert.equal(r.ok,false);assert.equal(posts(m).length,0);
});
test('maximum valid multibyte private JSON survives base64 wire expansion and exact byte readback',async()=>{
 const s=setup(),p=payload(s.m),limit=4*1024*1024,prefix='{"synthetic":"',suffix='"}',available=limit-Buffer.byteLength(prefix+suffix);
 const text=prefix+'é'.repeat(Math.floor(available/2))+(available%2?'a':'')+suffix;assert.equal(Buffer.byteLength(text),limit);
 p.files['registry.json']=text;const m=JSON.parse(p.manifestText);p.operation.publicProjectionBasisDigest=basis(p.files);m.publicProjectionBasisDigest=p.operation.publicProjectionBasisDigest;m.privateFiles=Object.entries(p.files).map(([path,text])=>({path,sha256:digest(text)}));p.manifestText=JSON.stringify(m);
 const r=await s.transport.acceptPrivate(p);assert.equal(r.ok,true);assert.equal(r.event.package.files['registry.json'],text);
 const matching=s.m.calls.filter(req=>req.url.includes('/git/blobs/')&&s.m.objects.get(req.url.split('/').pop())?.value.text===text);assert.ok(matching.length>0);
 for(const req of matching){assert.ok(req.maxResponseBytes>=6*1024*1024,'blob wire allowance must fit base64 JSON envelope');assert.ok(req.maxResponseBytes<=6*1024*1024,'fixed blob wire cap remains bounded')}
});
