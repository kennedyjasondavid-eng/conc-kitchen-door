import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/plain_plate_roster_2026-11-17.json',import.meta.url),'utf8'));
const copy=v=>JSON.parse(JSON.stringify(v));
function box() {
 const elements=Object.fromEntries(['gfAlt','noEggAlt','anaphAlt'].map(k=>['mc-kalt-'+k,{value:'Existing plate'}]));
 const c={DOOR_RECIPE_DATA:fixture.recipes.map(r=>copy({...r.door,recipeId:r.recipeId})),ALT_MEALS:[{text:'Existing',type:'plain',flags:{hasDairy:true}}],
  ALT_MEALS_NONE:false,_doorPlainChoiceTargets:new Map(),mcMenuEditKey:'1-MONDAY-lunch',testMealActive:false,updates:0,renders:0,
  updateSlotSummary(){c.updates++;},renderAltMealsSection(){c.renders++;},document:{getElementById:id=>elements[id]||null},
  DOOR_KITCHEN_ALT_LABELS:{gfAlt:'Gluten free'},REGISTRY_LIST:[],
  _hubAllergenResolve:allergens=>({unknown:new Set(allergens.filter(s=>!['None','Fish (Basa)','Soy (Tofu)'].includes(s)))}),
  hubAllergenToFlags:allergens=>({hasFish:allergens.some(s=>s.startsWith('Fish')),hasSoy:allergens.some(s=>s.startsWith('Soy'))}),
  doorSplitDishes:text=>String(text).split(',').map(s=>s.trim()).filter(Boolean),_escAttr:s=>String(s).replaceAll('"','&quot;'),
  _jsArgLiteral:JSON.stringify,escapeHtml:s=>String(s).replaceAll('<','&lt;'),
  getAnaphConflictRooms:()=>new Set(),computeSections:()=>[],checkResidentMealConflicts:()=>[],
  buildVegAltFlags:()=>({}),buildNoPorkAlt:()=>'',doorKitchenAltInputValues:()=>({gfAlt:elements['mc-kalt-gfAlt'].value}),showToast:()=>{}};
 vm.createContext(c);vm.runInContext(html.slice(html.indexOf('function doorTurnkeyPlateParts('),html.indexOf('function doorKitchenAlternatives(')),c);
 return {c,elements};
}
test('nine complete optional plates draw solely from six canonical CODEX components',()=>{
 const {c}=box(),roster=copy(c.doorPlainPlateRoster());
 assert.equal(roster.length,9);assert.ok(roster.every(p=>p.available));
 assert.deepEqual(roster.find(p=>p.id==='chicken-rice').recipeIds,['plain-chicken-leg','plain-rice-no-added-salt','plain-carrot-and-zucchini']);
 assert.deepEqual(roster.find(p=>p.id==='tofu-no-starch').recipeIds,['plain-tofu','plain-carrot-and-zucchini']);
 assert.equal(roster.find(p=>p.id==='tofu-yams').flags.hasSoy,true);
 assert.equal(roster.find(p=>p.id==='basa-rice').flags.hasFish,true);
 assert.equal(roster.find(p=>p.id==='chicken-rice').flags.hasChicken,true);
});
test('rendering options starts blank and does not select, save or mutate any meal',()=>{
 const {c,elements}=box(),before=JSON.stringify([c.ALT_MEALS,c.DOOR_RECIPE_DATA,elements]);
 const output=c.doorPlainPlatePickerHTML(0);assert.match(output,/<option value="">Choose a plain plate/);
 assert.doesNotMatch(output,/ selected/);assert.equal(c.updates,0);
 assert.equal(JSON.stringify([c.ALT_MEALS,c.DOOR_RECIPE_DATA,elements]),before);
});
test('an explicit row selection changes only that draft row, carries current flags, and keeps its type',()=>{
 const {c}=box();c.ALT_MEALS[0].type='soft';const facts=JSON.stringify(c.DOOR_RECIPE_DATA);
 assert.equal(c.doorUsePlainPlate(0,'basa-yams'),true);
 assert.equal(c.ALT_MEALS[0].type,'soft');assert.equal(c.ALT_MEALS[0].flags.hasFish,true);
 assert.equal(c.ALT_MEALS[0].flags.hasDairy,undefined);
 assert.equal(c.ALT_MEALS[0].text,'Plain Basa, Plain Roasted Yams, Plain Carrot and Zucchini');
 assert.equal(c.updates,1);assert.equal(c.renders,1);assert.equal(JSON.stringify(c.DOOR_RECIPE_DATA),facts);
});
test('requirement-field selection keeps other requirements and plain rows intact',()=>{
 const {c,elements}=box(),before=JSON.stringify(c.ALT_MEALS);
 assert.equal(c.doorUsePlainPlate('gfAlt','tofu-rice'),true);
 assert.equal(elements['mc-kalt-gfAlt'].value,'Plain Tofu, Plain Rice (No Added Salt), Plain Carrot and Zucchini');
 assert.equal(elements['mc-kalt-noEggAlt'].value,'Existing plate');assert.equal(JSON.stringify(c.ALT_MEALS),before);
});
test('missing, duplicated, ambiguous or unknown canonical facts disable affected choices',()=>{
 for(const mutate of [
  c=>c.DOOR_RECIPE_DATA.splice(c.DOOR_RECIPE_DATA.findIndex(r=>r.recipeId==='plain-basa'),1),
  c=>c.DOOR_RECIPE_DATA.push(copy(c.DOOR_RECIPE_DATA.find(r=>r.recipeId==='plain-basa'))),
  c=>c.DOOR_RECIPE_DATA.find(r=>r.recipeId==='plain-basa').allergens=['Unrecognized ingredient'],
  c=>c.DOOR_RECIPE_DATA.find(r=>r.recipeId==='plain-basa').allergens=[],
  c=>c.DOOR_RECIPE_DATA.find(r=>r.recipeId==='plain-basa').allergens=[null]]) {
  const {c}=box();mutate(c);const before=JSON.stringify(c.ALT_MEALS);
  assert.equal(c.doorPlainPlateRoster().find(p=>p.id==='basa-rice').available,false);
  assert.equal(c.doorUsePlainPlate(0,'basa-rice'),false);assert.equal(JSON.stringify(c.ALT_MEALS),before);
 }
});
test('breakfast and closed editors cannot apply the new options',()=>{
 const {c}=box();for(const key of ['1-MONDAY-breakfast',null]) {
  c.mcMenuEditKey=key;assert.equal(c.doorAltOptionsEnabled(),false);assert.equal(c.doorUsePlainPlate(0,'chicken-rice'),false);
 }assert.equal(c.ALT_MEALS[0].text,'Existing');
});
test('opt-in recognition is exact and excludes current meal descriptions and breakfast',()=>{
 const {c}=box(),plate=c.doorPlainPlateRoster()[0].text;
 assert.deepEqual(copy(c.doorTurnkeyPlateParts(plate)),['Plain Chicken Leg','Plain Rice (No Added Salt)','Plain Carrot and Zucchini']);
 for(const text of [plate+' ',plate.toLowerCase(),'Plain Roasted Chicken, Plain Rice & Stir-fried Veg','prefix '+plate])assert.equal(c.doorTurnkeyPlateParts(text),null);
 c.getAltMeal=()=>plate;
 assert.equal(c.doorTurnkeySectionPlate({rule:{altType:'diabetic_alt'}},{periodLabel:'Breakfast',ctx:{}}),null);
 assert.equal(c.doorTurnkeySectionPlate({rule:{altType:'diabetic_alt'}},{periodLabel:'Lunch',ctx:{}}),plate);
 c.DOOR_RECIPE_DATA.find(r=>r.recipeId==='plain-basa').recipeName='Renamed Basa';
 assert.equal(c.doorPlainPlateRoster().find(p=>p.id==='basa-rice').available,false);
});
test('draft outcome accounting excludes anaphylactic separation and retains sparse plain/soft row indices',()=>{
 const {c}=box();const r={room:'soft',tags:['Soft Meals'],serviceNote:'No sauce'};
 c.getAnaphConflictRooms=()=>new Set(['separate']);
 c.computeSections=(flags,rs)=>{assert.deepEqual(copy(rs.map(r=>r.room)),['soft']);return [{rule:{key:'soft'},residents:rs}];};
 const rows=[{text:'',type:'plain'},{text:'Plain Chicken Leg',type:'soft'}];
 const result=copy(c.doorAltEditorOutcomes({}, {},rows,[r,{room:'separate',tags:[]}],[]));
 assert.deepEqual(result.find(o=>o.target===1).residents,[{room:'soft',note:'No sauce'}]);
 assert.equal(result.some(o=>o.target===0),false);assert.equal(result.find(o=>o.target==='anaphAlt').residents[0].room,'separate');
});
test('feedback reports secondary vegetarian and no-rice instructions without changing routing or records',()=>{
 const {c}=box(),residents=[{room:'veg',tags:['Vegetarian'],serviceNote:''},{room:'lowcarb',tags:[],serviceNote:'No Rice /Pasta'}];
 c.computeSections=()=>[{rule:{key:'gf'},residents}];
 const before=JSON.stringify(residents),result=copy(c.doorAltEditorOutcomes({}, {gfAlt:'Plain Chicken Leg, Plain Rice (No Added Salt), Plain Carrot and Zucchini'},[],residents,[]));
 assert.equal(result.find(o=>o.target==='gfAlt').conflicts.length,2);assert.equal(JSON.stringify(residents),before);
});
test('controlling soft row feedback includes non-processed recipients and their instructions',()=>{
 const {c}=box(),r={room:'non-processed',tags:['No Processed Food'],serviceNote:'Low sodium'};
 c.computeSections=()=>[{rule:{key:'no_processed'},residents:[r]},{rule:{key:'soft'},residents:[]}];
 const rows=[{text:'Plain Tofu',type:'plain'},{text:'Plain Chicken Leg',type:'soft'}];
 const result=copy(c.doorAltEditorOutcomes({hasProcessedMeat:true},{},rows,[r],[]));
 assert.deepEqual(result.find(o=>o.target===1).residents,[{room:r.room,note:r.serviceNote}]);
 assert.match(result.find(o=>o.target===1).explanation,/non-processed/);assert.equal(result.find(o=>o.target===0).residents.length,0);
});
test('save rejects only changed opt-in targets with conflicts or now-unavailable facts',()=>{
 const {c,elements}=box();c.REGISTRY_LIST=[{room:'no-fish',tags:['No Fish']}];
 c.computeSections=()=>[{rule:{key:'gf'},residents:c.REGISTRY_LIST}];
 c.checkResidentMealConflicts=(flags,r)=>flags.hasFish?[{tag:'No Fish'}]:[];
 assert.equal(c.doorCheckNewPlainChoices({}),true,'untouched manual values have no new gate');
 c.doorUsePlainPlate('gfAlt','basa-rice');assert.equal(c.doorCheckNewPlainChoices({}),false);
 assert.equal(elements['mc-kalt-gfAlt'].value,'Plain Basa, Plain Rice (No Added Salt), Plain Carrot and Zucchini','blocked draft remains intact');
 c.doorUsePlainPlate('gfAlt','chicken-yams');assert.equal(c.doorCheckNewPlainChoices({}),true);
 c.DOOR_RECIPE_DATA=[];assert.equal(c.doorCheckNewPlainChoices({}),false,'facts checked again at save');
 elements['mc-kalt-gfAlt'].value='Existing plate';assert.equal(c.doorCheckNewPlainChoices({}),true,'restoring original value does not activate gate');
});
