// Current service stays unchanged when new canonical Library dishes arrive.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';import {isDeepStrictEqual} from 'node:util';import {createHash} from 'node:crypto';
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/manual_alt_lookup_2026-11-17.json','utf8'));
const files=Object.fromEntries(fs.readdirSync('.').filter(n=>n.endsWith('.json')).map(n=>[n,JSON.parse(fs.readFileSync(n,'utf8'))]));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'door-library-boundary-')),old=path.join(tmp,'baseline.html');
fs.writeFileSync(old,execFileSync('git',['show','08f1dd59:index.html'],{maxBuffer:8*1024*1024}));
const harnesses=[];let checks=0;const check=(label,value)=>{assert.ok(value,label);checks++;console.log('PASS '+label);};
const storage={concAltFlagSweepV1:'done',concOperatorName:'QA only',concRegistryProvenance:files['door_state.json']._meta.registryModifiedAt,
 concLastImportDate:files['door_state.json'].lastImportDate,concLastImportFile:files['door_state.json'].lastImportFile,concLastImportCount:String(files['door_state.json'].lastImportCount),
 concRecentLog:JSON.stringify(files['recent_log.json']),concLearnedNR:JSON.stringify(files['learned_nr.json']),concCustomTagRules:JSON.stringify(files['custom_tag_rules.json'])};
async function boot(file,tag,mode,additions) {
 process.env.HOUSE_FLOW_HTML=file;const {harness}=await import('./menu_flow_f6_harness.mjs?boundary='+tag);
 const h=await harness();harnesses.push(h);const b=await h.boot(structuredClone(files),{storage});
 await b.page.clock.pauseAt(new Date('2026-11-17T12:00:00Z'));
 await b.page.evaluate(({fixture,mode,additions})=>{
  _doorRecipeBase=mode==='fallback'?DOOR_RECIPE_DATA_FALLBACK:fixture.base;_recipeDataSource=mode;
  if(mode==='cached')localStorage.setItem('door_recipe_data_cache',JSON.stringify(fixture.base));
  _doorSharedLibrary={...fixture.library,recipes:fixture.library.recipes.concat(additions?fixture.additions:[])};
  _doorSharedLibrarySource=mode;_doorApplySharedRecipes();
  window.XLSX={utils:{aoa_to_sheet:()=>({}),encode_cell:({r,c})=>String.fromCharCode(65+c)+(r+1),encode_range:({s,e})=>String.fromCharCode(65+s.c)+(s.r+1)+':'+String.fromCharCode(65+e.c)+(e.r+1)}};
 },{fixture,mode,additions});
 if(process.env.LIBRARY_BOUNDARY_LIB_DIR)await b.page.addScriptTag({path:path.resolve(process.env.LIBRARY_BOUNDARY_LIB_DIR,'xlsx.bundle.min.js')});
 return {h,b};
}
async function snapshot(b) {
 return b.page.evaluate(()=>{
  const slots=[];
  for(const w of [1,2,3,4])for(const d of ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'])for(const p of ['breakfast','lunch','dinner']) {
   const pd=computePlatingData(p,w,d);let sheet;try{sheet=buildDaySheet(p,w,d,pd);}catch(e){sheet={unavailable:e.message};}
   slots.push({w,d,p,html:buildPlatingHtml(pd,false),sheet,members:pd.sections.map(s=>({key:s.rule.key,rooms:s.residents.map(r=>r.room)})),anaph:pd.anaphSect});
  }
  return {slots,menu:buildMenuJSON(),routing:buildRoutingByMealJSON(),registry:buildStateJSON()};
 });
}
try {
 for(const mode of ['live','cached','fallback']) {
  const a=await boot(old,mode+'-old',mode,false),before=await snapshot(a.b);
  const b=await boot(path.resolve('index.html'),mode+'-guard',mode,false);
  // 2026-11-19 (call 4, Jason: "Follow lean"): No Dairy residents on a dairy-yoghurt breakfast now read "dairy-free: vegan
  // yoghurt". That note is the one intended change since the baseline; it is compared on its own, then switched off here.
  // 2026-11-20 (U3 S1 data, Jason: "We'll move forward with the notes in"): the published residents now carry breakfast
  // notes, which the baseline build does not print. They are their own gates' (breakfast_note_s1, u3_breakfast_notes_data);
  // switched off first, so the yoghurt comparison and the baseline comparison still read every other byte.
  // 2026-11-20 (publication 47, Jason: "Follow lean"): the halal section notes read the halal dish box
 // (_halalDishFlags), which the baseline build does not; tests/halal_dish_box_gate.mjs owns that note, switched off here.
 await b.b.page.evaluate(()=>{window.doorBreakfastNoteText=()=>'';window.doorPlatingBreakfastNotes=()=>({});const pf=window.doorPlateFacts;window.doorPlateFacts=(...a)=>{const f=pf(...a);if(f&&f.mealFlags)delete f.mealFlags._halalDishFlags;return f;};});
  const withSwap=await snapshot(b.b);
  await b.b.page.evaluate(()=>{window.doorYoghurtSwapFor=()=>false;});
  const guard=await snapshot(b.b);
  const moved=withSwap.slots.filter((s,i)=>!isDeepStrictEqual(s,guard.slots[i]));
  check(mode+': the yoghurt note changes breakfast sheets only, and only by naming the vegan yoghurt',moved.length>0&&moved.every(s=>s.p==='breakfast'&&/vegan yoghurt/.test(JSON.stringify(s)))
    &&isDeepStrictEqual(withSwap.menu,guard.menu)&&isDeepStrictEqual(withSwap.routing,guard.routing)&&isDeepStrictEqual(withSwap.registry,guard.registry));
  check(mode+': guard alone preserves all 84 sheet HTML/worksheet objects, notes, memberships, roles and routing',isDeepStrictEqual(before,guard));
  await b.b.page.evaluate(additions=>{_doorSharedLibrary.recipes.push(...additions);_doorApplySharedRecipes();},fixture.additions);
  const after=await snapshot(b.b);
  check(mode+': all nine additions preserve current sheets, menu, registry and routing',isDeepStrictEqual(before,after));
  const identity=await b.b.page.evaluate(()=>{
   const plain=getVegAltAllergenStr('Green Beans'),full=getVegAltAllergenStr('Plain Cauliflower and Green Beans');
   const linked=getVegAltSlotAllergenStr({veganalt:{recipeId:'plain-cauliflower-and-green-beans',recipeName:'Plain Cauliflower and Green Beans',flags:{}}});
   const peas=getVegAltAllergenStr('Peas, Carrots and Onions (Plain)');
   return {plain,full,linked,peas};
  });
  check(mode+': unlinked Green Beans never borrows cauliflower, while exact and linked selections retain both facts',!identity.plain.includes('BRASSICAS')&&identity.full.includes('BRASSICAS')&&identity.full.includes('BEANS')&&identity.linked.includes('BRASSICAS')&&identity.linked.includes('BEANS')&&identity.peas.includes('BEANS'));
  if(mode==='live') {
   await a.b.publish();await b.b.publish();
   const left=a.b.remote.files,right=b.b.remote.files;
   check('actual coherent publication preserves legacy counts/components and F4 rotations/dated counts',isDeepStrictEqual(left['routing_by_meal.json'].routing,right['routing_by_meal.json'].routing)&&isDeepStrictEqual(left['routing_by_meal.json'].flow.rotation,right['routing_by_meal.json'].flow.rotation)&&isDeepStrictEqual(left['routing_by_meal.json'].flow.dated,right['routing_by_meal.json'].flow.dated));
   check('publication preserves all resident and anaphylactic records',isDeepStrictEqual(left['door_state.json'].residents,right['door_state.json'].residents)&&isDeepStrictEqual(left['door_state.json'].anaphRooms,right['door_state.json'].anaphRooms));
   const replay=await b.h.boot(structuredClone(right),{storage});
   await replay.page.evaluate(fixture=>{_doorRecipeBase=fixture.base;_doorSharedLibrary={...fixture.library,recipes:fixture.library.recipes.concat(fixture.additions)};_doorApplySharedRecipes();},fixture);
   const replayCounts=await replay.page.evaluate(()=>buildRoutingByMealJSON().routing);
   check('another-device replay retains the same routing with all nine recipes available',isDeepStrictEqual(replayCounts,right['routing_by_meal.json'].routing)&&!replay.errors.length);
  }
  check(mode+': no uncaught browser errors',!a.b.errors.length&&!b.b.errors.length);
 }
 if(process.env.LIBRARY_BOUNDARY_RECEIPT)fs.writeFileSync(process.env.LIBRARY_BOUNDARY_RECEIPT,JSON.stringify({asOf:new Date().toISOString(),baseline:'08f1dd59b7e2f7112afa79fbe9fabbf4afccfdc0',sourceSha256:createHash('sha256').update(fs.readFileSync('index.html')).digest('hex'),checks,
  currentServices:84,modes:['live','cached','fallback'],guardAloneUnchanged:true,guardAndAdditionsUnchanged:true,legacyAndF4CountsUnchanged:true,
  worksheetMode:process.env.LIBRARY_BOUNDARY_LIB_DIR?'Real pinned XLSX library':'Actual builder, coordinate utility adapter',codex:fixture.provenance},null,2)+'\n');
 console.log(checks+' Library recipe-boundary browser checks passed');
}finally{for(const h of harnesses)await h.close();fs.rmSync(old);fs.rmdirSync(tmp);}
