// Actual file:// renderer/builders; controlled meal and resident fixtures, no credentials or live API writes.
// Set DOOR_PLATING_LIB_DIR to pinned app JSZip/XLSX scripts for saved-workbook serialization proof.
import {chromium} from 'playwright';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url), libs=process.env.DOOR_PLATING_LIB_DIR;
const menu={}; for(const w of [1,2,3,4]) { menu[w]={}; for(const d of ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY']) {
  const day=menu[w][d]={}; for(const p of ['breakfast','lunch','dinner']) Object.assign(day,{[p]:'Plain Rice',[p+'_mainItem']:'Plain Rice',[p+'_sides']:'',[p+'_veg']:'Plain Rice',[p+'_flags']:{}});
} }
Object.assign(menu[1].MONDAY,{dinner:'Coconut Fish Curry',dinner_mainItem:'Coconut Fish Curry',dinner_flags:{hasCoconut:true,hasFish:true}});
const state={residents:[{room:'213a',isAnaph:false,anaphTags:['noCoconut'],tags:['Soft Meals','No Coconut','No Corn'],rawRestriction:'Soft Meals, No Coconut, No Corn',section:'Soft Meals'},
  {room:'213b',tags:['Regular'],rawRestriction:'Regular',section:'Regular'}],anaphRooms:['213a']};
let pass=0; const check=(label,condition)=>{assert.ok(condition,label);pass++;console.log('PASS '+label);};
const browser=await chromium.launch({headless:true});
try { for(const theme of ['light','dark']) {
  const page=await browser.newPage({timezoneId:'America/Toronto'}),errors=[],alerts=[];
  page.on('pageerror',e=>errors.push(e.message)); page.on('dialog',async d=>{alerts.push(d.message());await d.accept();});
  await page.route(/^https?:/,route=>{
    const url=route.request().url();
    if(libs&&url.includes('xlsx-js-style@1.2.0'))return route.fulfill({body:readFileSync(resolve(libs,'xlsx.bundle.min.js'),'utf8'),contentType:'application/javascript'});
    if(libs&&url.includes('jszip/3.10.1'))return route.fulfill({body:readFileSync(resolve(libs,'jszip.min.js'),'utf8'),contentType:'application/javascript'});
    return route.abort();
  });
  await page.clock.install({time:new Date('2026-11-17T09:00:00-05:00')});
  await page.addInitScript(({menu,state,theme})=>{
    localStorage.clear(); localStorage.setItem('concUploadedMenu',JSON.stringify(menu));localStorage.setItem('concMenuBase','{}');
    localStorage.setItem('concRegistryState',JSON.stringify(state));localStorage.setItem('conc-door-anaph',JSON.stringify(state.anaphRooms));localStorage.setItem('concAltFlagSweepV1','1');
    if(theme==='dark')localStorage.setItem('kdo-dark','1'); window.Chart=function(){return{destroy(){},update(){}};};
  },{menu,state,theme});
  await page.goto(new URL('index.html',root).href);await page.clock.runFor(5000);
  const initial=await page.evaluate(()=>{
    psWhen='browse';psWeek=1;psDay='MONDAY';psPeriod='dinner';showScreen('plating');
    const pd=computePlatingData('dinner',1,'MONDAY'),a=doorAssessAnaphAlternative(pd);
    return {a,html:document.getElementById('ps-preview').innerHTML};
  });
  check(theme+' listed-only resident and roommate are contained',initial.a.state==='missing'&&JSON.stringify(initial.a.rooms)===JSON.stringify(['213a','213b']));
  check(theme+' actual preview is an explicit draft',initial.html.includes('DRAFT / NOT FOR SERVICE')&&initial.html.includes('UNRESOLVED')&&!initial.html.includes('Coconut Fish Curry — prepared separately'));
  await page.emulateMedia({media:'print'});
  check(theme+' draft warning is visible with print media',await page.getByText(/DRAFT \/ NOT FOR SERVICE — Separate anaphylactic/).isVisible());
  await page.emulateMedia({media:'screen'});
  await page.evaluate(()=>downloadPlatingSheet('blocked.xlsx','dinner',1));
  check(theme+' download explains the exact unresolved service',alerts.some(x=>/W1 MONDAY dinner.*213a, 213b/.test(x)));
  const ready=await page.evaluate(()=>{
    const overlay={...loadMenuBaseOverlay(),'1':{MONDAY:{...getMenuData()['1'].MONDAY,dinner_anaphAlt:'Basa, Plain Rice, Stir-fry Vegetables'}}};
    localStorage.setItem('concMenuBase',JSON.stringify(doorStampOverlayEdits(loadMenuBaseOverlay(),overlay,Date.now())));
    renderPlatingPreview();const pd=computePlatingData('dinner',1,'MONDAY');
    const before=JSON.stringify({r:REGISTRY_LIST,a:anaphRooms});
    changesQueue=[{type:'switch',room:'213a',route:'→ 214a'}];
    const projected=doorProjectRegistryQueue(changesQueue),projection=doorPlatingReadiness([{period:'dinner',week:1,day:'MONDAY'}],projected);
    changesQueue=[];
    return {state:doorAssessAnaphAlternative(pd).state,html:document.getElementById('ps-preview').innerHTML,
      rooms:projection.sheets[0].pd.anaphSect.map(r=>r.room),unchanged:before===JSON.stringify({r:REGISTRY_LIST,a:anaphRooms})};
  });
  check(theme+' named plate replaces fallback without claiming verification',ready.state==='named'&&ready.html.includes('Basa, Plain Rice, Stir-fry Vegetables — prepared separately')&&!ready.html.includes('DRAFT / NOT FOR SERVICE'));
  check(theme+' projected move changes containment without live mutation',ready.unchanged&&JSON.stringify(ready.rooms)===JSON.stringify(['214a']));
  if(libs) {
    const bytes=await page.evaluate(()=>Array.from(new Uint8Array(XLSX.write(buildPlatingXlsx('dinner',1),{bookType:'xlsx',type:'array'}))));
    const out=resolve(libs,'a1-'+theme+'-named.xlsx');writeFileSync(out,Buffer.from(bytes));
    const decoded=await page.evaluate(bytes=>{const wb=XLSX.read(new Uint8Array(bytes),{type:'array'});return {n:wb.SheetNames.length,values:wb.SheetNames.flatMap(n=>Object.values(wb.Sheets[n]).filter(c=>c&&c.v!==undefined).map(c=>String(c.v)))};},bytes);
    check(theme+' saved XLSX round trip retains all seven days and exact named separate plate',decoded.n===7&&decoded.values.some(v=>v.includes('Basa, Plain Rice, Stir-fry Vegetables — prepared separately')));
  }
  const failed=await page.evaluate(()=>{
    computePlatingData=()=>{throw new Error('synthetic assessment failure');};window.dispatchEvent(new Event('beforeprint'));
    return {html:document.getElementById('ps-preview').innerHTML,header:document.getElementById('ps-print-header').textContent};
  });
  check(theme+' Ctrl+P after assessment failure replaces stale ready content',failed.html.includes('DRAFT / NOT FOR SERVICE')&&failed.html.includes('could not be assessed')&&!failed.html.includes('Basa, Plain Rice')&&failed.header==='DRAFT / NOT FOR SERVICE');
  await page.emulateMedia({media:'print'});
  check(theme+' assessment-failure warning survives print CSS',await page.getByText(/DRAFT \/ NOT FOR SERVICE — This meal could not be assessed/).isVisible());
  check(theme+' no uncaught page errors',errors.length===0);
  await page.close();
} } finally {await browser.close();}
console.log(pass+' browser assertions passed'+(libs?' (real saved XLSX verified)':' (set DOOR_PLATING_LIB_DIR for serialization check)'));
