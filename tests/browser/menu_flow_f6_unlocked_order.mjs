// Independent missing-Web-Locks race: actual native digest is delayed, not replaced.
import {harness,fixture,sourceHash,isDeliveryPublic} from './menu_flow_f6_harness.mjs';
let pass=0,fail=0;
const check=(name,ok,detail)=>{console.log((ok?'PASS ':'FAIL ')+name+(ok?'':' '+JSON.stringify(detail).slice(0,1400)));ok?pass++:fail++;};
console.log('F6 source '+sourceHash);const h=await harness();
try {
 for(const legacy of [false,true]){
  const mode=legacy?'legacy':'flow',b=await h.boot(fixture({legacy}));
  const popupPromise=b.page.waitForEvent('popup');await b.page.evaluate(()=>window.open(location.href,'f6-unlocked-order-'+Date.now()));
  const other=await popupPromise,popupErrors=[];other.on('pageerror',e=>popupErrors.push(e.message));
  await other.waitForFunction(()=>typeof publishToGitHub==='function'&&typeof _ghHydrated!=='undefined');
  for(const page of [b.page,other])await page.evaluate(()=>{
    Object.defineProperty(navigator,'locks',{configurable:true,value:undefined});
    PublishAuth._getSavedCredentials=()=>({repo:'fixture/door',token:'synthetic-f6-token'});
    PublishAuth.getRepo=()=> 'fixture/door';PublishAuth.getSavedToken=()=> 'synthetic-f6-token';PublishAuth.isViewingKey=()=>false;_ghHydrated=true;
  });
  await b.page.evaluate(()=>{
    const native=crypto.subtle.digest.bind(crypto.subtle);
    window.__f6ArmDigest=false;window.__f6DigestHeld=false;
    window.__f6DigestWait=new Promise(resolve=>{window.__f6ReleaseDigest=resolve;});
    Object.defineProperty(crypto.subtle,'digest',{configurable:true,value:async(...args)=>{
      if(window.__f6ArmDigest&&!window.__f6DigestHeld){window.__f6DigestHeld=true;await window.__f6DigestWait;}
      return native(...args);
    }});
  });
  // Arm only after A's real commit and its receipt writer's authoritative ref
  // read. Earlier producer/CAS digests are unaffected. Both tabs use native
  // digests and actual publisher code; the server transport remains applying.
  const transport=b.remote.fetch.bind(b.remote);let armed=false;
  b.remote.fetch=async(url,options={})=>{
    const response=await transport(url,options);
    if(!armed&&b.remote.visibleWrites.length===1&&(!options.method||options.method==='GET')&&new URL(url).pathname.endsWith('/git/ref/heads/main')){
      armed=true;await b.page.evaluate(()=>{window.__f6ArmDigest=true;});
    }
    return response;
  };
  const first=b.page.evaluate(()=>publishToGitHub(false));
  let held=false;for(let n=0;n<150&&!held;n++){
    held=await b.page.evaluate(()=>window.__f6DigestHeld);if(!held)await new Promise(r=>setTimeout(r,20));
  }
  const headA=b.remote.head;
  check('U1 '+mode+' A lands and pauses inside a real post-ref native digest',held&&armed&&b.remote.visibleWrites.length===1,{held,armed,writes:b.remote.visibleWrites.length});
  await other.evaluate(()=>{
    const overlay=JSON.parse(localStorage.getItem('concMenuBase')||'{}');
    overlay['2']={...(overlay['2']||{}),FRIDAY:{...(overlay['2']?.FRIDAY||{}),dinner:'F6 unsupported later menu B'}};
    overlay._meta={...(overlay._meta||{}),dayEditedAt:{...(overlay._meta?.dayEditedAt||{}),'2|FRIDAY':Date.now()+10000}};
    localStorage.setItem('concMenuBase',JSON.stringify(overlay));doorOutboxAppend('F6 unsupported later menu B','pending');
  });
  const second=await other.evaluate(()=>publishToGitHub(false)),headB=b.remote.head,recordB=await b.record();
  const before=await b.page.evaluate(()=>({outbox:doorOutboxRead(),witness:JSON.parse(localStorage.getItem('concDoorFlowPublication')||'null')}));
  check('U2 '+mode+' unsupported single-tab B completes as pending delivery before A resumes',second.ok===true&&headB!==headA&&recordB?.committedSha===headB&&b.remote.visibleWrites.length===2&&before.outbox.length===0&&recordB?.served===null&&recordB?.consumed===null,{second,headB,record:recordB,writes:b.remote.visibleWrites.length,outbox:before.outbox});
  if(legacy)await other.evaluate(()=>{
    const overlay=JSON.parse(localStorage.getItem('concMenuBase')||'{}');overlay['2'].FRIDAY.dinner='F6 unsupported genuine menu C';
    overlay._meta.dayEditedAt['2|FRIDAY']=Date.now()+20000;localStorage.setItem('concMenuBase',JSON.stringify(overlay));doorOutboxAppend('F6 unsupported genuine menu C','pending');
  });
  await b.page.evaluate(()=>window.__f6ReleaseDigest());const firstResult=await first;await b.settle();
  const after=await b.page.evaluate(()=>({overlay:JSON.parse(localStorage.getItem('concMenuBase')||'{}'),outbox:doorOutboxRead(),
    witness:JSON.parse(localStorage.getItem('concDoorFlowPublication')||'null'),transaction:JSON.parse(localStorage.getItem('concPublishTransaction')||'null')}));
  const final=await b.record(),ui=await b.ui();
  check('U3 '+mode+' delayed digest A cannot replace an observed newer B receipt',firstResult.ok===true&&final?.committedSha===headB&&final?.operationId===recordB?.operationId&&JSON.stringify(final?.flow)===JSON.stringify(recordB?.flow)&&JSON.stringify(final?.publicDigests)===JSON.stringify(recordB?.publicDigests),{firstResult,head:final?.committedSha,headB,operation:final?.operationId,expected:recordB?.operationId});
  check('U4 '+mode+' older completion neither invents sent debt nor removes genuine C',legacy?
    after.overlay?.['2']?.FRIDAY?.dinner==='F6 unsupported genuine menu C'&&JSON.stringify(after.outbox).includes('F6 unsupported genuine menu C'):
    after.overlay?.['2']?.FRIDAY?.dinner==='F6 unsupported later menu B'&&after.outbox.length===0,{menu:after.overlay?.['2']?.FRIDAY?.dinner,outbox:after.outbox});
  check('U5 '+mode+' local acknowledged transaction remains B',after.transaction?.head===headB,{transaction:after.transaction,headB});
  check('U6 '+mode+' remembered publication cannot move backward',legacy?final?.flow===null:after.witness?.epoch===before.witness?.epoch&&after.witness?.sequence===before.witness?.sequence,{before:before.witness,after:after.witness});
  check('U7 '+mode+' unsupported capability remains honestly pending with no anonymous verification',final?.served===null&&final?.consumed===null&&final?.attemptCount===0&&b.requests.filter(r=>isDeliveryPublic(r.url)).length===0&&!/EXPO accepted this update|Kitchen feed is current|Sent to the kitchen/.test(ui.status+' '+ui.sync),{record:final,reads:b.requests.filter(r=>isDeliveryPublic(r.url)),status:ui.status,sync:ui.sync});
  check('U8 '+mode+' ordering fallback adds no content commits or runtime failures',b.remote.head===headB&&b.remote.visibleWrites.length===2&&b.errors.length===0&&popupErrors.length===0&&b.illegal.length===0,{head:b.remote.head,writes:b.remote.visibleWrites.length,errors:b.errors,popupErrors,illegal:b.illegal});
 }
}finally{await h.close();}
console.log('menu_flow_f6_unlocked_order: '+pass+' passed, '+fail+' failed');process.exitCode=fail?1:0;
