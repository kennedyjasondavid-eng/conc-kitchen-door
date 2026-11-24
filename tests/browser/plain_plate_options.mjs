// Opt-in editor options must leave the entire saved manual-equivalent baseline intact.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=process.cwd();
let fixture=JSON.parse(fs.readFileSync('tests/fixtures/plain_plate_roster_2026-11-17.json','utf8'));
if(process.env.PLAIN_ALT_CATALOG_DIR) {
 const dir=process.env.PLAIN_ALT_CATALOG_DIR,bytes=fs.readFileSync(path.join(dir,'current-library_public.json'));
 const provenance=JSON.parse(fs.readFileSync(path.join(dir,'current-pages_provenance.json'),'utf8'));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),provenance.sharedLibrary.sha256);
 fixture={...JSON.parse(bytes),provenance,base:JSON.parse(fs.readFileSync(path.join(dir,'current-DOOR_RECIPE_DATA.json'),'utf8'))};
}
const files=Object.fromEntries(fs.readdirSync(root).filter(n=>n.endsWith('.json')).map(n=>[n,JSON.parse(fs.readFileSync(n,'utf8'))]));
const baseline='908f487f';
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'door-plain-options-'));
const originalPath=path.join(temporary,'baseline.html');
fs.writeFileSync(originalPath,execFileSync('git',['show',baseline+':index.html'],{maxBuffer:8*1024*1024}));
let checks=0;const check=(name,value)=>{assert.ok(value,name);checks++;console.log('PASS '+name);};
const storage={concAltFlagSweepV1:'done',concOperatorName:'QA only',concRegistryProvenance:files['door_state.json']._meta.registryModifiedAt,
 concLastImportDate:files['door_state.json'].lastImportDate,concLastImportFile:files['door_state.json'].lastImportFile,concLastImportCount:String(files['door_state.json'].lastImportCount),
 concRecentLog:JSON.stringify(files['recent_log.json']),concLearnedNR:JSON.stringify(files['learned_nr.json']),concCustomTagRules:JSON.stringify(files['custom_tag_rules.json'])};
async function boot(html,tag) {
 process.env.HOUSE_FLOW_HTML=html;
 const {harness}=await import('./menu_flow_f6_harness.mjs?plain-options='+tag);
 const h=await harness(),b=await h.boot(structuredClone(files),{storage});
 // 2026-11-18 re-pin: the gate edits the live menu, so its clock must be later than every stamped day in the
 // kitchen overlay (newest edit wins). A fixed Nov 17 clock lost to the Nov 18 publications 25 and 26.
 const stamps=Object.values((files['menu_overlay.json']&&files['menu_overlay.json']._meta&&files['menu_overlay.json']._meta.dayEditedAt)||{}).map(Number).filter(Number.isFinite);
 await b.page.clock.pauseAt(new Date(Math.max(Date.parse('2026-11-17T12:00:00.000Z'),...stamps.map(t=>t+3600000))));
 await b.page.evaluate(fixture=>{
  if(fixture.base){_doorRecipeBase=fixture.base;_recipeDataSource='captured-live';}
  _doorSharedLibrary={_meta:{version:1},recipes:fixture.recipes};_doorSharedLibrarySource='test-fixture';_doorApplySharedRecipes();
  // Real worksheet builder, minimal coordinate utilities; optional pinned XLSX below verifies serialization too.
  window.XLSX={utils:{aoa_to_sheet:()=>({}),encode_cell:({r,c})=>String.fromCharCode(65+c)+(r+1),encode_range:({s,e})=>String.fromCharCode(65+s.c)+(s.r+1)+':'+String.fromCharCode(65+e.c)+(e.r+1)}};
 },fixture);
 if(process.env.PLAIN_ALT_LIB_DIR)await b.page.addScriptTag({path:path.resolve(process.env.PLAIN_ALT_LIB_DIR,'xlsx.bundle.min.js')});
 return {h,b};
}
async function snapshot(b) {
 return b.page.evaluate(()=>{
  const sheets=[];
  for(const week of [1,2,3,4])for(const day of ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'])for(const period of ['breakfast','lunch','dinner']) {
   const pd=computePlatingData(period,week,day);let worksheet;
   try{worksheet=buildDaySheet(period,week,day,pd);}catch(e){worksheet={unavailable:e.message};}
   sheets.push({week,day,period,preview:buildPlatingHtml(pd,false),worksheet,
    memberships:pd.sections.map(s=>({key:s.rule.key,rooms:s.residents.map(r=>r.room)})),anaph:pd.anaphSect.map(r=>({room:r.room,role:r._role}))});
  }
  return {sheets,routing:buildRoutingByMealJSON(),menu:buildMenuJSON(),state:buildStateJSON()};
 });
}
let old,current;
try {
 old=await boot(originalPath,'old');
 // 2026-11-20 (Jason: the no turkey note is noise): the current build names No Turkey nowhere; the baseline build's
 // No Turkey row is taken out here so both read the same.
 await old.b.page.evaluate(()=>{const i=CONFLICT_MAP.findIndex(r=>r.residentTag==='No Turkey');if(i>=0)CONFLICT_MAP.splice(i,1);delete RESIDENT_TO_MEAL_FLAG['No Turkey'];});
 const before=await snapshot(old.b);
 await old.b.publish();const oldPublished=structuredClone(old.b.remote.files);
 current=await boot(path.resolve('index.html'),'new');
 // 2026-11-19 (call 4, Jason: "Follow lean"): the "dairy-free: vegan yoghurt" breakfast note is the one intended sheet
 // change since the baseline; it is compared on its own, then switched off for the identity check below.
 // 2026-11-20 (U3 S1 data, Jason: "We'll move forward with the notes in"): the published residents now carry breakfast
 // notes, which the baseline build does not print. They are their own gates' (breakfast_note_s1, u3_breakfast_notes_data);
 // switched off first, so the yoghurt comparison and the identity checks still read every other byte.
 // 2026-11-20 (publication 47, Jason: "Follow lean"): the halal section notes read the halal dish box
 // (_halalDishFlags), which the baseline build does not; tests/halal_dish_box_gate.mjs owns that note, switched off here.
 // 2026-11-22 (compliance C1): the normaliser documents room 801 for No Spicy from its May 3 resolution (its one intended change on today's list, owned by tests/compliance_docs_c1_gate.mjs 11); that record is put back first.
 // 2026-11-24: the Nov 23 publish stored 801's documented answer, so the put-back now restores each such record's
 // documentation fields to exactly what door_state.json holds (it used to assume the undocumented May record).
 await current.b.page.evaluate(orig=>{const by=Object.fromEntries(orig.map(o=>[o.room,o]));REGISTRY_LIST.forEach(r=>{if(!r._docsResolvedSig)return;const o=by[r.room]||{};for(const k of ['docs','_docsResolvedSig','confirm','confirmBy']){if(k in o)r[k]=JSON.parse(JSON.stringify(o[k]));else delete r[k];}});},files['door_state.json'].residents);
 // 2026-11-22 (v31-standard.140, No Pork is self-declared): No Pork rooms that now read Confirmed get their stored status back.
 await current.b.page.evaluate(orig=>{const by=Object.fromEntries(orig.map(o=>[o.room,o]));REGISTRY_LIST.forEach(r=>{const o=by[r.room];if(o&&(r.tags||[]).includes('No Pork')&&r.confirm!==o.confirm){r.confirm=o.confirm;r.confirmBy=o.confirmBy;}});},files['door_state.json'].residents);
 await current.b.page.evaluate(()=>{window.doorBreakfastNoteText=()=>'';window.doorPlatingBreakfastNotes=()=>({});const pf=window.doorPlateFacts;window.doorPlateFacts=(...a)=>{const f=pf(...a);if(f&&f.mealFlags)delete f.mealFlags._halalDishFlags;return f;};});
 const withSwap=await snapshot(current.b);
 await current.b.page.evaluate(()=>{window.doorYoghurtSwapFor=()=>false;});
 const after=await snapshot(current.b);
 const movedSheets=withSwap.sheets.filter((s,i)=>JSON.stringify(s)!==JSON.stringify(after.sheets[i]));
 check('the yoghurt note changes breakfast sheets only, and only by naming the vegan yoghurt',movedSheets.length>0&&movedSheets.every(s=>s.period==='breakfast'&&/vegan yoghurt/.test(JSON.stringify(s)))
  &&JSON.stringify(withSwap.routing)===JSON.stringify(after.routing)&&JSON.stringify(withSwap.menu)===JSON.stringify(after.menu)&&JSON.stringify(withSwap.state)===JSON.stringify(after.state));
 check('all 84 saved previews, worksheet cells/styles, memberships and anaphylactic roles are identical',JSON.stringify(before.sheets)===JSON.stringify(after.sheets));
 check('current menu, registry, imports and routing are unchanged before any selection',JSON.stringify(before.menu)===JSON.stringify(after.menu)&&JSON.stringify(before.state)===JSON.stringify(after.state)&&JSON.stringify(before.routing)===JSON.stringify(after.routing));
 await current.b.publish();
 check('normal coherent publication including F4 is identical with no opt-in changes',JSON.stringify(oldPublished)===JSON.stringify(current.b.remote.files));
 for(const b of [old.b,current.b])await b.page.evaluate(()=>{window.__savedOptionRecipes=DOOR_RECIPE_DATA;DOOR_RECIPE_DATA=[];});
 const missingOld=await snapshot(old.b),missingNew=await snapshot(current.b);
 check('all saved sheets and routing also remain identical with recipe data unavailable',JSON.stringify(missingOld)===JSON.stringify(missingNew));
 for(const b of [old.b,current.b])await b.page.evaluate(()=>{DOOR_RECIPE_DATA=window.__savedOptionRecipes;delete window.__savedOptionRecipes;});
 const page=current.b.page;
 // Gate-author interaction amendment (2026-11-17): Close now protects a dirty draft.
 // Restore the real dialog (the conflict-save probe stubs doorAsk), choose Discard,
 // and wait for closure before the original unchanged-sheet/reopen assertions.
 await page.evaluate(()=>{window.__plainOptionsRealDoorAsk=doorAsk;});
 const closeDiscardingDraft=async()=>{
  await page.evaluate(()=>{window.__plainOptionsPriorDoorAsk=doorAsk;doorAsk=window.__plainOptionsRealDoorAsk;closeMenuEdit();});
  try {
   const question=page.locator('.door-ask');
   if(await question.count()){
    assert.match(await question.innerText(),/Save menu changes/,'Close should offer the dirty-draft decision');
    await question.getByRole('button',{name:'Discard changes',exact:true}).click();
   }
   await page.locator('#mc-menu-edit-panel').waitFor({state:'hidden'});
  } finally {
   await page.evaluate(()=>{doorAsk=window.__plainOptionsPriorDoorAsk;});
  }
 };
 // Re-pinned 2026-11-19 (Edit Menu redesign S8): a plate the meal does not have is added with "+ Add a plate for".
 await page.evaluate(()=>{showScreen('menu-config');openMenuEdit(1,'MONDAY','lunch');if(typeof doorAddPlateRow==='function')doorAddPlateRow('gfAlt');});
 const closedBefore=await page.evaluate(()=>JSON.stringify({overlay:loadMenuBaseOverlay(),registry:buildStateJSON().residents}));
 const options=page.locator('select[aria-label="Choose a plain plate for Gluten free"]');
 check('restriction-specific editor offers nine available plates with no default choice',await options.locator('option:not([disabled])').count()===10&&await options.inputValue()==='');
 await options.selectOption('basa-yams');
 check('explicit selection fills only the draft requirement field',await page.locator('#mc-kalt-gfAlt').inputValue()==='Plain Basa, Plain Roasted Yams, Plain Carrot and Zucchini');
 check('draft selection does not persist or publish',closedBefore===await page.evaluate(()=>JSON.stringify({overlay:loadMenuBaseOverlay(),registry:buildStateJSON().residents})));
 check('feedback shows recipients, recipe facts and retained instructions',/\d+ residents? gets? this plate/.test(await page.locator('#door-alt-feedback-gfAlt').innerText())&&/Contains:.*FISH/i.test(await page.locator('#door-alt-feedback-gfAlt').innerText()));
 await page.evaluate(()=>{doorAsk=async()=>true;});
 await page.evaluate(()=>saveMenuEdit());
 check('known fish conflict on a newly chosen plate blocks Save and preserves the draft',await page.locator('#door-alt-save-issue').isVisible()&&/613a.*No Fish/.test(await page.locator('#door-alt-save-issue').innerText())&&await page.locator('#mc-kalt-gfAlt').inputValue()==='Plain Basa, Plain Roasted Yams, Plain Carrot and Zucchini');
 check('blocked new selection changes no saved meal or registry',closedBefore===await page.evaluate(()=>JSON.stringify({overlay:loadMenuBaseOverlay(),registry:buildStateJSON().residents})));
 await page.evaluate(()=>toggleDarkMode());
 check('dark-mode toggle retains draft choice and conflict feedback',await page.locator('#mc-kalt-gfAlt').inputValue()==='Plain Basa, Plain Roasted Yams, Plain Carrot and Zucchini'&&/613a.*No Fish/.test(await page.locator('#door-alt-save-issue').innerText()));
 if(process.env.PLAIN_ALT_SCREEN_DIR) {
  fs.mkdirSync(process.env.PLAIN_ALT_SCREEN_DIR,{recursive:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('#mc-kitchen-alts').screenshot({path:path.join(process.env.PLAIN_ALT_SCREEN_DIR,'restriction-alternatives-dark.png'),style:'.topbar, .topbar * { visibility:hidden !important; }'});
 }
 await page.evaluate(()=>toggleDarkMode());
 if(process.env.PLAIN_ALT_SCREEN_DIR)await page.locator('#mc-kitchen-alts').screenshot({path:path.join(process.env.PLAIN_ALT_SCREEN_DIR,'restriction-alternatives.png'),style:'.topbar, .topbar * { visibility:hidden !important; }'});
 await closeDiscardingDraft();
 check('cancel leaves every saved sheet and flow input unchanged',JSON.stringify((await snapshot(current.b)).sheets)===JSON.stringify(after.sheets));
 await page.evaluate(()=>openMenuEdit(1,'MONDAY','lunch'));
 check('reopen retains the saved original plate after cancellation',!(await page.locator('#mc-kalt-gfAlt').inputValue()).includes('Plain Basa'));
 await closeDiscardingDraft();
 await page.evaluate(()=>openMenuEdit(1,'MONDAY','breakfast'));
 check('breakfast editor has no new plain-plate choices',await page.locator('select[aria-label^="Choose a plain plate"]').count()===0);
 await closeDiscardingDraft();
 await page.evaluate(()=>{openMenuEdit(1,'MONDAY','lunch');doorUsePlainPlate('gfAlt','chicken-yams');doorAsk=async()=>true;});
 await page.evaluate(()=>saveMenuEdit());
 check('normal Save Edit persists the explicitly selected complete plate',await page.evaluate(()=>getMenuData()['1'].MONDAY.lunch_gfAlt)==='Plain Chicken Leg, Plain Roasted Yams, Plain Carrot and Zucchini');
 await page.evaluate(()=>openMenuEdit(1,'MONDAY','lunch'));
 check('saved selection survives editor reopen',await page.locator('#mc-kalt-gfAlt').inputValue()==='Plain Chicken Leg, Plain Roasted Yams, Plain Carrot and Zucchini');
 await closeDiscardingDraft();
 await current.b.publish();const candidate=structuredClone(current.b.remote.files);
 check('opt-in publication preserves every resident and anaphylactic record',JSON.stringify(candidate['door_state.json'].residents)===JSON.stringify(files['door_state.json'].residents)&&JSON.stringify(candidate['door_state.json'].anaphRooms)===JSON.stringify(files['door_state.json'].anaphRooms));
 const replay=await current.h.boot(candidate,{storage});
 const replayResult=await replay.page.evaluate(()=>{const pd=computePlatingData('lunch',1,'MONDAY');return {text:pd.ctx._gfAlt,html:buildPlatingHtml(pd,false),components:buildRoutingByMealJSON().routing['1'].MONDAY.lunch._components};});
 check('another device uses the exact saved plate on sheets and component counts',replayResult.text==='Plain Chicken Leg, Plain Roasted Yams, Plain Carrot and Zucchini'&&replayResult.html.includes(replayResult.text)&&replayResult.components['Plain Roasted Yams']>=4&&replayResult.components['Plain Carrot and Zucchini']>=4);
 const allocationProof=await page.evaluate(()=>{
  const original=computePlatingData,base=original('lunch',1,'MONDAY'),results=[];
  const cases=[['gf','gf_alt','_gfAlt'],['diabetic','diabetic_alt','diabeticAlt'],['no_egg','modified_main','noEggAlt'],
   ['no_dairy','nodairy_alt','noDairyAlt'],['bland','bland_alt','blandAlt'],['soft','soft','softAlt'],['no_processed','noproc_alt','softAlt']];
  try {
   for(const plate of doorPlainPlateRoster())for(const [key,altType,field]of cases) {
    const s={rule:{key,label:key,altType},residents:[{room:'qa-1',tags:[]},{room:'qa-2',tags:[]}]};
    const pd={...base,periodLabel:'Lunch',anaphSect:[],sections:[s],ctx:{mealName:'Main Dish, Original Side',altMeals:[],[field]:plate.text}};
    computePlatingData=()=>pd;
    const legacy=buildRoutingByMealJSON().routing['1'].SUNDAY.lunch._components,flow=doorFlowRoutingSlot({},1,'SUNDAY','lunch',null);
    const expected=Object.fromEntries(doorTurnkeyPlateParts(plate.text).map(n=>[n,2]));
    results.push({plate:plate.id,key,equal:JSON.stringify(legacy)===JSON.stringify(expected)&&JSON.stringify(flow.counts?._components)===JSON.stringify(expected),
     label:doorSectionAllergenStr(s,pd)});
   }
   const a=doorPlainPlateRoster().find(p=>p.id==='chicken-rice'),b=doorPlainPlateRoster().find(p=>p.id==='basa-yams');
   const s={rule:{key:'soft',label:'Soft Meals',altType:'soft'},residents:[{room:'qa-1',tags:[]},{room:'qa-2',tags:['Soft Meals']}]};
   const pd={...base,periodLabel:'Lunch',sections:[s],anaphSect:[],ctx:{altMeals:[{type:'plain',text:a.text},{type:'soft',text:b.text}]}};
   computePlatingData=()=>pd;
   const legacy=buildRoutingByMealJSON().routing['1'].SUNDAY.lunch._components,flow=doorFlowRoutingSlot({},1,'SUNDAY','lunch',null);
   const mixed=legacy['Plain Chicken Leg']===1&&legacy['Plain Basa']===1&&legacy['Plain Carrot and Zucchini']===2&&JSON.stringify(legacy)===JSON.stringify(flow.counts?._components);
   const stored=DOOR_RECIPE_DATA;let mixedUnknown;
   try {
    DOOR_RECIPE_DATA=[];
    const preview=buildPlatingHtml(pd,false),sheet=buildDaySheet('lunch',1,'MONDAY',pd);
    const cells=Object.values(sheet.ws).filter(c=>c&&c.v!==undefined).map(c=>String(c.v));
    mixedUnknown=preview.includes('UNVERIFIED — CHECK CODEX RECIPE FACTS')&&cells.some(v=>v.includes('UNVERIFIED — CHECK CODEX RECIPE FACTS'));
   }finally{DOOR_RECIPE_DATA=stored;}
   const recipes=DOOR_RECIPE_DATA;let unknown;
   try {DOOR_RECIPE_DATA=[];unknown=doorSectionAllergenStr({rule:{key:'gf',altType:'gf_alt'}},{...base,periodLabel:'Lunch',ctx:{_gfAlt:a.text}});}finally{DOOR_RECIPE_DATA=recipes;}
   return {results,mixed,mixedUnknown,unknown};
  } finally {computePlatingData=original;}
 });
 check('all nine optional plates reach both component exports for seven supported section types',allocationProof.results.length===63&&allocationProof.results.every(r=>r.equal));
 check('optional replacement labels use their own facts instead of main dish allergens',allocationProof.results.every(r=>!r.label.includes('EGG')&&!r.label.includes('GLUTEN'))&&allocationProof.results.some(r=>r.plate.startsWith('basa')&&r.label.includes('FISH')));
 check('mixed optional plain/soft plates count only actual recipients',allocationProof.mixed);
 check('mixed optional row labels refresh against current missing CODEX evidence in both renderers',allocationProof.mixedUnknown);
 check('missing optional recipe evidence is labelled unverified rather than borrowing main facts',allocationProof.unknown.includes('UNVERIFIED'));
 await page.evaluate(()=>{openMenuEdit(1,'SUNDAY','lunch');setAltMealsNone(false);doorUsePlainPlate(0,'chicken-yams');});
 check('controlling row feedback includes actual non-processed resident 614b',/614b/.test(await page.locator('#door-alt-feedback-0').innerText())&&/non-processed plate/.test(await page.locator('#door-alt-feedback-0').innerText()));
 await page.evaluate(()=>saveMenuEdit());await current.b.publish();
 const nonproc=await current.h.boot(structuredClone(current.b.remote.files),{storage});
 const np=await nonproc.page.evaluate(()=>{const pd=computePlatingData('lunch',1,'SUNDAY'),section=pd.sections.find(s=>s.rule.key==='no_processed');return {members:section.residents.map(r=>r.room),meal:getAltMeal(section.rule.altType,pd.ctx),preview:buildPlatingHtml(pd,false),components:buildRoutingByMealJSON().routing['1'].SUNDAY.lunch._components};});
 check('explicit non-processed option saves, replays and exports its actual named components',np.members.includes('614b')&&np.meal==='Plain Chicken Leg, Plain Roasted Yams, Plain Carrot and Zucchini'&&np.preview.includes(np.meal)&&np.components['Plain Roasted Yams']>=1);
 check('browser scenarios have no uncaught errors',!old.b.errors.length&&!current.b.errors.length&&!replay.errors.length&&!nonproc.errors.length);
 if(process.env.PLAIN_ALT_RECEIPT)fs.writeFileSync(process.env.PLAIN_ALT_RECEIPT,JSON.stringify({baseline,asOf:new Date().toISOString(),sourceSha256:createHash('sha256').update(fs.readFileSync('index.html')).digest('hex'),checks,
  recipeMode:fixture.base?'Full served canonical catalogue and base recipe feed':'Limited CI test fixture',worksheetMode:process.env.PLAIN_ALT_LIB_DIR?'Real pinned XLSX library':'Actual worksheet builder with coordinate utility adapter',
  unchangedSavedServices:84,unchangedCurrentData:true,codex:fixture.provenance},null,2)+'\n');
 console.log(checks+' opt-in plain-plate browser checks passed');
}finally{if(old)await old.h.close();if(current)await current.h.close();fs.rmSync(originalPath);fs.rmdirSync(temporary);}
