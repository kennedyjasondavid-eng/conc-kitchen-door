// Frozen F6 actual-browser harness. Git and anonymous delivery are independent.
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {RecoveryRemote} from '../helpers/door_publish_recovery_box.mjs';
import {initialRemote} from '../helpers/door_publish_transaction_box.mjs';
import {clone,inputs,receipt} from '../fixtures/menu_flow_f4_cases.mjs';
export {clone};
export const NOW='2026-11-04T12:00:00Z',PUBLIC=['meal_swaps.json','meal_swaps_reverted.json','menu_current.json','registry_summary.json','routing_by_meal.json','special_meals.json','special_meals_removed.json'];
export const FAMILIES=['menu_current.json','menu_overlay.json','registry_summary.json','routing_by_meal.json','door_state.json'];
export const isDeliveryPublic=url=>{const u=new URL(url,'https://fixture.github.io/door/');return u.origin==='https://fixture.github.io'&&u.pathname.startsWith('/door/')&&PUBLIC.includes(u.pathname.split('/').pop());};
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const file=pathToFileURL(process.env.HOUSE_FLOW_HTML||resolve(root,'index.html')).href;
export const html=readFileSync(new URL(file),'utf8'),sourceHash=createHash('sha256').update(html).digest('hex');
export function fixture({legacy=false}={}) {
  const i=inputs();i.registry.residents=i.registry.residents.map(r=>({...r,section:'Regular',restrictions:[],allergenFlags:[],accommodations:[],preferences:[],avoidances:[],_tierMigrated:true}));
  for(const days of Object.values(i.menu))for(const day of Object.values(days))for(const meal of ['breakfast','lunch','dinner']){
    day[meal]='Plain Rice';day[meal+'_flags']={};day[meal+'_slots']={main:{recipeName:'Plain Rice',flags:{}}};
  }
  const files=initialRemote();files['menu_current.json'].menu=clone(i.menu);
  files['door_state.json']={_meta:{version:30,exported:NOW,registryModifiedAt:NOW,count:148},residents:clone(i.registry.residents),anaphRooms:[]};
  if(!legacy){const flow={...receipt(i),publication:{epoch:'synthetic-f6-epoch',sequence:40}};
    for(const name of FAMILIES)files[name]._meta={...files[name]._meta,site:'rexdale',flow:clone(flow)};
    files['door_flow_publication.json']={_meta:{site:'rexdale'},schema:1,flow:clone(flow)};
  }
  return files;
}
export async function harness() {
  const browser=await chromium.launch({headless:true}),contexts=[];
  async function boot(files=fixture(),options={}) {
    const remote=options.remote||new RecoveryRemote(files),ctx=await browser.newContext({timezoneId:'America/Toronto'});contexts.push(ctx);
    const page=await ctx.newPage(),errors=[],requests=[],illegal=[];
    const delivery={files:clone(options.served||files),status:200,expo:null,expoStatus:404,hold:null,onRead:null};
    page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date(NOW)});
    await page.clock.pauseAt(new Date(Date.parse(NOW)+1000));
    await ctx.addInitScript(({files,NOW,storage})=>{
      const realFetch=window.fetch.bind(window);window.__f6Fetches=[];
      window.fetch=(input,init)=>{window.__f6Fetches.push({url:typeof input==='string'?input:input.url,cache:init?.cache});return realFetch(input,init);};
      if(sessionStorage.getItem('__f6_seeded'))return;sessionStorage.setItem('__f6_seeded','1');
      const seed={concUploadedMenu:files['menu_current.json'].menu,concMenuBase:files['menu_overlay.json'],concRegistryState:files['door_state.json'],
        'conc-door-anaph':[],concMealSwaps:files['meal_swaps.json'],concSpecialMeals:files['special_meals.json'],concRevertedSwapKeys:files['meal_swaps_reverted.json'],concRemovedSpecialKeys:files['special_meals_removed.json']};
      for(const[k,v]of Object.entries(seed))localStorage.setItem(k,JSON.stringify(v));
      localStorage.setItem('concUploadedMenuTimestamp',String(Date.parse(NOW)+1000));localStorage.setItem('concRegistryProvenance',NOW);
      for(const[k,v]of Object.entries(storage||{}))localStorage.setItem(k,v);
    },{files,NOW,storage:options.storage});
    await ctx.route('**',async route=>{
      const req=route.request(),url=req.url(),u=new URL(url),name=u.pathname.split('/').pop();
      if(url===file)return route.fulfill({status:200,contentType:'text/html',body:html});
      if(url.startsWith('file:')||url.startsWith('data:'))return route.continue();
      requests.push({url,method:req.method(),name,auth:!!req.headers().authorization});
      if(url.startsWith('https://api.github.com/repos/fixture/door/')){
        if(u.pathname.includes('/actions/')){if(req.method()!=='GET')illegal.push(url);return route.fulfill({status:403,body:'{}'});}
        try{const response=await remote.fetch(url,{method:req.method(),body:req.postData()});return route.fulfill({status:response.status,contentType:'application/json',body:JSON.stringify(await response.json())});}
        catch{return route.fulfill({status:503,body:'{"message":"synthetic lost acknowledgement"}'});}
      }
      if(req.method()!=='GET'){illegal.push(url);return route.fulfill({status:403,body:'{}'});}
      if(name==='hub_schedule.json')return route.fulfill({status:delivery.expoStatus,contentType:'application/json',body:JSON.stringify(delivery.expo||{})});
      if(PUBLIC.includes(name)){
        if(isDeliveryPublic(url)&&delivery.onRead)await delivery.onRead({name,url});
        if(isDeliveryPublic(url)&&delivery.hold)await delivery.hold;
        const value=delivery.files[name];return route.fulfill({status:value===undefined?404:delivery.status,contentType:'application/json',body:JSON.stringify(value||{})});
      }
      return route.fulfill({status:404,body:'{}'});
    });
    const ready=async()=>{await page.waitForFunction(()=>typeof publishToGitHub==='function'&&typeof _ghHydrated!=='undefined');
      await page.evaluate(async()=>{
        if(typeof ensureRegistrySynced==='function')await ensureRegistrySynced();
        window.__f6Repo='fixture/door';PublishAuth._getSavedCredentials=()=>({repo:window.__f6Repo,token:'synthetic-f6-token'});
        PublishAuth.getRepo=()=>window.__f6Repo;PublishAuth.getSavedToken=()=> 'synthetic-f6-token';PublishAuth.isViewingKey=()=>false;_ghHydrated=true;
      });};
    const settle=async()=>{
      const deadline=Date.now()+15000;let quiet=0;
      while(Date.now()<deadline){
        await page.clock.runFor(1);
        await page.waitForLoadState('networkidle',{timeout:15000});
        // Native Web Lock callbacks can begin a fetch after an already-idle
        // network snapshot. Observe browser capability state, not product hooks.
        const locks=await page.evaluate(async()=>{
          if(!navigator.locks?.query)return 0;
          const state=await navigator.locks.query();return state.held.length+state.pending.length;
        });
        if(!locks){if(++quiet===2)return;}else quiet=0;
        await new Promise(resolve=>setTimeout(resolve,10));
      }
      throw new Error('synthetic browser delivery did not become quiescent');
    };
    const publish=async()=>{const result=await page.evaluate(()=>publishToGitHub(false)).catch(e=>({error:e.message}));await settle();return result;};
    await page.goto(file);await ready();await settle();
    const records=()=>page.evaluate(()=>{
      const out=[];const visit=(v,key)=>{if(!v||typeof v!=='object')return;if(v.schema===1&&Object.hasOwn(v,'committedSha')&&Object.hasOwn(v,'repo')){out.push({key,value:v});return;}for(const value of Object.values(v))visit(value,key);};
      for(const key of Object.keys(localStorage))try{visit(JSON.parse(localStorage.getItem(key)),key);}catch{}
      return out;
    });
    const record=async()=>{const all=await records();return all.find(x=>x.value.repo==='fixture/door'&&x.value.committedSha===remote.head)?.value||all.filter(x=>x.value.repo==='fixture/door').at(-1)?.value||null;};
    const recheck=async()=>{const found=await page.evaluate(async()=>{if(typeof doorRecheckDelivery!=='function')return false;await doorRecheckDelivery();return true;});await settle();return found;};
    const ui=()=>page.evaluate(()=>({status:document.getElementById('gh-status')?.textContent||'',sync:document.getElementById('sync-status')?.textContent||'',text:document.body.innerText,
      recheck:[...document.querySelectorAll('button,a')].some(e=>/doorRecheckDelivery/.test(e.getAttribute('onclick')||'')),links:[...document.querySelectorAll('a[href]')].map(a=>a.href)}));
    return {page,ctx,remote,delivery,errors,requests,illegal,ready,settle,publish,record,records,recheck,ui,
      advance:async ms=>{await page.clock.runFor(ms);await settle();},storage:()=>page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])))};
  }
  return {boot,close:()=>browser.close()};
}
