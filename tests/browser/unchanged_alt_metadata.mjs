// Frozen regression: editing a side must not rewrite an untouched plain/soft alternative.
// Authored after D1 independent review exposed soft -> plain and dropped Fish facts.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import{createRequire}from'node:module';import{pathToFileURL}from'node:url';
const root=process.cwd(),source=path.resolve(process.env.DOOR_GATE_HTML||'index.html');
let pw;try{pw=await import('playwright');}catch{pw=createRequire(path.join(root,'../conc-kitchen-expo/package.json'))('playwright');}
const chromium=pw.chromium||pw.default?.chromium;
const evidenceDir=path.resolve(process.env.DOOR_GATE_OUTPUT||path.join(root,'outputs/staff-baseline-20261117/gates'));fs.mkdirSync(evidenceDir,{recursive:true});
const menu=JSON.parse(fs.readFileSync('menu_current.json')).menu;
const alt={text:'Plain Fish, Rice, Carrot',type:'soft',flags:{hasFish:true,hasMustard:true},reviewNote:'Retain preparation note',evidence:{revision:'fixture-1',unknownAdditive:{kept:true}}};
const day=menu['3'].WEDNESDAY;
Object.assign(day,{lunch:'Beef Nachos, Tortilla Chips, Sour Cream',lunch_veg:'Vegan Nachos, Tortilla Chips, Sour Cream',lunch_mainItem:'Beef Nachos',lunch_sides:'Tortilla Chips, Sour Cream',lunch_flags:{hasBeef:true,hasDairy:true,hasCorn:true,halalCertifiedMeat:true},lunch_altMeals:[structuredClone(alt)],lunch_altMealsNone:false,lunch_softAlt:alt.text,lunch_slots:{main:{manual:'Beef Nachos',flags:{hasBeef:true}},veganalt:{manual:'Vegan Nachos',flags:{}},starch:{manual:'Tortilla Chips',flags:{hasCorn:true}},xtra:{manual:'Sour Cream',flags:{hasDairy:true}}}});
const browser=await chromium.launch(),results=[];
function check(name,condition,actual){results.push({name,pass:!!condition,actual});console.log((condition?'PASS ':'FAIL ')+name+(condition?'':' '+JSON.stringify(actual)));}
try{const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,r=>r.abort());await page.addInitScript(menu=>{localStorage.setItem('concUploadedMenu',JSON.stringify(menu));localStorage.setItem('concMenuBase',JSON.stringify({}));localStorage.setItem('concAltFlagSweepV1','done');window.Chart=function(){return{destroy(){},update(){}}}},menu);await page.goto(pathToFileURL(source).href);await page.waitForFunction(()=>typeof openMenuEdit==='function');await page.evaluate(()=>{showScreen('menu-config');openMenuEdit('3','WEDNESDAY','lunch')});await page.locator('[data-slot-line="xtra-vegan"]').selectOption('none');await page.evaluate(()=>{window.__saveDone=false;saveMenuEdit().then(()=>window.__saveDone=true)});
for(let i=0;i<15;i++){const q=page.locator('.door-ask');if(await q.count()){const t=await q.innerText();assert.match(t,/More than one dish|Keep the meal|No soft or plain/,'unexpected question');await q.locator('.door-ask-go').click()}else if(await page.locator('#_halal-yes').count())await page.locator('#_halal-yes').click();else if(await page.evaluate(()=>window.__saveDone))break;else await page.waitForTimeout(100)}
const actual=await page.evaluate(()=>{const day=getMenuData()['3'].WEDNESDAY;return{done:window.__saveDone,alt:day.lunch_altMeals,exported:buildMenuJSON().menu['3'].WEDNESDAY.lunch_altMeals,soft:day.lunch_softAlt,vegan:day.lunch_veg}});
check('normal side edit saved',actual.done&&!actual.vegan.includes('Sour Cream'),actual);
check('untouched alternative retains soft preparation type',actual.alt[0]?.type==='soft',actual.alt);
check('untouched alternative retains declared Fish and Mustard facts',actual.alt[0]?.flags?.hasFish===true&&actual.alt[0]?.flags?.hasMustard===true,actual.alt);
check('untouched alternative retains additive note/evidence metadata',actual.alt[0]?.reviewNote===alt.reviewNote&&JSON.stringify(actual.alt[0]?.evidence)===JSON.stringify(alt.evidence),actual.alt);
check('normal exporter preserves the complete unchanged alternative',JSON.stringify(actual.exported)===JSON.stringify([alt]),actual.exported);
check('soft legacy text remains unchanged',actual.soft===alt.text,actual.soft);
const states=await page.evaluate(()=>{const overlay=loadMenuBaseOverlay();overlay['3'].WEDNESDAY.lunch_altMeals=[];overlay['3'].WEDNESDAY.lunch_softAlt='Stale legacy soft text';saveMenuBaseOverlay(overlay);openMenuEdit('3','WEDNESDAY','lunch');const empty=structuredClone(ALT_MEALS);const legacy=loadMenuBaseOverlay();delete legacy['3'].WEDNESDAY.lunch_altMeals;saveMenuBaseOverlay(legacy);const base=JSON.parse(localStorage.getItem('concUploadedMenu'));delete base['3'].WEDNESDAY.lunch_altMeals;localStorage.setItem('concUploadedMenu',JSON.stringify(base));openMenuEdit('3','WEDNESDAY','lunch');return{empty,legacy:structuredClone(ALT_MEALS)};});
check('explicit empty array does not resurrect stale legacy soft plate',states.empty.length===0,states.empty);
check('legacy soft text remains supported when no structured array exists',states.legacy[0]?.text==='Stale legacy soft text',states.legacy);
check('no browser errors',!errors.length,errors);
fs.writeFileSync(path.join(evidenceDir,'unchanged-alt-results.json'),JSON.stringify({results},null,2));
}finally{await browser.close()}
console.log(results.filter(x=>x.pass).length+'/'+results.length+' passed');process.exitCode=results.some(x=>!x.pass)?1:0;
