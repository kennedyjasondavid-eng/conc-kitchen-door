// Independent F4 receipt-loss/ancestry and expected-head publication gate. Existing Playwright runtime only; no live credentials/network.
// All requests are intercepted. Operational repository files are never written.
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { RecoveryRemote } from '../helpers/door_publish_recovery_box.mjs';
import { initialRemote } from '../helpers/door_publish_transaction_box.mjs';
import { clone, inputs, receipt, digest } from '../fixtures/menu_flow_f4_cases.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const NOW='2026-11-04T12:00:00Z', KEY='2026-11-06-dinner';
const FILE=pathToFileURL(process.env.HOUSE_FLOW_HTML||resolve(root,'index.html')).href;
const html=readFileSync(new URL(FILE),'utf8');
console.log('F4 producer source SHA256 '+createHash('sha256').update(html).digest('hex'));
let pass=0,fail=0;
const check=(name,ok,detail)=>{console.log((ok?'PASS ':'FAIL ')+name+(!ok&&detail!==undefined?' '+JSON.stringify(detail).slice(0,700):''));ok?pass++:fail++;};
function fixtures({swaps={},reverted={},specials={},removed={}}={}) {
  const i=inputs();
  i.registry.residents=i.registry.residents.map(r=>({...r,section:'Regular',restrictions:[],allergenFlags:[],accommodations:[],preferences:[],avoidances:[],_tierMigrated:true}));
  for(const days of Object.values(i.menu))for(const day of Object.values(days)) {
    for(const meal of ['breakfast','lunch','dinner']) {
      day[meal]='Plain Rice';day[meal+'_flags']={};
      day[meal+'_slots']={main:{recipeName:'Plain Rice',flags:{}}};
    }
  }
  // Real exporter must correct this stored contradiction and regenerate the displayed allergen line.
  i.menu['1'].MONDAY.dinner_flags={hasPork:true,halalCertifiedMeat:true};
  i.menu['1'].MONDAY.allergens_dinner='INTENTIONALLY STALE TEXT';
  i.dated={swaps,reverted,specials,removed};
  const files=initialRemote();
  files['menu_current.json'].menu=clone(i.menu);
  files['door_state.json']={_meta:{version:30,exported:NOW,registryModifiedAt:NOW,count:148},residents:clone(i.registry.residents),anaphRooms:[]};
  for(const [name,value] of Object.entries({'meal_swaps.json':swaps,'meal_swaps_reverted.json':reverted,'special_meals.json':specials,'special_meals_removed.json':removed}))files[name]=clone(value);
  const flow={...receipt(i),publication:{epoch:'synthetic-f4-publisher-epoch',sequence:40}};
  for(const name of ['menu_current.json','menu_overlay.json','registry_summary.json','routing_by_meal.json','door_state.json'])files[name]._meta={...files[name]._meta,site:'rexdale',flow:clone(flow)};
  return files;
}
const browser=await chromium.launch({headless:true});
const contexts=[];
async function boot(files) {
  const remote=new RecoveryRemote(files),ctx=await browser.newContext({timezoneId:'America/Toronto'});contexts.push(ctx);
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date(NOW)});
  await ctx.addInitScript(({files,NOW})=>{
    if(sessionStorage.getItem('__f4_seeded'))return;sessionStorage.setItem('__f4_seeded','1');
    const seed={concUploadedMenu:files['menu_current.json'].menu,concMenuBase:files['menu_overlay.json'],concRegistryState:files['door_state.json'],
      'conc-door-anaph':[],concMealSwaps:files['meal_swaps.json'],concSpecialMeals:files['special_meals.json'],concRevertedSwapKeys:files['meal_swaps_reverted.json'],concRemovedSpecialKeys:files['special_meals_removed.json']};
    for(const [k,v] of Object.entries(seed))localStorage.setItem(k,JSON.stringify(v));
    localStorage.setItem('concUploadedMenuTimestamp',String(Date.parse(NOW)+1000));
    localStorage.setItem('concRegistryProvenance',NOW);
  },{files,NOW});
  await ctx.route('**',async route=>{
    const req=route.request(),url=req.url();
    if(url===FILE)return route.fulfill({status:200,contentType:'text/html',body:html});
    if(url.startsWith('file:')||url.startsWith('data:'))return route.continue();
    if(url.startsWith('https://api.github.com/repos/fixture/door/')) {
      try {const r=await remote.fetch(url,{method:req.method(),body:req.postData()});return route.fulfill({status:r.status,contentType:'application/json',body:JSON.stringify(await r.json())});}
      catch {return route.fulfill({status:503,contentType:'application/json',body:'{"message":"synthetic lost acknowledgement"}'});}
    }
    const name=new URL(url).pathname.split('/').pop(),data=remote.files;
    return name in data?route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data[name])}):route.fulfill({status:404,body:'{}'});
  });
  async function ready() {
    await page.waitForFunction(()=>typeof publishToGitHub==='function'&&typeof _ghHydrated!=='undefined');
    await page.evaluate(async()=>{
      if(typeof ensureRegistrySynced==='function')await ensureRegistrySynced();
      PublishAuth._getSavedCredentials=()=>({repo:'fixture/door',token:'synthetic-f4-token'});
      PublishAuth.getRepo=()=> 'fixture/door';PublishAuth.getSavedToken=()=> 'synthetic-f4-token';PublishAuth.isViewingKey=()=>false;
      _ghHydrated=true;
    });
  }
  await page.goto(FILE);await ready();
  return {page,remote,errors,ready,publish:async()=>{
    try {return await page.evaluate(()=>publishToGitHub(false));}
    catch(e){return {error:String(e.message||e)};}
  }};
}
const FAMILIES=['menu_current.json','menu_overlay.json','registry_summary.json','routing_by_meal.json','door_state.json'];
function withoutReceipts(files){const changes={};for(const name of FAMILIES){changes[name]=clone(files[name]);delete changes[name]._meta.flow;}return changes;}
try{
 const restored=await boot(fixtures());await restored.publish();
 const original=restored.remote.files['menu_current.json']._meta.flow,ancestor=restored.remote.head;
 restored.remote.externalUpdate(withoutReceipts(restored.remote.files));const lostHead=restored.remote.head;
 const recovered=await restored.publish(),flow=restored.remote.files['menu_current.json']._meta.flow;
 check('L1 previously activated publication really lost its receipt in a later immutable commit',original?.publication?.sequence===41&&lostHead!==ancestor);
 check('L2 producer recovers existing epoch/sequence from pinned ancestry before publishing',recovered.ok===true&&flow?.publication?.epoch===original.publication.epoch&&flow?.publication?.sequence===42,{recovered,flow});
 const counter=restored.remote.files['door_flow_publication.json'];
 check('L3 recovery proves occurrence through immutable ancestry or pinned private counter',restored.remote.requests.some(r=>r.method==='GET'&&r.route==='/contents/menu_current.json'&&r.ref===ancestor)||(counter?.schema===1&&counter?._meta?.site==='rexdale'&&JSON.stringify(counter.flow)===JSON.stringify(flow)&&restored.remote.requests.some(r=>r.method==='GET'&&r.route==='/contents/door_flow_publication.json'&&r.ref===lostHead)));
 check('L4 restored publication remains one atomic write with equal family receipts',restored.remote.visibleWrites.length===2&&!!flow&&FAMILIES.every(n=>JSON.stringify(restored.remote.files[n]._meta.flow)===JSON.stringify(flow)));

 const blocked=await boot(fixtures());await blocked.publish();const blockedAncestor=blocked.remote.head;
 blocked.remote.externalUpdate(withoutReceipts(blocked.remote.files));const blockedHead=blocked.remote.head,before=blocked.remote.visibleWrites.length,fetch=blocked.remote.fetch.bind(blocked.remote);
 blocked.remote.fetch=async(url,opts={})=>{const u=new URL(url);if((opts.method||'GET')==='GET'&&((u.pathname.endsWith('/contents/menu_current.json')&&u.searchParams.get('ref')===blockedAncestor)||(u.pathname.endsWith('/contents/door_flow_publication.json')&&u.searchParams.get('ref')===blockedHead)))return{ok:false,status:503,json:async()=>({message:'synthetic ancestry receipt unavailable'})};return fetch(url,opts);};
 const held=await blocked.publish();
 check('L5 unreadable authoritative occurrence witness holds activated work without any new content commit',held.ok!==true&&blocked.remote.visibleWrites.length===before,{held,writes:blocked.remote.visibleWrites.length,before});
 const pending=await blocked.page.evaluate(()=>JSON.parse(localStorage.getItem('concPublishTransaction')||'null'));
 check('L6 failed receipt recovery cannot certify a reset occurrence',!blocked.remote.files['menu_current.json']._meta.flow&&blocked.remote.visibleWrites.length===before,{pending});

 const conflict=await boot(fixtures());conflict.remote.beforePatch=r=>{
  const changes={};for(const name of FAMILIES){changes[name]=clone(r.files[name]);changes[name]._meta.flow.publication.sequence=45;}r.externalUpdate(changes);
 };
 const retried=await conflict.publish(),cf=conflict.remote.files['menu_current.json']._meta.flow;
 check('L7 actual ref conflict rebuilds occurrence from new authoritative head',retried.ok===true&&cf?.publication?.sequence===46&&cf.publication.epoch==='synthetic-f4-publisher-epoch',{retried,cf});
 check('L8 ref-conflict retry creates exactly one visible content commit',conflict.remote.visibleWrites.length===1,conflict.remote.visibleWrites.length);
 check('L9 all receipt-loss browser executions remain healthy',[restored,blocked,conflict].every(x=>x.errors.length===0),[restored.errors,blocked.errors,conflict.errors]);
}finally{await browser.close();}
console.log(`menu_flow_f4_occurrence_recovery: ${pass} passed, ${fail} failed`);if(fail)process.exitCode=1;
