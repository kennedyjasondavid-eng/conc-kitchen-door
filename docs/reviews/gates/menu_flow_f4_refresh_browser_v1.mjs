// F4 actual refresh companion, portable in EXPO and HUB. Synthetic wire data only.
// F3a/F3b recipe scaling is intentionally not the count oracle: use the product service-routing accessor.
import {chromium} from 'playwright';
import fs from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {candidate,inputs,clone,NOW,MAX_AGE,SERVICE} from './fixtures/menu_flow_f4_cases.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const isHub=fs.existsSync(resolve(root,'CONC_Production_Hub.html'));
const htmlPath=process.env.HOUSE_FLOW_HTML||resolve(root,isHub?'CONC_Production_Hub.html':'index.html');
const html=fs.readFileSync(htmlPath,'utf8');
console.log('F4 refresh source SHA256 '+createHash('sha256').update(html).digest('hex'));
const payload=isHub?JSON.parse(fs.readFileSync(resolve(root,'tests/fixtures/menu_flow_whole_meal.json'),'utf8')).payload:null;
if(payload)payload._version='f4-unchanged-schedule-version';
const feed=isHub?{recipes:{}}:JSON.parse(fs.readFileSync(resolve(root,'tests/fixtures/codex_recipe_production.json'),'utf8'));
let pass=0,fail=0;const check=(n,ok,d)=>{console.log((ok?'PASS ':'FAIL ')+n+(!ok&&d!==undefined?' '+JSON.stringify(d).slice(0,500):''));ok?pass++:fail++;};
const A=candidate(),B=candidate(inputs(142),2),C=candidate(inputs(140),3);
const browser=await chromium.launch({headless:true});
try {
  const ctx=await browser.newContext({timezoneId:'America/Toronto'}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let current=clone(A),holdRouting=false;const routingReleases=[];
  const wire=()=>({'menu_current.json':current.menu,'menu_overlay.json':current.overlay,'registry_summary.json':current.registry,'routing_by_meal.json':current.routing,
    'meal_swaps.json':current.swaps,'meal_swaps_reverted.json':current.reverted,'special_meals.json':current.specials,'special_meals_removed.json':current.removed});
  const seen=[];
  await page.clock.install({time:new Date(NOW)});
  await ctx.addInitScript(()=>{
    window.__EXPO_NOW__='2026-11-06';window.__HUB_NOW__='2026-11-06';
    localStorage.setItem('pp_data_sources',JSON.stringify({sharedEnabled:false}));
    window.__f4Fetch=[];const original=window.fetch.bind(window);
    window.fetch=function(url,opts){window.__f4Fetch.push({url:String(url),cache:opts?.cache||null});return original(url,opts);};
  });
  await ctx.route('**',async route=>{
    const url=route.request().url();
    if(!isHub&&url===pathToFileURL(htmlPath).href)return route.fulfill({status:200,contentType:'text/html',body:html});
    if(url.startsWith('file:')||url.startsWith('data:'))return route.continue();
    const pathname=new URL(url).pathname,name=pathname.split('/').pop();
    if(isHub&&pathname==='/conc-kitchen-hub/')return route.fulfill({status:200,contentType:'text/html',body:html});
    if(pathname.includes('/conc-kitchen-door/')) {
      const files=wire();if(name in files){
        const value=clone(files[name]);seen.push(name);
        if(name==='routing_by_meal.json'&&holdRouting)await new Promise(r=>{routingReleases.push(r);});
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
      }
    }
    const data=name==='recipe_production.json'?feed:isHub&&name==='hub_schedule.json'?payload:isHub&&name==='hub_schedule_version.json'?{version:payload._version}:undefined;
    return data!==undefined?route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)}):route.fulfill({status:404,body:'{}'});
  });
  const url=isHub?'https://kennedyjasondavid-eng.github.io/conc-kitchen-hub/?week=2&day=FRIDAY':pathToFileURL(htmlPath).href;
  await page.goto(url);
  await page.waitForFunction(h=>h?typeof loadScheduleData==='function':typeof _mirrorDoorMenuBeforePublish==='function',isHub,{timeout:30000});
  async function refresh() {
    await page.evaluate(h=>{
      if(h){if(typeof _hubDoorMenuFetchedAtMs!=='undefined')_hubDoorMenuFetchedAtMs=0;window.__f4Refresh=Promise.resolve(loadScheduleData());}
      else window.__f4Refresh=Promise.resolve(_mirrorDoorMenuBeforePublish());
      window.__f4RefreshDone=false;window.__f4Refresh.finally(()=>window.__f4RefreshDone=true);
    },isHub);
  }
  async function read(now=NOW,service=SERVICE){return page.evaluate(({h,service,now})=>{
    const fn=h?window.hubServiceRouting:window.expoServiceRouting;
    return typeof fn==='function'?fn(service,now):{status:'missing-product-accessor',counts:null};
  },{h:isHub,service,now});}
  async function settle(expected){
    try {await page.waitForFunction(({h,n,service,now})=>{
      const fn=h?window.hubServiceRouting:window.expoServiceRouting;
      return typeof fn==='function'&&fn(service,now)?.counts?.Regular===n;
    },{h:isHub,n:expected,service:SERVICE,now:NOW},{timeout:3000});}catch{}
  }
  await refresh();await settle(148);const first=await read();
  check('R1 boot/current refresh certifies coherent synthetic148',first.status==='valid'&&first.counts.Regular===148,first);
  check('R2 actual refresh obtains routing and authoritative registry',seen.includes('routing_by_meal.json')&&seen.includes('registry_summary.json'),[...new Set(seen)]);

  const start=seen.length;current=clone(B);holdRouting=true;await refresh();
  try {await page.waitForFunction(()=>window.__f4Fetch.some(x=>/registry_summary\.json/.test(x.url)),null,{timeout:3000});}catch{}
  // Observe a later registry response while its corresponding routing response remains in flight.
  try {await page.waitForFunction(({h,service,now})=>{
    const fn=h?window.hubServiceRouting:window.expoServiceRouting;return typeof fn==='function'&&fn(service,now)?.status==='unavailable';
  },{h:isHub,service:SERVICE,now:NOW},{timeout:3000});}catch{}
  const pending=await read();
  check('R3 roster-only receipt invalidates old148 before delayed routing',pending.status==='unavailable'&&pending.counts===null,pending);
  check('R4 prepublish/focus path actually refetches registry and routing',seen.slice(start).includes('registry_summary.json')&&seen.slice(start).includes('routing_by_meal.json'),seen.slice(start));
  holdRouting=false;routingReleases.splice(0).forEach(release=>release());await settle(142);const second=await read();
  check('R5 roster-only refresh recovers142 without menu words or schedule version changing',second.status==='valid'&&second.counts.Regular===142,second);

  // Reverse the order: the new routing receipt is authoritative even when all companions are stale.
  current={...clone(B),routing:clone(C.routing)};await refresh();
  try {await page.waitForFunction(()=>window.__f4RefreshDone===true,null,{timeout:3000});}catch{}
  try {await page.waitForFunction(({h,service,now})=>{
    const fn=h?window.hubServiceRouting:window.expoServiceRouting;return typeof fn==='function'&&fn(service,now)?.status==='unavailable';
  },{h:isHub,service:SERVICE,now:NOW},{timeout:3000});}catch{}
  const mixed=await read();check('R6 routing-first newer occurrence invalidates B before mixed-set rejection',mixed.status==='unavailable'&&mixed.counts===null,mixed);
  current=clone(C);await refresh();await settle(140);const third=await read();
  check('R7 matching C recovers automatically after routing-first partial refresh',third.status==='valid'&&third.counts.Regular===140,third);
  const expired=await read(NOW+MAX_AGE+1);check('R8 time of use enforces offline cache bound',expired.status==='unavailable'&&expired.counts===null,expired);

  const reads=await page.evaluate(()=>window.__f4Fetch.filter(x=>/conc-kitchen-door\/(menu_current|menu_overlay|routing_by_meal|registry_summary|meal_swaps|meal_swaps_reverted|special_meals|special_meals_removed)\.json/.test(x.url)));
  for(const name of ['routing_by_meal.json','registry_summary.json','meal_swaps.json','meal_swaps_reverted.json','special_meals.json','special_meals_removed.json']) {
    const r=reads.filter(x=>new URL(x.url).pathname.endsWith('/'+name));
    check('R9 complete fresh-set reads '+name,r.length>0,r.length);
    check('R10 cache-bust and no-store '+name,r.length>0&&r.every(x=>new URL(x.url).search.length>1&&x.cache==='no-store'),r.slice(-2));
  }
  check('R11 actual board remains readable during invalidity',(await page.locator('body').innerText()).trim().length>100);
  check('R12 no browser runtime errors',errors.length===0,errors);
} finally {await browser.close();}
console.log(`menu_flow_f4_refresh_browser (${isHub?'HUB':'EXPO'}): ${pass} passed, ${fail} failed`);process.exitCode=fail?1:0;
