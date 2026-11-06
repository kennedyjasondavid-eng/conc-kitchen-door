// A known Git success and an uncertain/lost PATCH response are distinct facts.
import {harness,sourceHash} from './menu_flow_f6_harness.mjs';
let pass=0,fail=0;
const check=(name,ok,detail)=>{console.log((ok?'PASS ':'FAIL ')+name+(ok?'':' '+JSON.stringify(detail).slice(0,1500)));ok?pass++:fail++;};
console.log('F6 source '+sourceHash);const h=await harness();
try {
 for(const mode of ['ref-read','receipt-quota','uncertain-patch']){
  const b=await h.boot();let failedReads=0,patchResponses=0,failRef=mode==='ref-read';
  const transport=b.remote.fetch.bind(b.remote);
  b.remote.fetch=async(url,options={})=>{
    const path=new URL(url).pathname;
    if(failRef&&b.remote.visibleWrites.length===1&&(!options.method||options.method==='GET')&&path.endsWith('/git/ref/heads/main')){
      failedReads++;return {ok:false,status:503,json:async()=>({message:'synthetic post-commit ref read unavailable'})};
    }
    const response=await transport(url,options);
    if(options.method==='PATCH'&&path.endsWith('/git/refs/heads/main')&&response.ok)patchResponses++;
    return response;
  };
  if(mode==='uncertain-patch')b.remote.afterPatch=()=>{throw new Error('synthetic lost PATCH reply');};
  if(mode==='receipt-quota')await b.page.evaluate(()=>{
    const real=Storage.prototype.setItem;window.__f6QuotaHits=0;
    window.__f6RestoreStorage=()=>{Storage.prototype.setItem=real;};
    Storage.prototype.setItem=function(key,value){
      let isReceipt=false;try{const v=JSON.parse(value);isReceipt=v&&typeof v==='object'&&Object.values(v).some(r=>r?.schema===1&&r.repo==='fixture/door'&&typeof r.committedSha==='string');}catch{}
      if(isReceipt){window.__f6QuotaHits++;throw new DOMException('synthetic receipt quota','QuotaExceededError');}
      return real.call(this,key,value);
    };
  });
  await b.page.evaluate(mode=>{
    const overlay=JSON.parse(localStorage.getItem('concMenuBase')||'{}');
    overlay['2']={...(overlay['2']||{}),FRIDAY:{...(overlay['2']?.FRIDAY||{}),dinner:'F6 commit-status '+mode}};
    overlay._meta={...(overlay._meta||{}),dayEditedAt:{...(overlay._meta?.dayEditedAt||{}),'2|FRIDAY':Date.now()+10000}};
    localStorage.setItem('concMenuBase',JSON.stringify(overlay));doorOutboxAppend('F6 commit-status '+mode,'pending');
  },mode);
  await b.page.evaluate(mode=>publishAndSync('F6 commit-status '+mode),mode);await b.settle();
  const landed=b.remote.head,ui=await b.ui(),state=await b.page.evaluate(()=>({outbox:doorOutboxRead(),overlay:JSON.parse(localStorage.getItem('concMenuBase')||'{}'),quota:window.__f6QuotaHits||0}));
  const known=mode!=='uncertain-patch';
  check('K1 '+mode+' actual commit lands with the intended acknowledgement distinction',b.remote.visibleWrites.length===1&&(known?patchResponses===1:patchResponses===0)&&(mode!=='ref-read'||failedReads>0)&&(mode!=='receipt-quota'||state.quota>0),{writes:b.remote.visibleWrites.length,patchResponses,failedReads,quota:state.quota});
  const honestPending=text=>/Committed/i.test(text)&&/pending|receipt|confirmation/i.test(text)&&!/couldn[’']t send|not sent|Available to the kitchen|EXPO accepted|Sent to the kitchen/i.test(text);
  check('K2 '+mode+' normal wrapper describes known commit or genuine uncertainty truthfully',known?
    honestPending(ui.status)&&honestPending(ui.sync):
    !/Committed|Available to the kitchen|EXPO accepted this update|Sent to the kitchen/i.test(ui.status+' '+ui.sync),{status:ui.status,sync:ui.sync});
  check('K3 '+mode+' unacknowledged local intent and menu remain recoverable',state.overlay?.['2']?.FRIDAY?.dinner==='F6 commit-status '+mode&&JSON.stringify(state.outbox).includes('F6 commit-status '+mode),state);
  failRef=false;b.remote.afterPatch=null;
  if(mode==='receipt-quota')await b.page.evaluate(()=>window.__f6RestoreStorage());
  const retry=await b.publish(),record=await b.record();
  check('K4 '+mode+' recovery acknowledges the existing content without another commit',retry.ok===true&&b.remote.head===landed&&b.remote.visibleWrites.length===1&&record?.committedSha===landed&&(await b.page.evaluate(()=>doorOutboxRead())).length===0,{retry,head:b.remote.head,landed,writes:b.remote.visibleWrites.length,record:record?.committedSha});
  check('K5 '+mode+' status and recovery introduce no runtime errors or unsupported writes',b.errors.length===0&&b.illegal.length===0,{errors:b.errors,illegal:b.illegal});
 }
}finally{await h.close();}
console.log('menu_flow_f6_commit_status: '+pass+' passed, '+fail+' failed');process.exitCode=fail?1:0;
