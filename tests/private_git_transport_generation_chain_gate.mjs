// Independent generation-chain gate; synthetic Git/API only, no real requests.
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


test('second generation accepts exact immutable first-generation parent without rewriting prior files',async()=>{
 const s=setup(),a=payload(s.m),ra=plain(await s.transport.acceptPrivate(a));assert.equal(ra.ok,true);
 const firstHead=ra.event.receipt.commit.sha,firstFiles=s.m.files(firstHead),observed=plain(await s.transport.observePrivate());
 assert.equal(observed.ok,true);assert.equal(observed.frame.head,firstHead);assert.equal(observed.frame.accepted.value.generationId,A);
 const parent={schema:1,generationId:A,operationId:OA,privateCommit:firstHead,publicInputWitness:a.operation.publicInputWitness};
 const b=payload(s.m,B,OB);b.operation.expectedPrivateHead=observed.frame.head;b.operation.parentAccepted=parent;
 const manifest=JSON.parse(b.manifestText);manifest.parentAcceptedGenerationId=A;b.manifestText=JSON.stringify(manifest);
 const rb=plain(await s.transport.acceptPrivate(b));assert.equal(rb.ok,true);assert.equal(rb.kind,'private-accepted-at-commit');
 assert.deepEqual(rb.event.receipt.commit.parents,[firstHead]);assert.equal(rb.event.receipt.refUpdate.before,firstHead);assert.equal(rb.event.receipt.commit.sha,s.m.head);
 assert.equal(rb.event.package.accepted.parentAcceptedGenerationId,A);assert.equal(rb.event.package.manifest.parentAcceptedGenerationId,A);
 for(const [path,text]of Object.entries(firstFiles))if(path!=='accepted.json')assert.equal(s.m.files()[path],text,path+' preserved');
 assert.deepEqual(s.m.files(firstHead),firstFiles);assert.equal(posts(s.m).length,2);
 const final=plain(await s.transport.observePrivate());assert.equal(final.ok,true);assert.equal(final.frame.accepted.value.generationId,B);assert.equal(final.frame.package.manifest.parentAcceptedGenerationId,A);
 const old=plain(await s.transport.readPackage(parent));assert.equal(old.ok,true);assert.equal(old.package.commit,firstHead);assert.equal(old.package.manifest.generationId,A);
});
