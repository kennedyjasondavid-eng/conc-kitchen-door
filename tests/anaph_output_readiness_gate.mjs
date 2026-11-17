// A1: an unnamed separate plate cannot become a standard-meal fallback or a partial final workbook.
// ANAPH_OUTPUT_HTML permits authored-to-fail verification against the pre-change source.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(process.env.ANAPH_OUTPUT_HTML || new URL('../index.html', import.meta.url), 'utf8');
function fn(name) {
  const m = new RegExp('\\n(?:async )?function ' + name + '\\(').exec(html);
  assert.ok(m, 'Missing safeguard ' + name);
  const start = m.index + 1, end = html.indexOf('\n}\n', start);
  return html.slice(start, end + 3);
}
const copy = x => JSON.parse(JSON.stringify(x));
function fixture(dish = '') {
  return {dayLabel:'Monday', periodLabel:'Dinner', mealName:'Peanut chicken curry', mealFlags:{hasPeanuts:true},
    anaphSect:[{room:'607a', _role:'anaphylactic'}, {room:'607b', _role:'roommate', _anaph_room:'607a'}],
    ctx:{anaphAlt:dish}, conflictRooms:new Set(['607a','607b']), sections:[], regCount:0, halalCount:0, veganCount:0, diabCount:0};
}
function box(names = []) {
  const writes = [], books = [];
  const ctx = {console, Set, getAnaphDisplayAllergens:()=>['No Peanuts'],
    escapeHtml:s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;'), doorIcon:()=>'', REGISTRY_LIST:[],
    computePlatingData:()=>fixture(), alert:msg=>writes.push(msg),
    XLSX:{utils:{book_new:()=>{const b={SheetNames:[]}; books.push(b); return b;},book_append_sheet:(b,w,n)=>b.SheetNames.push(n)},writeFile:()=>writes.push('WRITE')},
    buildDaySheet:()=>({ws:{},tabName:'Monday'}), writes, books};
  vm.createContext(ctx);
  vm.runInContext(['doorAssessAnaphAlternative','doorAnaphAlternativeLine','doorRotationServices','doorPlatingReadiness',
    'doorPlatingReadinessText','doorRequirePlatingReady','doorReportPlatingError',...names].map(fn).join('\n'),ctx);
  return ctx;
}
test('missing/whitespace names remain unresolved with exact affected rooms; standard dish never substituted',()=>{
  const c=box();
  for(const dish of ['', '  ']) {
    const a=c.doorAssessAnaphAlternative(fixture(dish));
    assert.equal(a.state,'missing'); assert.deepEqual(copy(a.rooms),['607a','607b']);
    assert.match(c.doorAnaphAlternativeLine(fixture(dish)),/UNRESOLVED/);
    assert.doesNotMatch(c.doorAnaphAlternativeLine(fixture(dish)),/Peanut chicken|prepared separately/);
  }
  assert.equal(c.doorAssessAnaphAlternative({...fixture(),anaphSect:[]}).state,'not-required');
  assert.equal(c.doorAssessAnaphAlternative(fixture('Basa, modified vegetables')).state,'named');
  assert.doesNotMatch(JSON.stringify(c.doorAssessAnaphAlternative(fixture('Basa'))),/approved|verified/);
});
test('every service is preflighted before a final workbook is created; no partial week or combined breakfast',()=>{
  const c=box(['buildPlatingXlsx','buildBreakfastCombinedXlsx','downloadPlatingSheet']);
  const calls=[];
  c.computePlatingData=(p,w,d)=>{calls.push([p,w,d]); return fixture(d==='WEDNESDAY'?'':'Chicken Leg, vegetables');};
  assert.throws(()=>c.buildPlatingXlsx('dinner',1),/W1 WEDNESDAY dinner.*607a, 607b/);
  assert.equal(calls.length,7); assert.equal(c.books.length,0);
  calls.length=0;
  assert.throws(()=>c.buildBreakfastCombinedXlsx(1,3),/W3 WEDNESDAY breakfast/);
  assert.equal(calls.length,14); assert.equal(c.books.length,0);
  c.computePlatingData=()=>fixture('Chicken Leg, vegetables');
  assert.equal(c.buildPlatingXlsx('dinner',1).SheetNames.length,7);
  assert.equal(c.buildBreakfastCombinedXlsx(1,3).SheetNames.length,14);
});
test('unavailable service and build exceptions abort the whole workbook',()=>{
  const c=box(['buildPlatingXlsx']);
  c.computePlatingData=()=>null;
  assert.throws(()=>c.buildPlatingXlsx('lunch',2),/Could not assess this meal/);
  c.computePlatingData=()=>fixture('Chicken Leg');
  let n=0; c.buildDaySheet=()=>{if(++n===3) throw Error('broken cell'); return {ws:{},tabName:'day'+n};};
  assert.throws(()=>c.buildPlatingXlsx('lunch',2),/broken cell/);
  assert.deepEqual(c.writes,[]);
});
test('ZIP preflight refuses missing alternative before building or serializing anything',async()=>{
  const c=box(['downloadAllFiles']); let built=0, serialized=0;
  c.document={getElementById:()=>null}; c.JSZip=class {file(){serialized++;} generateAsync(){throw Error('must not serialize');}};
  c.buildAllFileList=()=>{built++;return[];}; c.showToast=()=>{};
  await c.downloadAllFiles();
  assert.equal(built,0); assert.equal(serialized,0); assert.match(c.writes[0],/Plating NOT READY/);
});
test('ZIP builder failure aborts the complete set without a download or a success count',async()=>{
  const c=box(['downloadAllFiles']); let serialized=0, downloaded=0;
  c.computePlatingData=()=>fixture('Chicken Leg'); c.document={getElementById:()=>null,createElement:()=>({click(){downloaded++;}})};
  c.JSZip=class {file(){serialized++;} generateAsync(){throw Error('must not serialize');}};
  c.buildAllFileList=()=>[{name:'good.xlsx',fn:()=>({})},{name:'bad.xlsx',fn:()=>{throw Error('broken day');}}];
  c.showToast=()=>{}; await c.downloadAllFiles();
  assert.equal(serialized,0); assert.equal(downloaded,0); assert.match(c.writes[0],/broken day/);
});
test('HTML draft warning and unresolved meal line survive printing; ordinary print refuses unresolved',()=>{
  const c=box(['buildPlatingHtml','printPlatingPreview']); c.REGISTRY_LIST=[];
  const output=c.buildPlatingHtml(fixture(),false);
  assert.match(output,/DRAFT \/ NOT FOR SERVICE/); assert.match(output,/Rooms 607a, 607b/);
  assert.doesNotMatch(output,/Peanut chicken curry — prepared separately/);
  let printed=0,rendered=0; c.window={print(){printed++;}}; c.renderPlatingPreview=()=>rendered++;
  Object.assign(c,{psPeriod:'dinner',psWeek:1,psDay:'MONDAY'}); c.printPlatingPreview();
  assert.equal(rendered,1); assert.equal(printed,0); assert.match(c.writes[0],/Print NOT READY/);
  c.computePlatingData=()=>fixture('Basa, vegetables'); c.printPlatingPreview(); assert.equal(printed,1);
});
test('projected assessment passes explicit registry/list rather than temporarily changing live state',()=>{
  const c=box(), seen=[]; const projected={residents:[{room:'213'}],anaphRooms:['213']};
  c.computePlatingData=(p,w,d,r,a)=>{seen.push([r,a]);return fixture();};
  c.doorPlatingReadiness([{period:'dinner',week:1,day:'MONDAY'}],projected);
  assert.equal(seen[0][0],projected.residents); assert.equal(seen[0][1],projected.anaphRooms);
  assert.deepEqual(c.REGISTRY_LIST,[]);
});

function transitionBox() {
  const c=box(['doorAnaphAnswerTransition','doorRegistryQueueTransition','doorProjectRegistryQueue','applyQueueToRegistry']);
  Object.assign(c,{anaphRooms:['213'],REGISTRY_MAP:{},changesQueue:[],TAG_LABELS_MAP:{noCoconut:'No Coconut',soft:'Soft Meals'},
    ROUTING_TAGS:new Set(),ALLERGEN_TAGS:new Set(['No Coconut']),ACCOMMODATION_TAGS:new Set(['Soft Meals']),
    requiresDocumentation:()=>false,filterServiceNote:(a,b)=>a||b||'',dedupeServiceNote:(a,b)=>[a,b].filter(Boolean).join('; '),
    getOperatorName:()=>'Test operator',pushResidentHistory:()=>c.writes.push('HISTORY'),clearResidentHistory:()=>c.writes.push('CLEAR'),
    doorApplyPendingImportStamp:()=>c.writes.push('STAMP'),saveRegistryState:()=>c.writes.push('SAVE'),setRegistryProvenance:()=>c.writes.push('NEWEST'),
    localStorage:{setItem:()=>c.writes.push('STORAGE')},REGISTRY_LIST:[{room:'213',tags:['Soft Meals','No Coconut'],anaphTags:['noCoconut'],isAnaph:false,serviceNote:'No popcorn'}]});
  return c;
}
test('shared projection matches commit for updates, moves, discharges and explicit answers without side effects',()=>{
  const c=transitionBox();
  c.changesQueue=[{type:'update',room:'213',tags:{soft:true,noCoconut:true},route:'Soft Meals'},
    {type:'switch',room:'213',route:'→ 214'}, {type:'intake',room:'900',tags:{},route:'Regular'},
    {type:'intake',room:'901',tags:{},route:'Regular'}, {type:'discharge',room:'901'}];
  const before=copy({residents:c.REGISTRY_LIST,anaphRooms:c.anaphRooms,queue:c.changesQueue});
  const projected=c.doorProjectRegistryQueue(c.changesQueue);
  assert.deepEqual(copy({residents:c.REGISTRY_LIST,anaphRooms:c.anaphRooms,queue:c.changesQueue}),before);
  assert.deepEqual(c.writes,[]);
  assert.deepEqual(copy(projected.anaphRooms),['214']);
  assert.deepEqual(copy(projected.residents.map(r=>r.room)),['214','900']);
  c.applyQueueToRegistry();
  assert.deepEqual(copy(c.REGISTRY_LIST),copy(projected.residents));
  assert.deepEqual(copy(c.anaphRooms),copy(projected.anaphRooms));
  assert.ok(c.writes.includes('SAVE'));
  const off=c.doorProjectRegistryQueue([], [{room:'214',off:true}]);
  assert.deepEqual(copy(off.anaphRooms),[]); assert.equal(off.residents[0].isAnaph,false);
  assert.deepEqual(copy(c.anaphRooms),['214']);
});
function generateBox(proceed) {
  const c=transitionBox(); vm.runInContext(fn('generateFiles'),c);
  const store={},elements={}; const el=id=>elements[id]||(elements[id]={textContent:'',style:{},querySelector:()=>({checked:true})});
  Object.assign(c,{_doorGenerateBusy:false,ensureOperatorName:()=>true,doorAskGenerateWithoutKitchenList:async()=>true,
    doorTakeNewerKitchenList:async()=>{},doorAskDischargedAnaphRooms:async()=>{},doorAskAnaphRoomsNamingNoAllergen:async()=>[],
    doorAsk:async q=>{c.asked.push(q);return proceed;},asked:[],document:{getElementById:el,querySelector:()=>el('publish')},
    localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=v;c.writes.push(k);},removeItem:k=>{delete store[k];c.writes.push('REMOVE '+k);}},
    RECENT_LOG:[],showScreen:()=>{},updateRevertButton:()=>{},renderQueue:()=>{},updateBadge:()=>{},saveRecentLog:()=>{},
    populateRecentGenerated:()=>{},updateGeneratedIndicator:()=>{},updateDailyImportPrompt:()=>{},PublishAuth:{getSavedToken:()=>true,isExpired:()=>false},
    publishAndSync:()=>c.writes.push('PUBLISH'),updateSyncBar:()=>{},elements,store});
  c.changesQueue=[{type:'intake',room:'900',tags:{},tagLabels:[],route:'Regular'}];
  return c;
}
test('Generate cancel preserves queue, residents, logs and snapshot; save proceeds despite unresolved documents',async()=>{
  const cancel=generateBox(false), before=copy(cancel.REGISTRY_LIST),queue=copy(cancel.changesQueue);
  await cancel.generateFiles();
  assert.deepEqual(cancel.writes,[]); assert.deepEqual(copy(cancel.REGISTRY_LIST),before);
  assert.deepEqual(copy(cancel.changesQueue),queue); assert.deepEqual(cancel.RECENT_LOG,[]);
  assert.equal(cancel._doorGenerateBusy,false); assert.match(cancel.asked[0].title,/NOT READY/);
  const save=generateBox(true); await save.generateFiles();
  assert.equal(save.REGISTRY_LIST.length,2); assert.equal(save.changesQueue.length,0); assert.equal(save.RECENT_LOG.length,1);
  assert.ok(save.writes.includes('concRegistrySnapshot')); assert.ok(save.writes.includes('PUBLISH'));
  assert.match(save.elements['confirm-sub'].textContent,/residents saved.*Plating NOT READY/);
  assert.doesNotMatch(save.elements['confirm-sub'].textContent,/14 files updated/);
  assert.deepEqual(copy(save.anaphRooms),['213']);
});
