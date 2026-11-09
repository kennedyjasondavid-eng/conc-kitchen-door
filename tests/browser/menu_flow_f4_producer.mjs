// Frozen F4 actual-producer gate. Existing Playwright runtime only; no live credentials/network.
// All requests are intercepted. Operational repository files are never written.
import { chromium } from 'playwright';
import { preActivationHtmlPath } from '../helpers/pre_activation_html.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { RecoveryRemote } from '../helpers/door_publish_recovery_box.mjs';
import { initialRemote } from '../helpers/door_publish_transaction_box.mjs';
import { clone, inputs, receipt, digest } from '../fixtures/menu_flow_f4_cases.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const NOW='2026-11-04T12:00:00Z', KEY='2026-11-06-dinner';
// 2026-11-09 (F4 on): this contract checks pre-activation rules, so by default it runs on a copy with the activation
// constants blanked (tests/helpers/pre_activation_html.mjs). Activated publishing: tests/f4_activated_publish_gate.mjs.
const FILE=pathToFileURL(process.env.HOUSE_FLOW_HTML||preActivationHtmlPath()).href;
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
try {
  const control=await boot(fixtures()),result=await control.publish(),out=control.remote.files;
  check('P1 real complete publisher succeeds against applying remote',result.ok===true&&control.remote.visibleWrites.length===1,result);
  const finalMenu=out['menu_current.json'].menu;
  check('P2 fixture executes actual pork/halal export normalization',finalMenu['1'].MONDAY.dinner_flags.halalCertifiedMeat===false);
  check('P3 fixture executes actual allergen-line regeneration',finalMenu['1'].MONDAY.allergens_dinner!=='INTENTIONALLY STALE TEXT');
  const flow=out['menu_current.json']._meta.flow;
  check('P4 receipt hashes final exported projection, not raw imported input',flow?.components?.menu===digest(finalMenu),flow?.components);
  check('P5 receipt occurrence advances from pinned authoritative 40 to 41',flow?.publication?.sequence===41&&flow?.publication?.epoch==='synthetic-f4-publisher-epoch',flow?.publication);
  for(const f of ['menu_overlay.json','routing_by_meal.json','registry_summary.json','door_state.json'])check('P6 same flow receipt on '+f,JSON.stringify(out[f]._meta.flow)===JSON.stringify(flow)&&!!flow);
  for(const f of ['meal_swaps.json','meal_swaps_reverted.json','special_meals.json','special_meals_removed.json'])check('P7 bare dated map stays metadata-free '+f,!('_meta' in out[f]));
  check('P8 independent rotation uses actual plating Regular148',out['routing_by_meal.json'].flow?.rotation?.['2']?.FRIDAY?.dinner?.counts?.Regular===148);
  check('P9 no real-browser runtime errors',control.errors.length===0,control.errors);

  const swap={specialName:'Peas and Corn',createdAt:'2026-11-03T12:00:00Z',_flagsRaw:{hasCorn:true},_rotationSlot:'2-FRIDAY-dinner'};
  const dated=await boot(fixtures({swaps:{[KEY]:swap,'2026-12-04-dinner':{...swap,specialName:'Plain Rice',_flagsRaw:{}}}}));
  await dated.publish();const routing=dated.remote.files['routing_by_meal.json'];
  check('P10 legacy effective next-service routing still names dated Corn',routing.routing['2'].FRIDAY.dinner._components?.['Peas and Corn']===148,routing.routing['2'].FRIDAY.dinner);
  check('P11 new rotation remains Plain Rice without next-service contamination',routing.flow?.rotation?.['2']?.FRIDAY?.dinner?.counts?._components?.['Plain Rice']===148);
  check('P12 first explicit occurrence is its own Corn override',routing.flow?.dated?.['2026-11-06']?.dinner?.counts?._components?.['Peas and Corn']===148);
  check('P13 second occurrence of the same slot has its own Rice override',routing.flow?.dated?.['2026-12-04']?.dinner?.counts?._components?.['Plain Rice']===148);

  const reverted=await boot(fixtures({swaps:{[KEY]:swap},reverted:{[KEY]:'2026-11-04T10:00:00Z'}}));await reverted.publish();
  const rr=reverted.remote.files['routing_by_meal.json'];
  check('P14 removed swap has no dated projection and real rotation restores',!rr.flow?.dated?.['2026-11-06']?.dinner&&rr.flow?.rotation?.['2']?.FRIDAY?.dinner?.counts?._components?.['Plain Rice']===148);
  const special=await boot(fixtures({swaps:{[KEY]:swap},specials:{[KEY]:{specialName:'Plain Rice',createdAt:'2026-11-04T10:00:00Z',_flagsRaw:{}}}}));await special.publish();
  const sp=special.remote.files['routing_by_meal.json'].flow?.dated?.['2026-11-06']?.dinner;
  check('P15 actual special precedence owns dated projection',sp?.kind==='special'&&sp.counts?._components?.['Plain Rice']===148,sp);

  const recovery=await boot(fixtures());recovery.remote.afterPatch=()=>{throw new Error('synthetic crash after accepted ref');};
  await recovery.publish();const landed=recovery.remote.files['menu_current.json']._meta.flow,firstWrites=recovery.remote.visibleWrites.length;
  await recovery.page.reload();await recovery.ready();const recovered=await recovery.publish();
  check('P16 landed occurrence N survives crash/restart without a second content commit',firstWrites===1&&recovery.remote.visibleWrites.length===1&&recovered.ok===true,{firstWrites,writes:recovery.remote.visibleWrites.length,recovered});
  check('P17 recovery reuses occurrence N rather than allocating N+1',!!landed?.publication&&JSON.stringify(recovery.remote.files['menu_current.json']._meta.flow?.publication)===JSON.stringify(landed.publication));
  const rec=await recovery.page.evaluate(()=>JSON.parse(localStorage.getItem('concPublishTransaction')||'null'));
  check('P18 recovered occurrence is durably acknowledged',rec?.status==='committed',rec?.status);
  if(process.env.F4_PRODUCER_OUT)writeFileSync(process.env.F4_PRODUCER_OUT,JSON.stringify({control:out,dated:dated.remote.files,reverted:reverted.remote.files,special:special.remote.files},null,2));
} finally {await browser.close();}
console.log(`menu_flow_f4_producer: ${pass} passed, ${fail} failed`);process.exitCode=fail?1:0;
