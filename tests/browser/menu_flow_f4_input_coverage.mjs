// Independent F4 producer input-coverage supplement; frozen separately. Existing Playwright runtime only; no live credentials/network.
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
try {
  const f=fixtures();
  f['menu_current.json'].menu['2'].FRIDAY.dinner_flags={hasEgg:true};
  f['menu_current.json'].menu['2'].FRIDAY.dinner_veg='Plain Rice';
  f['door_state.json'].residents[0].tags=['No Eggs'];
  const run=await boot(f);
  await run.page.evaluate(()=>localStorage.setItem('concMenuEdits',JSON.stringify({'2-FRIDAY-dinner':{vegAllergens:'NONE'}})));
  const first=await run.publish(),a=clone(run.remote.files),ca=a['routing_by_meal.json'].flow?.rotation?.['2']?.FRIDAY?.dinner?.counts;
  await run.page.evaluate(()=>localStorage.setItem('concMenuEdits',JSON.stringify({'2-FRIDAY-dinner':{vegAllergens:'EGG'}})));
  const second=await run.publish(),b=clone(run.remote.files),cb=b['routing_by_meal.json'].flow?.rotation?.['2']?.FRIDAY?.dinner?.counts;
  check('I1 actual publisher succeeds for both operator-statement values',first.ok===true&&second.ok===true,{first,second});
  check('I2 real plating changes routing when the stored vegan allergen statement changes',!!ca&&!!cb&&JSON.stringify(ca)!==JSON.stringify(cb),{before:ca,after:cb});
  check('I3 changed routing input changes the canonical content identity',a['menu_current.json']._meta.flow?.inputRevision!==b['menu_current.json']._meta.flow?.inputRevision,{before:a['menu_current.json']._meta.flow,after:b['menu_current.json']._meta.flow});
  check('I4 operator statement does not alter the public menu or resident data',JSON.stringify(a['menu_current.json'].menu)===JSON.stringify(b['menu_current.json'].menu)&&JSON.stringify(a['door_state.json'].residents)===JSON.stringify(b['door_state.json'].residents));
  check('I5 no real-browser runtime errors',run.errors.length===0,run.errors);
} finally {for(const c of contexts)await c.close();await browser.close();}
console.log(`F4 producer input coverage: ${pass+fail} checks, ${pass} pass, ${fail} fail`);
process.exitCode=fail?1:0;
