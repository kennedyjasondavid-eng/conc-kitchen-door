import {harness,fixture,clone,sourceHash,FAMILIES,isDeliveryPublic} from './menu_flow_f6_harness.mjs';
let pass=0,fail=0;const check=(label,ok,detail)=>{console.log((ok?'PASS ':'FAIL ')+label+(!ok&&detail!==undefined?' '+JSON.stringify(detail).slice(0,850):''));ok?pass++:fail++;};
console.log('F6 source '+sourceHash);const h=await harness();
try {
  const crash=await h.boot();crash.remote.afterPatch=()=>{throw new Error('lost acknowledgement');};await crash.publish();const landed=crash.remote.head;
  await crash.page.reload();await crash.ready();const recovered=await crash.publish(),proof=await crash.record();
  check('R1 lost Git acknowledgement recovers the same visible content commit',recovered.ok===true&&crash.remote.visibleWrites.length===1&&crash.remote.head===landed,{recovered,writes:crash.remote.visibleWrites.length});
  check('R2 recovered commit gets delivery debt without premature proof',proof?.committedSha===landed&&proof?.served===null&&proof?.consumed===null,proof);
  const latest=await h.boot();await latest.publish();const first=await latest.record();
  await latest.advance(1001);await latest.page.evaluate(()=>RECENT_LOG.unshift({date:new Date().toISOString(),action:'New meaningful staff record',_real:true}));await latest.publish();const second=await latest.record();
  check('R3 a newer complete operation replaces same-scope debt with its own pending identity',!!first&&!!second&&second.committedSha!==first.committedSha&&second.committedAt!==first.committedAt&&second.operationId!==first.operationId&&second.attemptCount===1&&second.served===null&&second.consumed===null,second);
  check('R4 one current record per scope avoids a growing staff delivery queue',(await latest.records()).filter(x=>x.value.repo==='fixture/door'&&x.value.site==='rexdale'&&x.value.branch==='main').length===1,await latest.records());
  const beforeScope=JSON.stringify(await latest.records());await latest.page.evaluate(()=>{window.__f6Repo='fixture/another-door';});await latest.recheck();
  check('R5 switching repository cannot erase another scope pending record',JSON.stringify(await latest.records())===beforeScope,await latest.records());

  // New local intent arrives while anonymous serving verification is outstanding.
  const intent=await h.boot();let entered=false,release;
  intent.delivery.hold=new Promise(resolve=>{release=resolve;});
  intent.delivery.onRead=async()=>{if(entered)return;entered=true;
    await intent.page.evaluate(()=>{const overlay=JSON.parse(localStorage.getItem('concMenuBase')||'{}');overlay['2']={...(overlay['2']||{}),FRIDAY:{dinner:'Unsent newer local menu intent'}};
      overlay._meta={...(overlay._meta||{}),dayEditedAt:{...(overlay._meta?.dayEditedAt||{}),'2|FRIDAY':Date.now()+10000}};
      localStorage.setItem('concMenuBase',JSON.stringify(overlay));doorOutboxAppend('Newer local intent during delivery','pending');});};
  const publishing=intent.page.evaluate(()=>publishToGitHub(false)).catch(e=>({error:e.message}));
  // Poll from the driver; do not advance the product's virtual timeout clock.
  for(let n=0;n<100&&!entered;n++)await new Promise(r=>setTimeout(r,25));
  release();await publishing;await intent.settle();
  const retained=await intent.page.evaluate(()=>({overlay:JSON.parse(localStorage.getItem('concMenuBase')||'{}'),outbox:doorOutboxRead()}));
  check('R6 actual delivery verification was held while newer intent arrived',entered);
  check('R7 verification never clears newer local menu intent or outbox work',retained.overlay?.['2']?.FRIDAY?.dinner==='Unsent newer local menu intent'&&JSON.stringify(retained.outbox).includes('Newer local intent during delivery'),retained);

  // First normalize through the real publisher, then race a subsequent no-op.
  const race=await h.boot();await race.publish();const captured=race.remote.head;let moved=false;
  race.remote.onRead=({file,ref,remote})=>{if(moved||ref!==captured||file!=='menu_current.json')return;moved=true;
    const files=clone(remote.files);for(const name of FAMILIES)files[name]._meta.flow.publication.sequence++;
    files['door_flow_publication.json'].flow=clone(files['menu_current.json']._meta.flow);
    remote.externalUpdate(files);
  };
  const result=await race.publish(),racedProof=await race.record();
  check('R8 actual pinned comparison experienced another device advancing the ref',moved&&race.remote.head!==captured);
  check('R9 obsolete pinned no-op cannot acknowledge the old head',result.ok!==true||racedProof?.committedSha===race.remote.head,{result,captured,head:race.remote.head,proof:racedProof});
  // A slow public endpoint must not create overlapping attempts or unbounded reads.
  const bounded=await h.boot();let firstRead=null,unblock;const failed=[];
  bounded.delivery.hold=new Promise(resolve=>{unblock=resolve;});
  bounded.delivery.onRead=({url})=>{if(!firstRead)firstRead=url;};
  bounded.page.on('requestfailed',request=>failed.push(request.url()));
  const boundedPublish=bounded.page.evaluate(()=>publishToGitHub(false)).catch(e=>({error:e.message}));
  for(let n=0;n<100&&!firstRead;n++)await new Promise(r=>setTimeout(r,25));
  check('R10 bounded verification reaches the actual anonymous transport',!!firstRead);
  const start=await bounded.page.evaluate(()=>Date.now());await bounded.page.clock.runFor(4000);
  await bounded.page.evaluate(()=>{if(typeof doorRecheckDelivery==='function'){doorRecheckDelivery();doorRecheckDelivery();}});
  const pending=await bounded.record(),publicReads=bounded.requests.filter(r=>isDeliveryPublic(r.url));
  check('R11 simultaneous rechecks coalesce the existing revision attempt',!!firstRead&&pending?.attemptCount===1&&new Set(publicReads.map(r=>r.name)).size===publicReads.length,{pending,publicReads});
  await bounded.page.clock.runFor(4001);for(let n=0;n<20&&!failed.includes(firstRead);n++)await new Promise(r=>setTimeout(r,10));
  check('R12 an unresolved public request is aborted within its eight-second bound',!!firstRead&&failed.includes(firstRead)&&await bounded.page.evaluate(()=>Date.now())<=start+8001,{firstRead,failed});
  unblock();await boundedPublish;await bounded.settle();
  check('R13 timeout leaves delivery pending without another content commit',(await bounded.record())?.served===null&&bounded.remote.visibleWrites.length===1,{record:await bounded.record(),writes:bounded.remote.visibleWrites.length});
  check('R14 recovery cases make no unsupported external writes and have no runtime errors',[crash,latest,intent,race,bounded].every(x=>x.illegal.length===0&&x.errors.length===0));
}finally{await h.close();}
console.log('menu_flow_f6_recovery: '+pass+' passed, '+fail+' failed');process.exitCode=fail?1:0;
