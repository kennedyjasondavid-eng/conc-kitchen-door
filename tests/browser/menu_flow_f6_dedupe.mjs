import {harness,fixture,clone,sourceHash,PUBLIC,FAMILIES} from './menu_flow_f6_harness.mjs';
import {digest} from '../fixtures/menu_flow_f4_cases.mjs';
let pass=0,fail=0;const check=(label,ok,detail)=>{console.log((ok?'PASS ':'FAIL ')+label+(!ok&&detail!==undefined?' '+JSON.stringify(detail).slice(0,850):''));ok?pass++:fail++;};
console.log('F6 source '+sourceHash);const h=await harness();
try {
  const b=await h.boot(),first=await b.publish(),committed=clone(b.remote.files),head=b.remote.head,record=await b.record();
  check('D1 changed operation lands exactly one real atomic content commit',first.ok===true&&b.remote.visibleWrites.length===1&&b.remote.visibleWrites[0].kind==='atomic',first);
  check('D2 durable receipt binds the actual committed operation and exact public digests',record?.schema===1&&record.repo==='fixture/door'&&record.branch==='main'&&record.site==='rexdale'&&record.committedSha===head&&typeof record.operationId==='string'&&record.operationId.length>0&&PUBLIC.every(name=>record.publicDigests?.[name]===digest(committed[name]))&&Object.keys(record.publicDigests||{}).length===7,record);
  check('D3 stale Pages and closed EXPO remain independently unobserved',!!record&&record.served===null&&record.consumed===null,record);
  const committedAt=record?.committedAt,postCount=b.remote.requests.filter(r=>r.method==='POST').length;
  await b.advance(1000);await b.publish();b.delivery.status=503;await b.publish();const same=await b.record();
  check('D4 repeated unchanged saves create no Git objects or content commits',b.remote.visibleWrites.length===1&&b.remote.requests.filter(r=>r.method==='POST').length===postCount,{writes:b.remote.visibleWrites.length});
  check('D5 unchanged save retains original committed time and outstanding delivery debt',same?.committedSha===head&&same?.committedAt===committedAt&&same?.served===null&&same?.consumed===null,same);
  await b.page.evaluate(()=>doorRequestCoherentPublish('Synthetic unchanged menu save'));await b.settle();const ui=await b.ui();
  const status=await b.page.evaluate(()=>[document.getElementById('gh-status')?.textContent,document.getElementById('sync-status')?.textContent].join(' | '));
  check('D6 real coherent request wrapper cannot overclaim kitchen delivery',!/Sent to the kitchen|available to the kitchen|kitchen update complete/i.test(status)&&/pending|committed|checking.*delivery|saved/i.test(status),status);
  check('D7 normal wrapper keeps unchanged operation at one content commit',b.remote.visibleWrites.length===1,b.remote.visibleWrites.length);
  check('D8 pending delivery has a working explicit recheck action and existing deployment link',ui.recheck&&ui.links.some(url=>url.includes('github.com/fixture/door/actions')),ui);
  check('D9 durable delivery receipt contains no token or resident details',!!same&&!/synthetic-f6-token|TEST-|residents|anaphRooms/.test(JSON.stringify(same)),same);
  const cold=await h.boot(committed,{served:fixture()}),coldResult=await cold.publish();
  check('D10 second device deduplicates pinned committed content without another local receipt',coldResult.ok===true&&cold.remote.visibleWrites.length===0,{coldResult,writes:cold.remote.visibleWrites.length});
  check('D11 cold device records pending delivery at its authoritative head',!!(await cold.record())&&(await cold.record()).committedSha===cold.remote.head&&(await cold.record()).served===null,await cold.record());
  const legacy=await h.boot(fixture({legacy:true}));await legacy.publish();const legacyHead=legacy.remote.head;
  await legacy.advance(1000);await legacy.publish();
  check('D12 legacy unchanged save also avoids a duplicate commit',legacy.remote.visibleWrites.length===1&&legacy.remote.head===legacyHead,legacy.remote.visibleWrites.length);
  check('D13 legacy receipt is explicitly uncertified with seven independent digests',(await legacy.record())?.flow===null&&Object.keys((await legacy.record())?.publicDigests||{}).length===7,await legacy.record());

  // Meaningful operations must never disappear behind logical input dedupe.
  const changed=await h.boot();await changed.publish();
  const mutations=[
    ['roster-only',()=>{REGISTRY_LIST.pop();const state=JSON.parse(localStorage.getItem('concRegistryState'));state.residents=REGISTRY_LIST;state._meta.registryModifiedAt=new Date(Date.now()+1000).toISOString();localStorage.setItem('concRegistryState',JSON.stringify(state));localStorage.setItem('concRegistryProvenance',state._meta.registryModifiedAt);}],
    ['recipe binding',()=>{const menu=JSON.parse(localStorage.getItem('concUploadedMenu'));menu['2'].FRIDAY.dinner_slots.main={recipeId:'roasted-potatoes',recipeName:'Roasted Potatoes',flags:{}};localStorage.setItem('concUploadedMenu',JSON.stringify(menu));localStorage.setItem('concUploadedMenuTimestamp',String(Date.now()+1000));}],
    ['dated scope',()=>localStorage.setItem('concMealSwaps',JSON.stringify({'2026-11-06-dinner':{specialName:'Plain Rice and Peas',createdAt:new Date().toISOString(),_flagsRaw:{hasCorn:true}}}))],
    ['real revert',()=>localStorage.setItem('concRevertedSwapKeys',JSON.stringify({'2026-11-06-dinner':new Date(Date.now()+1000).toISOString()}))],
    ['anaphylactic input',()=>{const room=REGISTRY_LIST[0].room;anaphRooms=[room];localStorage.setItem('conc-door-anaph',JSON.stringify(anaphRooms));}],
    ['staff record',()=>RECENT_LOG.unshift({date:new Date().toISOString(),action:'F6 synthetic staff note',detail:'retain exact staff words',_real:true})],
    ['meaningful similarly-named metadata',()=>{RECENT_LOG[0].exported='meaningful record text';RECENT_LOG[0]._meta={exported:'meaningful nested record metadata'};}],
  ];
  for(const[label,mutation]of mutations){await changed.advance(1001);const before=changed.remote.visibleWrites.length;await changed.page.evaluate(mutation);const result=await changed.publish();
    check('D14 '+label+' still produces one atomic changed operation',result.ok===true&&changed.remote.visibleWrites.length===before+1,{result,before,after:changed.remote.visibleWrites.length});}
  check('D15 meaningful staff metadata remains in the committed record',changed.remote.files['recent_log.json']?.[0]?.exported==='meaningful record text'&&changed.remote.files['recent_log.json'][0]._meta?.exported==='meaningful nested record metadata',changed.remote.files['recent_log.json']);
  const repairFiles=clone(committed);for(const name of FAMILIES)repairFiles[name]._meta.flow.publication.sequence--;
  const repair=await h.boot(repairFiles);const repaired=await repair.publish();
  check('D16 private counter ahead of otherwise identical public content still requires repair',repaired.ok===true&&repair.remote.visibleWrites.length===1&&repair.remote.files['door_flow_publication.json'].flow.publication.sequence===committed['door_flow_publication.json'].flow.publication.sequence+1,repaired);
  for(const kind of ['missing','malformed']){
    const files=clone(committed);if(kind==='missing')delete files['recent_log.json'];else files['recent_log.json']={malformed:'staff record list'};
    const run=await h.boot(files),result=await run.publish();
    check('D16b '+kind+' staged artifact is repaired or held, never false unchanged',result.ok!==true||run.remote.visibleWrites.length===1,{result,writes:run.remote.visibleWrites.length});
  }
  check('D17 every case avoids external writes/deployment reruns and runtime errors',[b,cold,legacy,changed,repair].every(x=>x.errors.length===0&&x.illegal.length===0));
}finally{await h.close();}
console.log('menu_flow_f6_dedupe: '+pass+' passed, '+fail+' failed');process.exitCode=fail?1:0;
