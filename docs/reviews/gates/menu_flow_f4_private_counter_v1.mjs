// Independent private high-water counter contract; synthetic applying transport only. Existing Playwright runtime only; no live credentials/network.
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
 const control=await boot(withCounter()),head=control.remote.head,result=await control.publish(),out=control.remote.files,flow=out['menu_current.json']._meta.flow,counter=out[COUNTER];
 check('C1 normal publication advances the private counter and all five receipts together',result.ok===true&&flow?.publication?.sequence===41&&counter?.schema===1&&counter?._meta?.site==='rexdale'&&JSON.stringify(counter.flow)===JSON.stringify(flow)&&FAMILIES.every(n=>JSON.stringify(out[n]._meta.flow)===JSON.stringify(flow)),{result,counter});
 check('C2 private counter is read at the same immutable expected head',control.remote.requests.some(r=>r.method==='GET'&&r.route==='/contents/'+COUNTER&&r.ref===head));
 check('C3 counter joins the one atomic visible content commit',control.remote.visibleWrites.length===1&&control.remote.visibleWrites[0].kind==='atomic'&&control.remote.visibleWrites[0].files[COUNTER]?.flow?.publication?.sequence===41);
 const yml=readFileSync(resolve(root,'.github/workflows/pages.yml'),'utf8'),loop=/^\s*for f in ([^;\n]+); do/m.exec(yml)?.[1]||'';
 check('C4 private counter is not served by the actual Pages allowlist',!loop.split(/\s+/).includes(COUNTER)&&!new RegExp('cp\\s+'+COUNTER.replaceAll('.','\\.')+'\\s').test(yml));
 check('C5 counter stores only existing receipt and opaque site/schema data',JSON.stringify(Object.keys(counter||{}).sort())===JSON.stringify(['_meta','flow','schema'])&&JSON.stringify(Object.keys(counter?._meta||{}))===JSON.stringify(['site']));

 const restoredFiles=withCounter();restoredFiles[COUNTER].flow.publication.sequence=41;
 const cold=await boot(restoredFiles),coldResult=await cold.publish(),coldFlow=cold.remote.files['menu_current.json']._meta.flow;
 check('C6 cold device repairs older public occurrence even with unchanged menu content',coldResult.ok===true&&coldFlow?.publication?.sequence===42&&coldFlow.publication.epoch==='synthetic-f4-publisher-epoch'&&cold.remote.visibleWrites.length===1,{coldResult,coldFlow});
 check('C7 cold-device repair keeps counter and every authoritative artifact identical',!!coldFlow&&JSON.stringify(cold.remote.files[COUNTER]?.flow)===JSON.stringify(coldFlow)&&FAMILIES.every(n=>JSON.stringify(cold.remote.files[n]._meta.flow)===JSON.stringify(coldFlow)));

 for(const mode of ['malformed','site','epoch','counter-behind','unreadable']){
  const f=withCounter();if(mode==='malformed')f[COUNTER].flow={schema:1};if(mode==='site')f[COUNTER]._meta.site='synthetic-other-site';if(mode==='epoch')f[COUNTER].flow.publication.epoch='synthetic-other-epoch';if(mode==='counter-behind')f[COUNTER].flow.publication.sequence=39;
  const b=await boot(f);if(mode==='unreadable')b.remote.failures.set(COUNTER,503);
  const r=await b.publish();check('C8 '+mode+' counter cannot partially publish or silently choose an occurrence',r.ok!==true&&b.remote.visibleWrites.length===0,{r,writes:b.remote.visibleWrites.length});
 }
 const crash=await boot(withCounter());crash.remote.afterPatch=()=>{throw new Error('synthetic lost acknowledgement');};await crash.publish();
 const landed=clone(crash.remote.files),pub=landed['menu_current.json']._meta.flow.publication;
 await crash.page.reload();await crash.ready();const ack=await crash.publish();
 check('C9 exact landed prepared counter/receipt recovers without replay',ack.ok===true&&crash.remote.visibleWrites.length===1&&JSON.stringify(crash.remote.files[COUNTER]?.flow?.publication)===JSON.stringify(pub));

 const mismatch=await boot(withCounter());mismatch.remote.afterPatch=()=>{throw new Error('synthetic lost acknowledgement');};await mismatch.publish();
 const original=clone(mismatch.remote.files),higher={};
 for(const n of FAMILIES){higher[n]=clone(original[n]);higher[n]._meta.flow.publication.sequence=45;}
 higher[COUNTER]={_meta:{site:'rexdale'},schema:1,flow:clone(higher['menu_current.json']._meta.flow)};mismatch.remote.externalUpdate(higher);
 const stale={};for(const n of FAMILIES)stale[n]=clone(original[n]);mismatch.remote.externalUpdate(stale);
 await mismatch.page.reload();await mismatch.ready();const repaired=await mismatch.publish(),fixed=mismatch.remote.files;
 check('C10 prepared semantic equality cannot acknowledge mismatched landed occurrences as a no-op',repaired.ok===true&&mismatch.remote.visibleWrites.length===2&&fixed['menu_current.json']._meta.flow?.publication?.sequence===46&&JSON.stringify(fixed[COUNTER]?.flow)===JSON.stringify(fixed['menu_current.json']._meta.flow),{repaired,writes:mismatch.remote.visibleWrites.length,public:fixed['menu_current.json']._meta.flow?.publication,counter:fixed[COUNTER]?.flow?.publication});
 check('C11 main counter scenarios have no browser runtime errors',[control,cold,crash,mismatch].every(x=>x.errors.length===0));
}finally{await browser.close();}
console.log(`menu_flow_f4_private_counter: ${pass} passed, ${fail} failed`);if(fail)process.exitCode=1;
