// Delivery observation must not become a new delay in the actual save queue.
import {harness,clone,sourceHash} from './menu_flow_f6_harness.mjs';
let pass=0,fail=0;
const check=(name,ok,detail)=>{console.log((ok?'PASS ':'FAIL ')+name+(ok?'':' '+JSON.stringify(detail).slice(0,1500)));ok?pass++:fail++;};
console.log('F6 source '+sourceHash);const h=await harness();
try {
 const b=await h.boot();let release,entered=false,headA=null;
 b.delivery.hold=new Promise(resolve=>{release=resolve;});
 b.delivery.onRead=()=>{if(entered)return;entered=true;headA=b.remote.head;b.delivery.files=clone(b.remote.files);};
 let firstDone=false,secondDone=false;
 const first=b.page.evaluate(()=>publishToGitHub(false)).then(r=>{firstDone=true;return r;},e=>({error:e.message}));
 for(let n=0;n<150&&!entered;n++)await new Promise(r=>setTimeout(r,20));
 check('Q1 A really commits before its anonymous delivery response is held',entered&&b.remote.visibleWrites.length===1&&!!headA,{entered,writes:b.remote.visibleWrites.length,headA});
 const clockAt=await b.page.evaluate(()=>Date.now());
 await b.page.evaluate(()=>{
   const overlay=JSON.parse(localStorage.getItem('concMenuBase')||'{}');
   overlay['2']={...(overlay['2']||{}),FRIDAY:{...(overlay['2']?.FRIDAY||{}),dinner:'F6 prompt urgent menu B'}};
   overlay._meta={...(overlay._meta||{}),dayEditedAt:{...(overlay._meta?.dayEditedAt||{}),'2|FRIDAY':Date.now()+10000}};
   localStorage.setItem('concMenuBase',JSON.stringify(overlay));doorOutboxAppend('F6 prompt urgent menu B','pending');
 });
 const second=b.page.evaluate(()=>publishToGitHub(false)).then(r=>{secondDone=true;return r;},e=>({error:e.message}));
 // Bounded driver scheduling only: do not expire the product's eight-second
 // request or release the Pages response to make the next commit possible.
 for(let n=0;n<200&&(!secondDone||b.remote.visibleWrites.length<2);n++)await new Promise(r=>setTimeout(r,20));
 const whileHeld=await b.page.evaluate(()=>({outbox:doorOutboxRead(),transaction:JSON.parse(localStorage.getItem('concPublishTransaction')||'null'),now:Date.now()}));
 const headBeforeRelease=b.remote.head,recordBefore=await b.record(),ui=await b.ui();
 check('Q2 A commit acknowledgement completes independently of anonymous delivery',firstDone,{firstDone});
 check('Q3 newer B commits and returns while A delivery remains unresolved',secondDone&&b.remote.visibleWrites.length===2&&headBeforeRelease!==headA&&whileHeld.now===clockAt,{secondDone,writes:b.remote.visibleWrites.length,headA,headBeforeRelease,now:whileHeld.now,clockAt});
 check('Q4 B durable receipt and local acknowledgement are current before any response',recordBefore?.committedSha===headBeforeRelease&&headBeforeRelease!==headA&&whileHeld.transaction?.head===headBeforeRelease&&whileHeld.outbox.length===0,{record:recordBefore?.committedSha,transaction:whileHeld.transaction,outbox:whileHeld.outbox});
 check('Q5 saved status is truthful pending while delivery is unavailable',/Committed/.test(ui.status+' '+ui.sync)&&/pending/.test(ui.status+' '+ui.sync)&&!/Available to the kitchen|EXPO accepted this update|Sent to the kitchen/.test(ui.status+' '+ui.sync),{status:ui.status,sync:ui.sync});
 release();const results=await Promise.all([first,second]);await b.settle();
 const final=await b.record(),headB=b.remote.head;
 check('Q6 delayed A serving proof cannot certify the newer B record',results.every(r=>r.ok===true)&&headB!==headA&&final?.committedSha===headB&&final?.served===null&&final?.consumed===null,{results,headA,headB,record:final});
 check('Q7 observation creates no third content commit',b.remote.visibleWrites.length===2,{writes:b.remote.visibleWrites.length});
 check('Q8 actual queue scenario has no runtime errors or unsupported writes',b.errors.length===0&&b.illegal.length===0,{errors:b.errors,illegal:b.illegal});
}finally{await h.close();}
console.log('menu_flow_f6_prompt_publish: '+pass+' passed, '+fail+' failed');process.exitCode=fail?1:0;
