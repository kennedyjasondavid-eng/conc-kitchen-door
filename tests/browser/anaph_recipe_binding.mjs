// Actual coherent publisher, current menu/state, no live credentials or writes.
// ANAPH_BINDING_OUTPUT stages changed artifacts for inspection; never writes operational files itself.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
process.env.HOUSE_FLOW_HTML=path.join(root,'index.html');
const {harness,clone,sourceHash}=await import('./menu_flow_f6_harness.mjs');
const read=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8'));
const baseline=process.env.ANAPH_BINDING_BASE_REF;
if(baseline&&!/^(HEAD|[a-f0-9]{40})$/.test(baseline))throw Error('Authoring baseline must be HEAD or an exact commit.');
const sourceRead=n=>baseline?JSON.parse(execFileSync('git',['show',baseline+':'+n],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024})):read(n);
const captured=process.env.ANAPH_BINDING_CATALOG_DIR;
const catalog=captured?{_meta:{provenance:JSON.parse(fs.readFileSync(path.join(captured,'current-pages_provenance.json'),'utf8'))},...JSON.parse(fs.readFileSync(path.join(captured,'current-library_public.json'),'utf8'))}:read('tests/fixtures/anaph_recipe_catalog_2026-11-16.json');
if(captured)catalog._meta.provenance=JSON.parse(fs.readFileSync(path.join(captured,'current-pages_provenance.json'),'utf8'));
if(captured){const bytes=fs.readFileSync(path.join(captured,'current-library_public.json'));assert.equal(createHash('sha256').update(bytes).digest('hex'),catalog._meta.provenance.sharedLibrary.sha256,'Captured Library must match served provenance');assert.equal(catalog._meta.version,1);}
const recipeBase=captured?JSON.parse(fs.readFileSync(path.join(captured,'current-DOOR_RECIPE_DATA.json'),'utf8')):null;
if(process.env.ANAPH_BINDING_OUTPUT&&!captured)throw Error('Staging requires the full captured canonical catalogue, not the test subset.');
const byId=Object.fromEntries(catalog.recipes.map(r=>[r.recipeId,r]));
const bindings=[
 ['A01',1,'MONDAY','plain-chicken-leg-with-rice-and-vegetables'],
 ['A02',1,'WEDNESDAY','plain-chicken-leg-with-rice-and-vegetables'],
 ['A03',1,'FRIDAY','plain-chicken-leg-with-rice-and-vegetables'],
 ['A04',2,'WEDNESDAY','plain-basa-with-rice-and-vegetables'],
 ['A05',3,'THURSDAY','plain-chicken-leg-with-rice-and-vegetables'],
 ['A06',4,'MONDAY','plain-basa-with-rice-and-vegetables']
].map(([decision,week,day,recipeId])=>({decision,week,day,period:'dinner',recipeId,recipeName:byId[recipeId].recipeName}));
const files=Object.fromEntries(fs.readdirSync(root).filter(n=>n.endsWith('.json')).map(n=>[n,sourceRead(n)]));
const CLOCK=process.env.ANAPH_BINDING_CLOCK||'2026-11-17T00:30:00.000Z';
const storage={concOperatorName:'Codex (Jason-directed)',concLastImportDate:files['door_state.json'].lastImportDate||'',concLastImportFile:files['door_state.json'].lastImportFile||'',concLastImportCount:String(files['door_state.json'].lastImportCount||''),concAltFlagSweepV1:'done',concRegistryProvenance:files['door_state.json']._meta.registryModifiedAt,
 concRecentLog:JSON.stringify(files['recent_log.json']),concLearnedNR:JSON.stringify(files['learned_nr.json']),concCustomTagRules:JSON.stringify(files['custom_tag_rules.json'])};
let passed=0;const check=(label,value)=>{assert.ok(value,label);passed++;console.log('PASS '+label);};
const h=await harness();
async function prepare(b) {
 await b.page.clock.pauseAt(new Date(CLOCK));
 return b.page.evaluate(({bindings,catalog,recipeBase})=>{
  // Frozen CODEX wire records through the normal reader, not altered menu allergen flags.
  if(recipeBase){_doorRecipeBase=recipeBase;_recipeDataSource='captured-live';}
  _doorSharedLibrary={_meta:{version:1,generated:catalog._meta.generated||catalog._meta.provenance.asOf},recipes:catalog.recipes};
  _doorSharedLibrarySource='fixture';_doorApplySharedRecipes();
  const routingBefore=buildRoutingByMealJSON().routing;
  const before=getMenuData(),overlay=loadMenuBaseOverlay(),changed=JSON.parse(JSON.stringify(overlay)),evidence=[];
  const exact=s=>String(s||'').trim().replace(/\s+/g,' ').toLowerCase();
  for(const binding of bindings) {
   const day=before[binding.week][binding.day],key=binding.period+'_anaphAlt';
   if(day[key]&&exact(day[key])!==exact(binding.recipeName))throw Error('Newer named meal needs review: '+binding.decision);
   const matches=DOOR_RECIPE_DATA.filter(r=>exact(r.recipeName)===exact(binding.recipeName));
   if(matches.length!==1||matches[0].recipeId!==binding.recipeId)throw Error('Missing or ambiguous exact recipe: '+binding.recipeName);
   const recipe=matches[0],parsed=_hubAllergenResolve(recipe.allergens),flags=hubAllergenToFlags(recipe.allergens);
   if(parsed.unknown.size)throw Error('Unknown recipe facts: '+[...parsed.unknown].join(', '));
   const pd=computePlatingData(binding.period,binding.week,binding.day);
   const conflicts=pd.anaphSect.flatMap(r=>checkResidentMealConflicts(flags,r).map(c=>({room:r.room,...c})));
   if(conflicts.length)throw Error('Declared recipe conflict: '+JSON.stringify(conflicts));
   evidence.push({...binding,recipeFingerprint:catalog.recipes.find(r=>r.recipeId===binding.recipeId).contentFingerprint,
     declaredAllergens:recipe.allergens,declaredFlags:flags,mainTriggerFlags:pd.mealFlags,
     recipients:pd.anaphSect.map(r=>({room:r.room,role:r._role,tags:r.tags,serviceNote:r.serviceNote||'',rawRestriction:r.rawRestriction})),
     preparation:'Separate preparation and current resident texture/instructions still apply; matching is not approval'});
   changed[binding.week]??={};changed[binding.week][binding.day]={...(changed[binding.week][binding.day]||{}),[key]:binding.recipeName};
  }
  localStorage.setItem('concMenuBase',JSON.stringify(doorNormalizeMenuOverlay(doorStampOverlayEdits(overlay,changed,Date.now()))));
  return {evidence,routingBefore};
 },{bindings,catalog,recipeBase});
}
try {
 const b=await h.boot(clone(files),{storage});const {evidence,routingBefore}=await prepare(b);
 const result=await b.publish();
 check('actual publisher commits one atomic complete batch',b.remote.visibleWrites.length===1&&b.remote.visibleWrites[0].kind==='atomic');
 const candidate=clone(b.remote.files);
 for(const binding of bindings) {
  check(binding.decision+' canonical recipe reaches final menu and overlay',candidate['menu_current.json'].menu[binding.week][binding.day].dinner_anaphAlt===binding.recipeName&&candidate['menu_overlay.json'][binding.week][binding.day].dinner_anaphAlt===binding.recipeName);
 }
 check('all current residents and anaphylactic authority preserved',JSON.stringify(candidate['door_state.json'].residents)===JSON.stringify(files['door_state.json'].residents)&&JSON.stringify(candidate['door_state.json'].anaphRooms)===JSON.stringify(files['door_state.json'].anaphRooms));
 check('last daily import provenance is retained',['lastImportDate','lastImportFile','lastImportCount'].every(k=>candidate['door_state.json'][k]===files['door_state.json'][k]));
 check('routing counts and portions are unchanged by naming the separate plates',isDeepStrictEqual(candidate['routing_by_meal.json'].routing,captured?files['routing_by_meal.json'].routing:routingBefore));
 check('registry data timestamp is not advanced by a menu edit',candidate['door_state.json']._meta.registryModifiedAt===files['door_state.json']._meta.registryModifiedAt);
 check('learned answers and custom rules remain unchanged',JSON.stringify(candidate['learned_nr.json'])===JSON.stringify(files['learned_nr.json'])&&JSON.stringify(candidate['custom_tag_rules.json'])===JSON.stringify(files['custom_tag_rules.json']));
 const families=['menu_current.json','menu_overlay.json','routing_by_meal.json','registry_summary.json','door_state.json'];
 check('all coupled artifacts carry one input revision and occurrence',families.every(n=>JSON.stringify(candidate[n]._meta.flow)===JSON.stringify(candidate['menu_current.json']._meta.flow)));
 const strippedMenu=clone(candidate['menu_current.json'].menu),originalMenu=clone(files['menu_current.json'].menu);
 for(const binding of bindings){delete strippedMenu[binding.week][binding.day].dinner_anaphAlt;delete originalMenu[binding.week][binding.day].dinner_anaphAlt;}
 if(!isDeepStrictEqual(strippedMenu,originalMenu)) { const diffs=[];const visit=(a,b,p)=>{if(isDeepStrictEqual(a,b))return;if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))visit(a[k],b[k],p+'.'+k);}else diffs.push({path:p,actual:a,before:b});};visit(strippedMenu,originalMenu,'menu');console.log(JSON.stringify(diffs.slice(0,15)));}
 check('unrelated menu dishes, sides, flags and existing named alternatives unchanged',isDeepStrictEqual(strippedMenu,originalMenu));
 if(process.env.ANAPH_BINDING_LIB_DIR) {
  await b.page.addScriptTag({path:path.resolve(process.env.ANAPH_BINDING_LIB_DIR,'xlsx.bundle.min.js')});
  const books=await b.page.evaluate(({bindings,CLOCK})=>[1,2,3,4].map(week=>{
   const wb=buildPlatingXlsx('dinner',week);
   wb.Props={Title:'DRAFT — recipe binding QA, not for service',Comments:'Actual DOOR builder; source/provenance in binding receipt; as of '+CLOCK};
   const bytes=Array.from(new Uint8Array(XLSX.write(wb,{bookType:'xlsx',type:'array'})));
   const decoded=XLSX.read(new Uint8Array(bytes),{type:'array'});
   const cells=decoded.SheetNames.flatMap(n=>Object.values(decoded.Sheets[n]).filter(c=>c&&c.v!==undefined).map(c=>String(c.v)));
   return {week,bytes,sheets:decoded.SheetNames.length,named:bindings.filter(x=>x.week===week).every(x=>cells.some(c=>c.startsWith(x.recipeName+' — prepared separately')))};
  }),{bindings,CLOCK});
  for(const book of books) {
   check('saved W'+book.week+' dinner XLSX retains seven days and its exact separate recipes',book.sheets===7&&book.named);
   if(process.env.ANAPH_BINDING_OUTPUT)fs.writeFileSync(path.join(root,'outputs','door-breakfast-matrix-20261116','DRAFT-W'+book.week+'-dinner-binding-QA.xlsx'),Buffer.from(book.bytes));
  }
 }
 // Another computer receives the accepted artifacts and the same recipes; recomputes real plating.
 const replay=await h.boot(candidate,{storage});await prepare(replay);
 const plates=await replay.page.evaluate(bindings=>bindings.map(x=>{const pd=computePlatingData(x.period,x.week,x.day);return {decision:x.decision,meal:pd.ctx.anaphAlt,rooms:pd.anaphSect.map(r=>r.room),state:doorAssessAnaphAlternative(pd).state};}),bindings);
 check('another-device replay uses all six actual named separate plates',plates.every((x,i)=>x.meal===bindings[i].recipeName&&x.state==='named'));
 const breakfast=await replay.page.evaluate(()=>{
  const slots=[];
  for(const w of [1,2,3,4]) for(const d of ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY']) {
   const pd=computePlatingData('breakfast',w,d);
   slots.push({week:w,day:d,main:pd.mealName,flags:pd.mealFlags,context:pd.ctx,
    residents:pd.sections.flatMap(s=>s.residents.map(r=>({room:r.room,key:s.rule.key,group:s.rule.label,
      plate:doorBreakfastDefinitionGap(pd)&&s.rule.altType==='gf_alt'?'UNRESOLVED — specify the gluten-free breakfast':s.rule.key==='regular'?pd.mealName:getAltMeal(s.rule.altType,pd.ctx),
      legacyComputedPlate:doorBreakfastDefinitionGap(pd)&&s.rule.altType==='gf_alt'?getAltMeal(s.rule.altType,pd.ctx):'',
      serviceNote:r.serviceNote||'',rawRestriction:r.rawRestriction||'',tags:r.tags,
      conflictNote:formatConflictNote(checkResidentMealConflicts(pd.mealFlags,r))}))) });
  }
  // Controlled manual definitions in existing fields, not operational migration.
  const current=loadMenuBaseOverlay(),trial=JSON.parse(JSON.stringify(current));
  trial['1']??={};
  trial['1'].TUESDAY={...(trial['1'].TUESDAY||{}),breakfast_veg:'Cereal & Oat Milk, Fresh Fruit',
   breakfast_gfAlt:'Chex cereal, regular milk, yoghurt, whole fruit',breakfast_noDairyAlt:'Cereal & Oat Milk, Fresh Fruit'};
  trial['1'].SUNDAY={...(trial['1'].SUNDAY||{}),
   breakfast_veg:'WW Bread, Veg patty, Shredded vegan cheese + DF Yogurt & Fruit',
   breakfast_halal:'WW English muffin, Halal Deli Slice, Sliced cheese, Egg + Yogurt & Fruit',
   breakfast_noEggAlt:'WW Bread, Veg patty, Shredded vegan cheese + DF Yogurt & Fruit',
   breakfast_noDairyAlt:'WW English muffin, Halal Deli Slice, Egg + DF Yogurt & Fruit'};
  const cases=[];
  try {
   localStorage.setItem('concMenuBase',JSON.stringify(doorNormalizeMenuOverlay(doorStampOverlayEdits(current,trial,Date.now()))));
   for(const [day,rooms]of [['TUESDAY',['301a','1207']],['SUNDAY',['304','412']]]) {
    const pd=computePlatingData('breakfast',1,day);
    for(const room of rooms){const section=pd.sections.find(s=>s.residents.some(r=>r.room===room));
     cases.push({week:1,day,room,key:section.rule.key,plate:getAltMeal(section.rule.altType,pd.ctx),tags:section.residents.find(r=>r.room===room).tags});}
   }
  }finally{localStorage.setItem('concMenuBase',JSON.stringify(current));}
  return {slots,cases,registry:REGISTRY_LIST,anaphRooms};
 });
 check('breakfast capture covers 28 slots with every resident once',breakfast.slots.length===28&&breakfast.slots.every(s=>s.residents.length===files['door_state.json'].residents.length&&new Set(s.residents.map(r=>r.room)).size===s.residents.length));
 const breakfastPreview=await replay.page.evaluate(()=>{
  psWhen='browse';psWeek=1;psDay='MONDAY';psPeriod='breakfast';showScreen('plating');renderPlatingPreview();
  const header=[...document.querySelectorAll('#ps-preview .ps-sect-hdr')].find(e=>e.textContent.includes('Gluten Free'));
  const readiness=doorPlatingReadiness(doorRotationServices('breakfast',[1,3]));
  return {html:document.getElementById('ps-preview').innerHTML,gfMeal:header?.parentElement.nextElementSibling.textContent,
    readiness:{ready:readiness.ready,issues:readiness.issues}};
 });
 check('undefined GF breakfast preview is draft and does not label its GF row chicken/rice',breakfastPreview.html.includes('DRAFT / NOT FOR SERVICE')&&breakfastPreview.gfMeal?.includes('UNRESOLVED')&&!breakfastPreview.gfMeal.includes('Chicken'));
 check('both combined breakfast weeks are refused until the GF definitions exist',!breakfastPreview.readiness.ready&&breakfastPreview.readiness.issues.length===14);
 const alerts=[];replay.page.on('dialog',async d=>{alerts.push(d.message());await d.accept();});
 const printed=await replay.page.evaluate(()=>{let prints=0;window.print=()=>prints++;printPlatingPreview();return prints;});
 check('ordinary service print refuses missing GF breakfast',printed===0&&alerts.some(x=>x.includes('Gluten-free breakfast meal is not defined')));

 // A resident edit on the remote after this tablet opened cannot be replaced by this menu change.
 const race=await h.boot(clone(files),{storage});await prepare(race);
 const updated=clone(files['door_state.json']);updated.residents[0].serviceNote='Synthetic newer resident instruction';
 updated._meta.registryModifiedAt=new Date(Date.parse(CLOCK)+60000).toISOString();updated._meta.exported=updated._meta.registryModifiedAt;
 race.remote.externalUpdate({'door_state.json':updated});await race.publish();
 check('concurrent newer resident instruction survives menu publication',race.remote.files['door_state.json'].residents[0].serviceNote==='Synthetic newer resident instruction');
 check('concurrent publication retains all six names',bindings.every(x=>race.remote.files['menu_current.json'].menu[x.week][x.day].dinner_anaphAlt===x.recipeName));
 check('browser scenarios have no uncaught errors or unsupported writes',[b,replay,race].every(x=>!x.errors.length&&!x.illegal.length));
 if(process.env.ANAPH_BINDING_OUTPUT) {
  const out=path.resolve(process.env.ANAPH_BINDING_OUTPUT);fs.mkdirSync(out,{recursive:true});
  const changed=Object.keys(candidate).filter(n=>JSON.stringify(candidate[n])!==JSON.stringify(files[n]));
  for(const name of changed)fs.writeFileSync(path.join(out,name),JSON.stringify(candidate[name],null,2)+'\n');
  fs.writeFileSync(path.join(out,'binding-receipt.json'),JSON.stringify({asOf:CLOCK,generatedAt:new Date().toISOString(),sourceCodeSha256:sourceHash,source:'actual coherent publisher; isolated mocked transport',codex:catalog._meta.provenance,bindings:evidence,checks:passed,changedFiles:changed,plates,result,breakfast},null,2)+'\n');
  console.log('Staged '+changed.join(', '));
 }
 console.log(passed+' recipe-binding browser checks passed');
}finally{await h.close();}
