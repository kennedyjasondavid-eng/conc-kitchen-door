// Independent food/data supplement: observed authority precedes full serving proof.
import {harness,clone,sourceHash} from './menu_flow_f6_harness.mjs';
let pass=0,fail=0;
const check=(name,ok,detail)=>{console.log((ok?'PASS ':'FAIL ')+name+(ok?'':' '+JSON.stringify(detail).slice(0,1900)));ok?pass++:fail++;};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const proof=flow=>({_menuSource:'live',_doorMenu:{site:'rexdale',flow:clone(flow),buildAttestation:{schema:1,capability:'door-flow-build-v1',inputRevision:flow.inputRevision,publication:clone(flow.publication)}}});
const edit=async(box,text)=>box.page.evaluate(text=>{
 const overlay=JSON.parse(localStorage.getItem('concMenuBase')||'{}');
 overlay['2']={...(overlay['2']||{}),FRIDAY:{...(overlay['2']?.FRIDAY||{}),dinner:text}};
 overlay._meta={...(overlay._meta||{}),dayEditedAt:{...(overlay._meta?.dayEditedAt||{}),'2|FRIDAY':Date.now()+10000}};
 localStorage.setItem('concMenuBase',JSON.stringify(overlay));doorOutboxAppend('F6 observed authority edit','pending');
},text);
const state=async box=>({record:await box.record(),view:await box.ui(),fresh:await box.page.evaluate(()=>doorDeliveryFresh(doorDeliveryCurrent()?.served))});
const pending=s=>!s.fresh&&!/Available to the kitchen|EXPO accepted this update/i.test(s.view.status+' '+s.view.sync);
const retained=(s,prior)=>same(s.record?.served?.publication,prior.served.publication)&&s.record?.served?.inputRevision===prior.served.inputRevision&&s.record?.served?.observedAt===prior.served.observedAt;
const current=(s,flow)=>s.fresh&&same(s.record?.served?.publication,flow.publication)&&s.record?.served?.inputRevision===flow.inputRevision&&/Available to the kitchen/.test(s.view.status+' '+s.view.sync);
console.log('F6 source '+sourceHash);const h=await harness();
try {
 const a=await h.boot();await a.publish();const filesA=clone(a.remote.files),flowA=filesA['menu_current.json']._meta.flow;
 a.delivery.files=clone(filesA);a.delivery.expo=proof(flowA);a.delivery.expoStatus=200;await a.recheck();const acceptedA=await state(a);
 check('O1 actual A has coherent served and exact completed-build evidence',current(acceptedA,flowA)&&same(acceptedA.record?.consumed?.publication,flowA.publication),acceptedA);
 const b=await h.boot(clone(filesA));await edit(b,'F6 authority B genuinely changes this menu');await b.publish();
 const filesB=clone(b.remote.files),flowB=filesB['menu_current.json']._meta.flow;
 check('O2 B is a real changed-content higher publication',b.remote.visibleWrites.length===1&&flowB.inputRevision!==flowA.inputRevision&&flowB.publication.epoch===flowA.publication.epoch&&flowB.publication.sequence>flowA.publication.sequence,{flowA,flowB});

 // Bodies behind failed HTTP responses are not successful authoritative reads.
 a.delivery.files=clone(filesB);a.delivery.status=503;await a.advance(1000);await a.recheck();const offline=await state(a);
 check('O3 failed HTTP carrying B bytes retains bounded A without renewing it',current(offline,flowA)&&retained(offline,acceptedA.record),offline);
 a.delivery.status=200;
 const mixedB=clone(filesA);mixedB['menu_current.json']=clone(filesB['menu_current.json']);
 a.delivery.files=mixedB;await a.advance(1000);await a.recheck();const menuFirst=await state(a);
 check('O4 successful higher menu alone invalidates current A before companion coherence',pending(menuFirst),menuFirst);
 check('O5 observed B is not invented as served; historical A and its original age remain',retained(menuFirst,acceptedA.record),menuFirst.record);

 a.delivery.files=clone(filesA);a.delivery.expo=proof(flowA);await a.page.reload();await a.ready();await a.settle();await a.recheck();const restarted=await state(a);
 check('O6 restart plus coherent old A cannot erase the separately observed B witness',pending(restarted)&&retained(restarted,acceptedA.record),restarted);
 a.delivery.files=clone(filesB);a.delivery.expo=proof(flowB);await a.advance(1000);await a.recheck();const acceptedB=await state(a);
 check('O7 actual coherent B restores current serving and exact B consumption',current(acceptedB,flowB)&&same(acceptedB.record?.consumed?.publication,flowB.publication),acceptedB);

 // One valid receipt disagrees at the SAME occurrence; its surrounding body
 // cannot be promoted. This is authority conflict, not an ordinary failed read.
 const conflict=clone(filesB);conflict['registry_summary.json']._meta.flow=clone(flowA);
 conflict['registry_summary.json']._meta.flow.publication=clone(flowB.publication);
 a.delivery.files=conflict;await a.advance(1000);await a.recheck();const conflicting=await state(a);
 check('O8 successful same-occurrence conflicting registry suspends current B',pending(conflicting),conflicting);
 check('O9 conflicting mixed set preserves coherent B history and original age',retained(conflicting,acceptedB.record),conflicting.record);
 a.delivery.files=clone(filesB);await a.recheck();const restoredB=await state(a);
 check('O10 actual exact coherent B reread can recover after the mixed conflict',current(restoredB,flowB),restoredB);

 await edit(b,'F6 authority C genuinely changes this menu again');await b.publish();const filesC=clone(b.remote.files),flowC=filesC['menu_current.json']._meta.flow;
 check('O11 C is another real higher occurrence with changed content',b.remote.visibleWrites.length===2&&flowC.publication.sequence>flowB.publication.sequence&&flowC.inputRevision!==flowB.inputRevision,{flowB,flowC});
 const partialC=clone(filesB);partialC['routing_by_meal.json']=clone(filesC['routing_by_meal.json']);
 delete partialC['special_meals.json']; // this companion returns 404, while routing C succeeds
 a.delivery.files=partialC;await a.advance(1000);await a.recheck();const routingFirst=await state(a);
 check('O12 successful higher routing invalidates B even when another companion fails HTTP',pending(routingFirst),routingFirst);
 check('O13 incomplete C never becomes served and does not renew historical B',retained(routingFirst,restoredB.record),routingFirst.record);
 a.delivery.files=clone(filesB);a.delivery.expo=proof(flowB);await a.recheck();const oldB=await state(a);
 check('O14 coherent old B cannot recover after successful routing C was observed',pending(oldB)&&retained(oldB,restoredB.record),oldB);
 a.delivery.files=clone(filesC);a.delivery.expo=proof(flowC);await a.recheck();const acceptedC=await state(a);
 check('O15 actual complete C restores current serving and exact completed C',current(acceptedC,flowC)&&same(acceptedC.record?.consumed?.publication,flowC.publication),acceptedC);
 check('O16 observation and recovery create no compensating content commits',a.remote.visibleWrites.length===1&&b.remote.visibleWrites.length===2,{a:a.remote.visibleWrites.length,b:b.remote.visibleWrites.length});
 check('O17 all authority scenarios have zero runtime errors or unsupported writes',[a,b].every(box=>box.errors.length===0&&box.illegal.length===0),[a,b].map(box=>({errors:box.errors,illegal:box.illegal})));
}finally{await h.close();}
console.log('menu_flow_f6_observed_authority: '+pass+' passed, '+fail+' failed');process.exitCode=fail?1:0;
