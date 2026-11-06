// Independent F6 release supplement: a known newer public occurrence never rewinds.
import {harness,clone,sourceHash,FAMILIES} from './menu_flow_f6_harness.mjs';
let pass=0,fail=0;
const check=(name,ok,detail)=>{console.log((ok?'PASS ':'FAIL ')+name+(ok?'':' '+JSON.stringify(detail,(key,value)=>['publicDigests','text','links'].includes(key)?undefined:key==='flow'&&value?{publication:value.publication,inputRevision:value.inputRevision}:value).slice(0,1800)));ok?pass++:fail++;};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const proof=flow=>({_menuSource:'live',_doorMenu:{site:'rexdale',flow:clone(flow),buildAttestation:{schema:1,capability:'door-flow-build-v1',inputRevision:flow.inputRevision,publication:clone(flow.publication)}}});
const edit=async(box,text)=>box.page.evaluate(text=>{
  const overlay=JSON.parse(localStorage.getItem('concMenuBase')||'{}');
  overlay['2']={...(overlay['2']||{}),FRIDAY:{...(overlay['2']?.FRIDAY||{}),dinner:text}};
  overlay._meta={...(overlay._meta||{}),dayEditedAt:{...(overlay._meta?.dayEditedAt||{}),'2|FRIDAY':Date.now()+10000}};
  localStorage.setItem('concMenuBase',JSON.stringify(overlay));doorOutboxAppend('F6 served ordering edit','pending');
},text);
const state=async box=>({record:await box.record(),view:await box.ui(),fresh:await box.page.evaluate(()=>doorDeliveryFresh(doorDeliveryCurrent()?.served))});
const pending=s=>!s.fresh&&!/Available to the kitchen|EXPO accepted this update/i.test(s.view.status+' '+s.view.sync);
const retains=(s,prior)=>same(s.record?.served?.publication,prior.served.publication)&&s.record?.served?.inputRevision===prior.served.inputRevision&&s.record?.served?.observedAt===prior.served.observedAt;
console.log('F6 source '+sourceHash);const h=await harness();
try {
  const a=await h.boot();await a.publish();const filesA=clone(a.remote.files),flowA=filesA['menu_current.json']._meta.flow;
  a.delivery.files=clone(filesA);a.delivery.expo=proof(flowA);a.delivery.expoStatus=200;await a.recheck();
  const deliveredA=await a.record();
  check('H1 actual A commit has independently served and consumed proof before supersession',a.remote.visibleWrites.length===1&&same(deliveredA?.served?.publication,flowA.publication)&&same(deliveredA?.consumed?.publication,flowA.publication),deliveredA);

  // B is a real second-device content publish, not a fabricated hash or merely
  // an incremented occurrence on A. A retains its own unchanged local receipt.
  const b=await h.boot(clone(filesA));await edit(b,'F6 genuinely different published menu B');await b.publish();
  const filesB=clone(b.remote.files),flowB=filesB['menu_current.json']._meta.flow;
  check('H2 actual B changes content and advances the same epoch once',b.remote.visibleWrites.length===1&&flowB.inputRevision!==flowA.inputRevision&&flowB.publication.epoch===flowA.publication.epoch&&flowB.publication.sequence>flowA.publication.sequence,{flowA,flowB,writes:b.remote.visibleWrites.length});
  a.delivery.files=clone(filesB);a.delivery.expo=proof(flowB);await a.advance(1000);await a.recheck();const deliveredB=await a.record();
  check('H3 coherent later B supersedes A and certifies the exact completed B',same(deliveredB?.served?.publication,flowB.publication)&&same(deliveredB?.consumed?.publication,flowB.publication)&&deliveredB?.served?.inputRevision===flowB.inputRevision,deliveredB);

  await a.advance(1000);a.delivery.files=clone(filesA);a.delivery.expo=proof(flowA);await a.recheck();const regressed=await state(a);
  check('H4 stale successful A cannot replace B high-water or renew its observation age',retains(regressed,deliveredB),regressed.record);
  check('H5 known public regression suspends current available and consumed claims',pending(regressed),regressed);
  await a.page.reload();await a.ready();await a.settle();const restarted=await state(a);
  check('H6 restart retains the higher B evidence and current uncertainty',retains(restarted,deliveredB)&&pending(restarted),restarted);

  a.delivery.files=clone(filesB);a.delivery.expo=proof(flowB);await a.advance(1000);await a.recheck();const restored=await state(a);
  check('H7 an actual same-B coherent reread restores fresh proof without another commit',restored.fresh&&same(restored.record?.served?.publication,flowB.publication)&&restored.record.served.observedAt!==deliveredB.served.observedAt&&a.remote.visibleWrites.length===1,restored);
  a.delivery.status=503;await a.advance(1000);await a.recheck();const failed=await state(a);
  check('H8 failed transport retains prior bounded B proof without renewing its age',failed.fresh&&retains(failed,restored.record),failed);
  a.delivery.status=200;

  const conflict=clone(filesA);for(const name of FAMILIES)conflict[name]._meta.flow.publication=clone(flowB.publication);
  a.delivery.files=conflict;a.delivery.expo=proof(conflict['menu_current.json']._meta.flow);await a.advance(1000);await a.recheck();const conflicted=await state(a);
  check('H9 a same-sequence conflicting coherent set cannot replace B high-water',retains(conflicted,restored.record),conflicted.record);
  check('H10 same-sequence conflict suspends current delivery claims',pending(conflicted),conflicted);

  a.delivery.files=clone(filesB);a.delivery.expo=proof(flowB);await a.recheck();const beforeExpiry=await a.record();
  await a.page.clock.fastForward(8*86400000);await a.settle();a.delivery.files=clone(filesA);a.delivery.expo=proof(flowA);await a.recheck();const expired=await state(a);
  check('H11 expired B still prevents a stale A read from resetting causal history',retains(expired,beforeExpiry)&&pending(expired),expired);

  // A genuine revert is another real content publish: A-like menu at C's later
  // occurrence is admissible, unlike the old A occurrence served above.
  await edit(b,filesA['menu_current.json'].menu['2'].FRIDAY.dinner);await b.publish();
  const filesC=clone(b.remote.files),flowC=filesC['menu_current.json']._meta.flow;
  check('H12 real later revert C advances B and preserves actual publication semantics',b.remote.visibleWrites.length===2&&flowC.publication.epoch===flowB.publication.epoch&&flowC.publication.sequence>flowB.publication.sequence&&flowC.inputRevision!==flowB.inputRevision,{flowB,flowC,writes:b.remote.visibleWrites.length});
  a.delivery.files=clone(filesC);a.delivery.expo=proof(flowC);await a.recheck();const later=await state(a);
  check('H13 a genuinely higher coherent C restores current serving and exact consumption',later.fresh&&same(later.record?.served?.publication,flowC.publication)&&same(later.record?.consumed?.publication,flowC.publication)&&/Available to the kitchen/.test(later.view.status),later);
  check('H14 delivery checks and causal recovery never manufacture content commits',a.remote.visibleWrites.length===1&&b.remote.visibleWrites.length===2,{a:a.remote.visibleWrites.length,b:b.remote.visibleWrites.length});
  check('H15 all real-publisher ordering cases have no runtime errors or unsupported writes',[a,b].every(box=>box.errors.length===0&&box.illegal.length===0),[a,b].map(box=>({errors:box.errors,illegal:box.illegal})));
} finally {await h.close();}
console.log('menu_flow_f6_served_order: '+pass+' passed, '+fail+' failed');process.exitCode=fail?1:0;
