import {harness,fixture,clone,sourceHash,PUBLIC,FAMILIES,isDeliveryPublic} from './menu_flow_f6_harness.mjs';
let pass=0,fail=0;const check=(label,ok,detail)=>{console.log((ok?'PASS ':'FAIL ')+label+(!ok&&detail!==undefined?' '+JSON.stringify(detail).slice(0,850):''));ok?pass++:fail++;};
const epoch=value=>typeof value==='number'?value:Date.parse(value),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const isPublic=r=>isDeliveryPublic(r.url);
console.log('F6 source '+sourceHash);const h=await harness();
try {
  const b=await h.boot();await b.publish();const initial=await b.record(),head=b.remote.head;
  check('V1 new committed revision spends one immediate durable attempt',initial?.attemptCount===1&&initial.served===null&&initial.consumed===null,initial);
  const at=epoch(initial?.committedAt)||await b.page.evaluate(()=>Date.now());
  const until=async time=>{const now=await b.page.evaluate(()=>Date.now());if(time>now)await b.advance(time-now);};
  await until(at+4000);const early=await b.record();
  check('V2 before five seconds no second attempt is spent',early?.attemptCount===1,early);
  await b.page.reload();await b.ready();await b.settle();const reopened=await b.record();
  check('V3 restart preserves original debt identity time and spent budget',reopened?.committedSha===head&&reopened?.committedAt===initial?.committedAt&&reopened?.attemptCount===1,reopened);
  await until(at+5001);const second=await b.record();
  check('V4 five-second due attempt is exactly the second',second?.attemptCount===2,second);
  await b.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await b.settle();await b.publish();
  check('V5 focus and unchanged save cannot renew the attempt budget',(await b.record())?.attemptCount===2&&(await b.record())?.committedAt===initial?.committedAt,await b.record());
  await until(at+30001);const third=await b.record(),reads=b.requests.filter(isPublic).length;
  check('V6 thirty-second due attempt is exactly the third',third?.attemptCount===3,third);
  await b.page.clock.fastForward(10*60*1000);await b.settle();
  check('V7 exhausted automatic budget does not continue polling',same((await b.record())?.attemptCount,3)&&b.requests.filter(isPublic).length===reads,{record:await b.record(),reads,after:b.requests.filter(isPublic).length});
  b.delivery.files=clone(b.remote.files);const explicit=await b.recheck(),served=await b.record();
  check('V8 explicit recheck performs one extra read and records coherent served proof',explicit&&served?.attemptCount===4&&same(served.served?.publication,served.flow?.publication)&&served.served?.inputRevision===served.flow?.inputRevision,served);
  check('V9 closed EXPO remains unobserved without extra content commits',served?.consumed===null&&b.remote.visibleWrites.length===1,{served,writes:b.remote.visibleWrites.length});
  const fetches=await b.page.evaluate(()=>window.__f6Fetches);
  check('V10 verification uses anonymous cache-busted no-store public reads',PUBLIC.every(name=>fetches.some(r=>isPublic(r)&&new URL(r.url,locationFallback()).pathname.endsWith('/'+name)&&r.cache==='no-store'&&new URL(r.url,locationFallback()).search.length>0))&&!b.requests.filter(isPublic).some(r=>r.auth),fetches.slice(-15));
  const observed=served?.served?.observedAt;await b.page.clock.fastForward(8*24*60*60*1000);await b.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await b.settle();
  const aged=await b.record(),agedUi=await b.ui();
  check('V11 evidence older than seven days stays historical without time or budget renewal',aged?.served?.observedAt===observed&&aged?.committedAt===served?.committedAt&&aged?.attemptCount===4&&/historical|previously|last verified|expired|check.*delivery/i.test(agedUi.status+' '+agedUi.sync),{aged,status:agedUi.status,sync:agedUi.sync});
  for(const mode of ['future','malformed']){
    const changedAt=await b.page.evaluate(mode=>{
      const value=mode==='future'?new Date(Date.now()+86400000).toISOString():'malformed-observation';
      const visit=v=>{if(!v||typeof v!=='object')return;if(v.schema===1&&v.committedSha&&v.served){v.served.observedAt=value;return;}for(const child of Object.values(v))visit(child);};
      for(const key of Object.keys(localStorage))try{const v=JSON.parse(localStorage.getItem(key));visit(v);localStorage.setItem(key,JSON.stringify(v));}catch{}return value;
    },mode);
    await b.page.reload();await b.ready();await b.settle();const saved=await b.record(),view=await b.ui();
    check('V11b '+mode+' evidence is historical and cannot regain a read budget',saved?.served?.observedAt===changedAt&&saved?.attemptCount===4&&/historical|previously|last verified|expired|check.*delivery/i.test(view.status+' '+view.sync),{saved,status:view.status,sync:view.sync});
  }

  // DOOR consumes the exact F4 capability, never a copied flow or matching words.
  for(const kind of ['old-publisher','imported','manual','stale-build','wrong-publication','rebuilt','rebuilt-roster']){
    const run=await h.boot();
    if(kind==='rebuilt-roster')await run.page.evaluate(()=>{REGISTRY_LIST.pop();const state=JSON.parse(localStorage.getItem('concRegistryState'));state.residents=REGISTRY_LIST;state._meta.registryModifiedAt=new Date(Date.now()+1000).toISOString();localStorage.setItem('concRegistryState',JSON.stringify(state));localStorage.setItem('concRegistryProvenance',state._meta.registryModifiedAt);});
    await run.publish();run.delivery.files=clone(run.remote.files);
    const flow=clone(run.remote.files['menu_current.json']._meta.flow),attestation={schema:1,capability:'door-flow-build-v1',inputRevision:flow.inputRevision,publication:clone(flow.publication)};
    if(kind==='stale-build')attestation.inputRevision='sha256:'+'0'.repeat(64);
    if(kind==='wrong-publication')attestation.publication.sequence--;
    run.delivery.expo={_doorMenu:{site:'rexdale',flow,...(['old-publisher','imported','manual'].includes(kind)?{}:{buildAttestation:attestation})},_menuSource:kind};run.delivery.expoStatus=200;
    await run.recheck();const evidence=await run.record();
    check('V12 '+kind+' consumption proof',!!evidence&&!!evidence.served&&(kind.startsWith('rebuilt')?same(evidence.consumed?.publication,flow.publication)&&evidence.consumed?.inputRevision===flow.inputRevision:evidence.consumed===null),evidence);
  }
  for(const mode of ['missing-support','different-epoch','higher-coherent']){
    const run=await h.boot();await run.publish();run.delivery.files=clone(run.remote.files);
    if(mode==='missing-support')delete run.delivery.files['registry_summary.json'];
    else for(const name of FAMILIES){if(mode==='different-epoch')run.delivery.files[name]._meta.flow.publication.epoch='different';else run.delivery.files[name]._meta.flow.publication.sequence++;}
    await run.recheck();const evidence=await run.record();
    check('V13 '+mode+' anonymous serving proof',!!evidence&&(mode==='higher-coherent'?evidence.served?.publication?.sequence===run.remote.files['menu_current.json']._meta.flow.publication.sequence+1:evidence.served===null),evidence);
  }
  const legacy=await h.boot(fixture({legacy:true}));await legacy.publish();legacy.delivery.files=clone(legacy.remote.files);delete legacy.delivery.files['meal_swaps_reverted.json'];await legacy.recheck();
  check('V14 absent legacy receipts cannot treat missing supporting data as served',(await legacy.record())?.served===null,await legacy.record());
  legacy.delivery.files=clone(legacy.remote.files);await legacy.recheck();const legacyProof=await legacy.record();
  check('V15 all seven legacy digests can prove serving but never consumption',legacyProof?.served?.committedSha===legacy.remote.head&&legacyProof?.consumed===null&&legacyProof?.flow===null,legacyProof);
  check('V16 no deployment rerun or unsupported external writes',b.illegal.length===0&&legacy.illegal.length===0);
  check('V17 primary delivery cases have no runtime errors',b.errors.length===0&&legacy.errors.length===0,{b:b.errors,legacy:legacy.errors});
}finally{await h.close();}
console.log('menu_flow_f6_delivery: '+pass+' passed, '+fail+' failed');process.exitCode=fail?1:0;
function locationFallback(){return 'https://fixture.github.io/door/';}
