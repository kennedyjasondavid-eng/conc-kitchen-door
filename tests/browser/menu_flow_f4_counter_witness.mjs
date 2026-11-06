// Independent known-witness counter-restore regression; synthetic applying transport only. Existing Playwright runtime only; no live credentials/network.
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
const COUNTER='door_flow_publication.json',FAMILIES=['menu_current.json','menu_overlay.json','registry_summary.json','routing_by_meal.json','door_state.json'];
const withCounter=()=>{const f=fixtures();f[COUNTER]={_meta:{site:'rexdale'},schema:1,flow:clone(f['menu_current.json']._meta.flow)};return f;};

try{
 const run=await boot(withCounter());await run.publish();const prior=clone(run.remote.files),oldFlow=prior['menu_current.json']._meta.flow,oldHead=run.remote.head;
 const lower={};for(const name of FAMILIES){lower[name]=clone(prior[name]);lower[name]._meta.flow.publication.sequence=40;}
 lower[COUNTER]=clone(prior[COUNTER]);lower[COUNTER].flow.publication.sequence=40;run.remote.externalUpdate(lower);
 const restoredHead=run.remote.head,witness=await run.page.evaluate(()=>localStorage.getItem('concDoorFlowPublication'));
 await run.page.evaluate(()=>{const menu=JSON.parse(localStorage.getItem('concUploadedMenu'));menu['2'].FRIDAY.dinner='Plain Rice, Peas';localStorage.setItem('concUploadedMenu',JSON.stringify(menu));localStorage.setItem('concUploadedMenuTimestamp',String(Date.now()+100000));});
 const result=await run.publish(),flow=run.remote.files['menu_current.json']._meta.flow;
 check('W1 fixture first commits41 and retains its known witness',oldFlow.publication.sequence===41&&JSON.parse(witness).sequence===41,{old:oldFlow.publication,witness});
 check('W2 ordinary counter/public restoration is a later immutable head',restoredHead!==oldHead&&lower[COUNTER].flow.publication.sequence===40);
 check('W3 known higher witness holds restored lower counter without another content commit',result.ok!==true&&run.remote.visibleWrites.length===1,{result,writes:run.remote.visibleWrites.length,flow});
 check('W4 held work cannot overwrite the durable committed witness',await run.page.evaluate(w=>localStorage.getItem('concDoorFlowPublication')===w,witness));
 check('W5 held work preserves the new local menu intent',await run.page.evaluate(()=>JSON.parse(localStorage.getItem('concUploadedMenu'))['2'].FRIDAY.dinner==='Plain Rice, Peas'));
 check('W6 no browser runtime errors',run.errors.length===0,run.errors);
}finally{await browser.close();}
console.log('menu_flow_f4_counter_witness: '+pass+' passed, '+fail+' failed');process.exitCode=fail?1:0;
