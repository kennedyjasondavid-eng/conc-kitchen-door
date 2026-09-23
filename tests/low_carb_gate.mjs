import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function between(a,b) { const start=html.indexOf(a); assert.ok(start>=0); const end=html.indexOf(b,start); assert.ok(end>start); return html.slice(start,end); }
const sb=vm.createContext({});
vm.runInContext(between('const ROUTING_RULES = [','// ============================================================') + between('function computeSections(', 'let mcWeek =') + between('function hasCarbAccommodation(', 'function getTagLabels('), sb);
const route=(tags,flags)=>vm.runInContext(`computeSections(${JSON.stringify(flags)}, [{room:'101',tags:${JSON.stringify(tags)}}]).find(s=>s.residents.length).rule.key`,sb);
test('low carb follows diabetic routing and retains higher-priority diets',()=>{
 for(const tags of [['Low Carb'],['Diabetic'],['Low Carb','Diabetic']]) {
  assert.equal(route(tags,{isCarb:true}),'diabetic');
  assert.equal(route(tags,{isCarb:false}),'regular');
 }
 assert.equal(route(['Low Carb','Halal'],{isCarb:true,hasPork:true}),'halal');
 assert.equal(route(['Low Carb','Vegan'],{isCarb:true}),'vegan');
 assert.equal(route(['Low Carb','GF'],{isCarb:true,hasGluten:true}),'gf');
});
test('imports recognize low-carb variants without a diabetic diagnosis',()=>{
 const parser=vm.createContext({console,localStorage:{getItem:()=>null,setItem(){}},document:{getElementById:()=>null}});
 vm.runInContext(between('const TAG_LABELS_MAP = {','// v30: Enrich')+between('const IMPORT_TAG_RULES = [','\nfunction handleImportFile('),parser);
 for(const text of ['Low Carb','low-carb','Low carbohydrate','Low carbohydrates']) {
  const result=vm.runInContext(`normalizeRestriction(${JSON.stringify(text)})`,parser);
  assert.equal(result.tags.lowCarb,true,text);
  assert.ok(!result.tags.diabetic,text);
  assert.equal(vm.runInContext('importSectionForTags({lowCarb:true})',parser),'Diabetic');
 }
});
test('all inline scripts parse',()=>{
 for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) if(match[1].trim()) new vm.Script(match[1]);
});

test('Low Carb is an accommodation, including previously migrated residents',()=>{
 const tiers=vm.createContext({});
 vm.runInContext(between('const ROUTING_TAGS =', 'function getAltMeal('),tiers);
 const resident={tags:['Low Carb','Halal'],restrictions:['Low Carb','Halal'],accommodations:['Low Sodium'],allergenFlags:['No Peanuts'],avoidances:['No Peanuts','Low Sodium'],_tierMigrated:true,isAnaph:true};
 tiers.resident=resident;
 vm.runInContext('migrateResidentTiers(resident); migrateResidentTiers(resident);',tiers);
 assert.deepEqual([...resident.restrictions],['Halal']);
 assert.deepEqual([...resident.accommodations],['Low Sodium','Low Carb']);
 assert.deepEqual([...resident.avoidances],['No Peanuts','Low Sodium','Low Carb']);
 assert.deepEqual(resident.tags,['Low Carb','Halal']);
 assert.equal(resident.isAnaph,true);
 tiers.fresh={tags:['Low Carb']};
 vm.runInContext('migrateResidentTiers(fresh)',tiers);
 assert.deepEqual([...tiers.fresh.restrictions],[]);
 assert.deepEqual([...tiers.fresh.accommodations],['Low Carb']);
 const intake=between('<!-- RESTRICTION FIELDS -->','<!-- RIGHT PANEL -->');
 const control=intake.indexOf("toggleCb(this,'lowCarb')");
 assert.ok(control>intake.indexOf('>Accommodations <'));
});
