// Independent actual two-tab commit acknowledgement ordering, including legacy.
import {harness,fixture,sourceHash} from './menu_flow_f6_harness.mjs';
let pass=0,fail=0;
const check=(name,ok,detail)=>{console.log((ok?'PASS ':'FAIL ')+name+(ok?'':' '+JSON.stringify(detail).slice(0,1400)));ok?pass++:fail++;};
console.log('F6 source '+sourceHash);const h=await harness();
try {
 for(const legacy of [false,true]){
  const mode=legacy?'legacy':'flow',b=await h.boot(fixture({legacy}));
  // The older applying transport returns its mutable current head after the
  // afterPatch hook. A real delayed Git response names THIS request's commit,
  // even if a different client has since advanced the ref. Fix only that wire
  // detail here; keep actual applying/CAS behavior and all original gates intact.
  const transport=b.remote.fetch.bind(b.remote);
  b.remote.fetch=async(url,options={})=>{
    const patch=options.method==='PATCH'&&new URL(url).pathname.endsWith('/git/refs/heads/main');
    const committed=patch?JSON.parse(options.body).sha:null,response=await transport(url,options);
    return patch&&response.ok?{...response,json:async()=>({object:{sha:committed}})}:response;
  };
  const popupPromise=b.page.waitForEvent('popup');await b.page.evaluate(()=>window.open(location.href,'f6-late-ack-'+Date.now()));
  const other=await popupPromise,popupErrors=[];other.on('pageerror',e=>popupErrors.push(e.message));
  await other.waitForFunction(()=>typeof publishToGitHub==='function'&&typeof _ghHydrated!=='undefined');
  await other.evaluate(()=>{
    PublishAuth._getSavedCredentials=()=>({repo:'fixture/door',token:'synthetic-f6-token'});
    PublishAuth.getRepo=()=> 'fixture/door';PublishAuth.getSavedToken=()=> 'synthetic-f6-token';PublishAuth.isViewingKey=()=>false;_ghHydrated=true;
  });
  let release,landedA=null;const held=new Promise(resolve=>{release=resolve;});
  b.remote.afterPatch=async()=>{landedA=b.remote.head;await held;};
  const first=b.page.evaluate(()=>publishToGitHub(false));
  for(let n=0;n<150&&!landedA;n++)await new Promise(r=>setTimeout(r,20));
  check('L1 '+mode+' A really lands while its Git HTTP acknowledgement is held',!!landedA&&b.remote.visibleWrites.length===1,{landedA,writes:b.remote.visibleWrites.length});
  await other.evaluate(()=>{
    const overlay=JSON.parse(localStorage.getItem('concMenuBase')||'{}');
    overlay['2']={...(overlay['2']||{}),FRIDAY:{...(overlay['2']?.FRIDAY||{}),dinner:'F6 later menu B'}};
    overlay._meta={...(overlay._meta||{}),dayEditedAt:{...(overlay._meta?.dayEditedAt||{}),'2|FRIDAY':Date.now()+10000}};
    localStorage.setItem('concMenuBase',JSON.stringify(overlay));doorOutboxAppend('F6 later menu B','pending');
  });
  const second=await other.evaluate(()=>publishToGitHub(false)),headB=b.remote.head,recordB=await b.record();
  const before=await b.page.evaluate(()=>({outbox:doorOutboxRead(),witness:JSON.parse(localStorage.getItem('concDoorFlowPublication')||'null')}));
  check('L2 '+mode+' B is a newer complete acknowledged operation before A resumes',second.ok===true&&headB!==landedA&&recordB?.committedSha===headB&&b.remote.visibleWrites.length===2&&before.outbox.length===0,{second,headB,record:recordB?.committedSha,writes:b.remote.visibleWrites.length,outbox:before.outbox});
  if(legacy)await other.evaluate(()=>{
    const overlay=JSON.parse(localStorage.getItem('concMenuBase')||'{}');overlay['2'].FRIDAY.dinner='F6 genuinely unsent menu C';
    overlay._meta.dayEditedAt['2|FRIDAY']=Date.now()+20000;localStorage.setItem('concMenuBase',JSON.stringify(overlay));
    doorOutboxAppend('F6 genuinely unsent menu C','pending');
  });
  release();const firstResult=await first;await b.settle();
  const after=await b.page.evaluate(()=>({overlay:JSON.parse(localStorage.getItem('concMenuBase')||'{}'),outbox:doorOutboxRead(),
    witness:JSON.parse(localStorage.getItem('concDoorFlowPublication')||'null'),transaction:JSON.parse(localStorage.getItem('concPublishTransaction')||'null')}));
  const final=await b.record();
  check('L3 '+mode+' delayed A cannot replace newer B delivery debt',firstResult.ok===true&&final?.committedSha===headB&&final?.operationId===recordB?.operationId&&JSON.stringify(final?.flow)===JSON.stringify(recordB?.flow)&&JSON.stringify(final?.publicDigests)===JSON.stringify(recordB?.publicDigests),{firstResult,final:final?.committedSha,headB,operation:final?.operationId,expected:recordB?.operationId});
  check('L4 '+mode+' older acknowledgement preserves real intent without inventing already-sent debt',legacy?
    after.overlay?.['2']?.FRIDAY?.dinner==='F6 genuinely unsent menu C'&&JSON.stringify(after.outbox).includes('F6 genuinely unsent menu C'):
    after.overlay?.['2']?.FRIDAY?.dinner==='F6 later menu B'&&after.outbox.length===0,{menu:after.overlay?.['2']?.FRIDAY?.dinner,outbox:after.outbox});
  check('L5 '+mode+' highest publication witness cannot move backward',legacy?final?.flow===null:
    after.witness?.epoch===before.witness?.epoch&&after.witness?.sequence===before.witness?.sequence,{before:before.witness,after:after.witness,flow:final?.flow?.publication});
  check('L6 '+mode+' local committed transaction continues to identify B',after.transaction?.head===headB,{transaction:after.transaction,headB});
  check('L7 '+mode+' receipt recovery makes no compensating content commit',b.remote.head===headB&&b.remote.visibleWrites.length===2,{head:b.remote.head,writes:b.remote.visibleWrites.length});
  check('L8 '+mode+' late-ack cases have no runtime errors or unsupported writes',b.errors.length===0&&popupErrors.length===0&&b.illegal.length===0,{errors:b.errors,popupErrors,illegal:b.illegal});
 }
}finally{await h.close();}
console.log('menu_flow_f6_late_ack: '+pass+' passed, '+fail+' failed');process.exitCode=fail?1:0;
