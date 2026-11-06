// Independent F6 review supplement: real same-origin tabs and supersession.
import {harness,clone,sourceHash,FAMILIES,isDeliveryPublic} from './menu_flow_f6_harness.mjs';
let pass=0,fail=0;
const check=(name,ok,detail)=>{console.log((ok?'PASS ':'FAIL ')+name+(ok?'':' '+JSON.stringify(detail).slice(0,1300)));ok?pass++:fail++;};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const proof=flow=>({_menuSource:'live',_doorMenu:{site:'rexdale',flow:clone(flow),buildAttestation:{schema:1,capability:'door-flow-build-v1',inputRevision:flow.inputRevision,publication:clone(flow.publication)}}});
console.log('F6 source '+sourceHash);const h=await harness();
try {
  const b=await h.boot();await b.publish();await b.advance(31000);
  check('T1 first tab has exhausted its original three automatic attempts',(await b.record())?.attemptCount===3,await b.record());
  const popupPromise=b.page.waitForEvent('popup');
  await b.page.evaluate(()=>window.open(location.href,'f6-shared-delivery-tab'));
  const other=await popupPromise,popupErrors=[];other.on('pageerror',e=>popupErrors.push(e.message));
  await other.waitForFunction(()=>typeof doorRecheckDelivery==='function'&&typeof _ghHydrated!=='undefined');
  await other.evaluate(()=>{
    PublishAuth._getSavedCredentials=()=>({repo:'fixture/door',token:'synthetic-f6-token'});
    PublishAuth.getRepo=()=> 'fixture/door';PublishAuth.getSavedToken=()=> 'synthetic-f6-token';PublishAuth.isViewingKey=()=>false;_ghHydrated=true;
  });
  const otherRecord=await other.evaluate(head=>{
    const find=v=>{if(!v||typeof v!=='object')return null;if(v.schema===1&&v.repo==='fixture/door'&&v.committedSha===head)return v;for(const child of Object.values(v)){const match=find(child);if(match)return match;}return null;};
    for(const key of Object.keys(localStorage))try{const match=find(JSON.parse(localStorage.getItem(key)));if(match)return match;}catch{}return null;
  },b.remote.head);
  check('T2 two real tabs share the exact durable scope record',otherRecord?.attemptCount===3&&b.ctx.pages().length===2,otherRecord);
  // No storage key is used as an oracle: the first tab's record discovery reads
  // actual shared localStorage. The popup inherits the opener's session seed.
  let release,entered=0;b.delivery.hold=new Promise(resolve=>{release=resolve;});
  b.delivery.onRead=()=>{entered++;};b.delivery.files=clone(b.remote.files);
  const before=b.requests.filter(r=>isDeliveryPublic(r.url)).length;
  const first=b.page.evaluate(()=>doorRecheckDelivery());
  for(let n=0;n<100&&!entered;n++)await new Promise(r=>setTimeout(r,20));
  const second=other.evaluate(()=>doorRecheckDelivery());
  await new Promise(r=>setTimeout(r,150));
  const held=await b.record(),reads=b.requests.filter(r=>isDeliveryPublic(r.url)).length-before;
  check('T3 concurrent same-scope tabs share one active attempt and one seven-file read',entered>0&&held?.attemptCount===4&&reads===7,{held,reads});
  release();await Promise.all([first,second]);await b.settle();
  const completed=await b.record();
  check('T4 shared completion cannot roll back or duplicate the durable attempt budget',completed?.attemptCount===4&&completed?.served?.inputRevision===completed?.flow?.inputRevision&&b.remote.visibleWrites.length===1,{completed,writes:b.remote.visibleWrites.length});
  check('T5 real two-tab verification has no errors or unsupported writes',b.errors.length===0&&popupErrors.length===0&&b.illegal.length===0,{errors:b.errors,popupErrors,illegal:b.illegal});

  const s=await h.boot();await s.publish();s.delivery.files=clone(s.remote.files);
  const flowA=clone(s.remote.files['menu_current.json']._meta.flow);s.delivery.expo=proof(flowA);s.delivery.expoStatus=200;await s.recheck();
  const accepted=await s.record();
  check('T6 exact completed A is both served and consumed before supersession',same(accepted?.served?.publication,flowA.publication)&&same(accepted?.consumed?.publication,flowA.publication),accepted);
  for(const name of FAMILIES)s.delivery.files[name]._meta.flow.publication.sequence++;
  const flowB=clone(s.delivery.files['menu_current.json']._meta.flow);await s.recheck();
  const superseded=await s.record(),view=await s.ui();
  check('T7 coherent served B cannot retain A as current consumed credit',same(superseded?.served?.publication,flowB.publication)&&superseded?.consumed===null,superseded);
  check('T8 visible B delivery does not claim EXPO accepted B from stale A proof',!/EXPO accepted this update/i.test(view.status+' '+view.sync),view);
  s.delivery.expo=proof(flowB);await s.recheck();const current=await s.record();
  check('T9 actual B capability restores exact consumed credit without another commit',same(current?.served?.publication,flowB.publication)&&same(current?.consumed?.publication,flowB.publication)&&s.remote.visibleWrites.length===1,current);
  check('T10 supersession verification has no errors or unsupported writes',s.errors.length===0&&s.illegal.length===0,{errors:s.errors,illegal:s.illegal});

  const unsupported=await h.boot();
  await unsupported.page.evaluate(()=>Object.defineProperty(navigator,'locks',{configurable:true,value:undefined}));
  const result=await unsupported.publish();await unsupported.advance(31000);
  const unavailable=await unsupported.record(),unsupportedView=await unsupported.ui();
  check('T11 missing cross-tab lock capability never blocks the actual content save',result.ok===true&&unsupported.remote.visibleWrites.length===1&&!!unavailable,{result,writes:unsupported.remote.visibleWrites.length,unavailable});
  check('T12 missing lock capability stays honestly pending without automatic read attempts',unavailable?.attemptCount===0&&unavailable?.served===null&&unsupported.requests.filter(r=>isDeliveryPublic(r.url)).length===0&&/pending|committed/i.test(unsupportedView.status+' '+unsupportedView.sync),{unavailable,view:unsupportedView});
  check('T13 unsupported browser retains an actionable deployment link and healthy runtime',unsupportedView.links.some(url=>url.includes('github.com/fixture/door/actions'))&&unsupported.errors.length===0&&unsupported.illegal.length===0,{view:unsupportedView,errors:unsupported.errors,illegal:unsupported.illegal});
}finally{await h.close();}
console.log('menu_flow_f6_shared_delivery: '+pass+' passed, '+fail+' failed');process.exitCode=fail?1:0;
