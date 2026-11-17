// Frozen before product changes: identity truth and deliberate keyboard recipe selection.
// Synthetic full-app browser gate; no staff storage, network writes or operational data.
// node tests/browser/editor_identity_picker.mjs
// Gate-author amendment 2026-11-17: both fixtures use regular stream because the exercised Main slot
// deliberately excludes vegan-stream recipes. This corrects test data, not product filters or expectations.
import fs from 'node:fs';import path from 'node:path';import{createRequire}from'node:module';import{pathToFileURL}from'node:url';
const root=process.cwd(),dir=path.join(root,'outputs/staff-baseline-20261117/gates');
let pw;try{pw=createRequire(import.meta.url)('playwright')}catch{pw=createRequire(path.join(root,'../conc-kitchen-expo/package.json'))('playwright')}const{chromium}=pw;
fs.mkdirSync(dir,{recursive:true});const source=path.resolve(process.env.DOOR_GATE_HTML||'index.html');const results=[];
const check=(name,pass,detail)=>{results.push({name,pass:!!pass,detail});console.log((pass?'PASS ':'FAIL ')+name+(!pass?' '+JSON.stringify(detail):''));};
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(/^https?:/,r=>r.abort());await page.addInitScript(()=>{localStorage.setItem('concAltFlagSweepV1','done');window.Chart=function(){return{destroy(){},update(){}}}});
 await page.goto(pathToFileURL(source).href);await page.waitForFunction(()=>typeof openMenuEdit==='function');
 const recipes=[{recipeName:'Audit Chili Beans',recipeId:'audit-chili-beans',allergens:['Beans'],category:'protein',stream:'regular',veganFriendly:true},{recipeName:'Audit Chili Tofu',recipeId:'audit-chili-tofu',allergens:['Soy'],category:'protein',stream:'regular',veganFriendly:true}];
 await page.evaluate(recipes=>{DOOR_RECIPE_DATA=recipes;showScreen('menu-config');openMenuEdit(3,'SUNDAY','dinner');},recipes);
 const setMain=async(state,catalog=recipes)=>{await page.evaluate(({state,catalog})=>{DOOR_RECIPE_DATA=catalog;initSlotState();MEAL_SLOT_STATE.main=state;renderSlots();updateSlotSummary();},{state,catalog});};
 const card=()=>page.locator('#slot-search-main').locator('..').locator('..');
 const validText=t=>/recipe matched|linked to codex|recipe linked|linked recipe/i.test(t)&&!/unavailable|missing recipe|ambiguous|review link/i.test(t);
 await setMain({recipeName:'Audit Chili Beans',recipeId:'audit-chili-beans',displayText:'Kitchen bean plate',flags:{hasBeans:false,hasDairy:true}});
 check('valid unique stable identity is visibly linked',validText(await card().innerText()),await card().innerText());
 check('recipe search has an accessible name',await page.locator('#slot-search-main').evaluate(e=>!!(e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')||e.labels?.length)));
 check('menu display-name input has an accessible name',await page.locator('#slot-showas-main').evaluate(e=>!!(e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')||e.labels?.length)));
 await setMain({recipeName:'Old Audit Bean Chili',recipeId:'audit-chili-beans',displayText:'Kitchen bean plate',flags:{hasBeans:false,hasDairy:true}});
 check('same stable ID remains linked after canonical recipe rename',validText(await card().innerText()),await card().innerText());
 check('rendering renamed source does not reset explicit flags or menu name',await page.evaluate(()=>MEAL_SLOT_STATE.main.flags.hasBeans===false&&MEAL_SLOT_STATE.main.flags.hasDairy===true&&MEAL_SLOT_STATE.main.displayText==='Kitchen bean plate'));
 for(const [name,state,catalog]of[
  ['stored absent ID cannot borrow matching name',{recipeName:'Audit Chili Beans',recipeId:'audit-absent',flags:{hasDairy:true}},recipes],
  ['conflicting ID and another live recipe name need review',{recipeName:'Audit Chili Beans',recipeId:'audit-chili-tofu',flags:{hasDairy:true}},recipes],
  ['duplicate stable ID is not a verified match',{recipeName:'Audit Chili Beans',recipeId:'audit-chili-beans',flags:{hasDairy:true}},recipes.concat({...recipes[0],recipeName:'Audit collision'})]
 ]){await setMain(state,catalog);const t=await card().innerText();check(name,!validText(t)&&/unavailable|ambiguous|review|missing|not found|unresolved/i.test(t),t);check(name+' preserves captured warning',await page.evaluate(()=>MEAL_SLOT_STATE.main.flags.hasDairy===true));}
 await setMain({manual:'Audit manual plate',flags:{hasDairy:true}});check('manual dish is visibly unlinked',/manual|unlinked/i.test(await card().innerText()));
 async function search(text){await setMain(null);const box=page.locator('#slot-search-main');await box.click();await box.fill(text);return box;}
 let box=await search('Audit Chili');
 check('search exposes combobox expanded state',await box.getAttribute('role')==='combobox'&&await box.getAttribute('aria-expanded')==='true');
 check('results expose listbox options',await page.locator('#slot-dd-main [role="option"]').count()===2&&await page.locator('#slot-dd-main').getAttribute('role')==='listbox');
 await box.press('ArrowDown');let active=await box.getAttribute('aria-activedescendant');check('ArrowDown explicitly activates first option',!!active&&await page.locator('[id="'+(active||'missing')+'"]').getAttribute('role')==='option',active);
 await box.press('ArrowDown');let second=await box.getAttribute('aria-activedescendant');check('second ArrowDown advances option',!!second&&second!==active,{active,second});
 await box.press('ArrowUp');check('ArrowUp returns to prior option',!!active&&await box.getAttribute('aria-activedescendant')===active);
 await box.press('Enter');check('Enter chooses deliberately highlighted recipe with stable ID',await page.evaluate(()=>MEAL_SLOT_STATE.main?.recipeId==='audit-chili-beans'&&MEAL_SLOT_STATE.main?.recipeName==='Audit Chili Beans'&&!MEAL_SLOT_STATE.main?.manual),await page.evaluate(()=>MEAL_SLOT_STATE.main));
 box=await search('Audit Chili');await box.press('Enter');check('Enter without active option preserves explicit manual semantics',await page.evaluate(()=>MEAL_SLOT_STATE.main?.manual==='Audit Chili'&&!MEAL_SLOT_STATE.main?.recipeId),await page.evaluate(()=>MEAL_SLOT_STATE.main));
 box=await search('Audit Chili');await box.press('ArrowDown');await box.press('Escape');check('Escape closes list and clears active selection',!(await page.locator('#slot-dd-main').isVisible())&&!(await box.getAttribute('aria-activedescendant'))&&await box.getAttribute('aria-expanded')==='false');
 // Gate-author additional coverage 2026-11-17: changing the query invalidates a prior explicit keyboard choice.
 box=await search('Audit Chili');await box.press('ArrowDown');await box.fill('Audit Chi');check('typing after navigation clears the obsolete active option',!(await box.getAttribute('aria-activedescendant')));await box.press('Enter');check('Enter after changed query cannot select a stale option',await page.evaluate(()=>MEAL_SLOT_STATE.main?.manual==='Audit Chi'&&!MEAL_SLOT_STATE.main?.recipeId),await page.evaluate(()=>MEAL_SLOT_STATE.main));
 await setMain({recipeName:'Audit Chili Beans',recipeId:'audit-chili-beans',displayText:'Kitchen bean plate',flags:{hasBeans:false,hasDairy:true}});box=page.locator('#slot-search-main');await box.click();await box.fill('Audit Chili Beans');await box.press('ArrowDown');await box.press('Enter');check('same-recipe keyboard confirmation preserves explicit false flags and display name',await page.evaluate(()=>MEAL_SLOT_STATE.main.recipeId==='audit-chili-beans'&&MEAL_SLOT_STATE.main.flags.hasBeans===false&&MEAL_SLOT_STATE.main.flags.hasDairy===true&&MEAL_SLOT_STATE.main.displayText==='Kitchen bean plate'),await page.evaluate(()=>MEAL_SLOT_STATE.main));
 // Gate-author additional safety probes: ambiguity never chooses first, rename confirmation follows stable ID.
 await setMain({recipeName:'Old Audit Bean Chili',recipeId:'audit-chili-beans',displayText:'Kitchen bean plate',flags:{hasBeans:false,hasDairy:true}});await page.evaluate(()=>slotSelect('main','Audit Chili Beans'));check('canonical renamed same-ID confirmation preserves flags and menu name',await page.evaluate(()=>MEAL_SLOT_STATE.main.recipeName==='Audit Chili Beans'&&MEAL_SLOT_STATE.main.recipeId==='audit-chili-beans'&&MEAL_SLOT_STATE.main.displayText==='Kitchen bean plate'&&MEAL_SLOT_STATE.main.flags.hasBeans===false&&MEAL_SLOT_STATE.main.flags.hasDairy===true));
 const kept={manual:'Keep this plate',flags:{hasDairy:true}};
 await setMain(kept,recipes.concat({...recipes[0],recipeName:'Audit duplicate ID'}));await page.evaluate(()=>slotSelect('main','Audit Chili Beans'));check('explicit selection refuses duplicate stable ID without replacing draft',JSON.stringify(await page.evaluate(()=>MEAL_SLOT_STATE.main))===JSON.stringify(kept));
 await setMain(kept,recipes.concat({...recipes[0],recipeId:'audit-second-name'}));await page.evaluate(()=>slotSelect('main','Audit Chili Beans'));check('explicit selection refuses duplicate name without replacing draft',JSON.stringify(await page.evaluate(()=>MEAL_SLOT_STATE.main))===JSON.stringify(kept));
 await page.evaluate(()=>slotAutoSave('main','Audit Chili Beans','enter'));check('exact typed selection refuses duplicate name without replacing draft',JSON.stringify(await page.evaluate(()=>MEAL_SLOT_STATE.main))===JSON.stringify(kept));
 check('no uncaught browser errors',errors.length===0,errors);
 fs.writeFileSync(path.join(dir,'editor-identity-picker-results.json'),JSON.stringify({source,results},null,2));
}finally{await browser.close()}
const failed=results.filter(x=>!x.pass);console.log(`${results.length-failed.length}/${results.length} passed`);process.exitCode=failed.length?1:0;
