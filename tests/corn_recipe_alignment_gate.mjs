// Corn recipe alignment, authored red on DOOR 81d7980, 2026-10-22.
// CODEX is the source. Nine regular/shared/halal ticks; eight vegan-only meals use
// their own recipe lookup. No clinical classification or resident snapshot.
// The fixture holds 21 meal contents and source records, never residents.
// Historical inputs are fixed; current export, sweep, overlay and plating behavior runs against them.
// Active menus and unrelated application bytes are not release-scope snapshots.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { liftCornDoor } from './helpers/corn_gate_runtime.mjs';
import { withBaggedNightshadesReview } from './helpers/bagged_curry_nightshades_review.mjs';
const read = f => JSON.parse(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'));
// Separate safety-review correction; the original Corn fixture is unchanged.
const F=withBaggedNightshadesReview(read('tests/fixtures/corn_recipe_alignment_2026-10-22.json'));
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'), R=liftCornDoor(html);
const menuArtifact=read('menu_current.json'), liveOverlay=read('menu_overlay.json');
const J=x=>JSON.parse(JSON.stringify(x));
const canon=v=>Array.isArray(v)?'['+v.map(canon).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}':JSON.stringify(v);
const eq=(a,b)=>canon(a)===canon(b);
const has=(list,f)=> (list||[]).some(a=>String(a).split(' (')[0].trim().toLowerCase()===f.toLowerCase());
const key=t=>[t.wk,t.day,t.period].join('|');
const hasToken=(s,f)=>String(s).split(',').some(x=>x.trim().toUpperCase()===f.toUpperCase());
const slot=d=>d?.main?.flags||{};
const fallback=J(R.fallback);
function putBack(weeks,which) {
  const out=J(weeks);
  for(const t of F.ticks) {
    const d=out[t.wk]?.[t.day], b=t.before[which];if(!d)continue;
    for(const [obj,value] of [[d[t.period+'_flags'],b.meal],[d[t.period+'_slots']?.main?.flags,b.main]]) {
      if(!obj)continue;if(value===null)delete obj.hasCorn;else obj.hasCorn=value;
    }
  }
  return out;
}
function expectedMenu() {
  const out={};
  for(const m of F.meals){out[m.wk] ||= {};out[m.wk][m.day] ||= {};Object.assign(out[m.wk][m.day],J(m.before));}
  for(const t of F.ticks){const d=out[t.wk][t.day];d[t.period+'_flags'].hasCorn=true;d[t.period+'_slots'].main.flags.hasCorn=true;}
  return out;
}
const bounded=expectedMenu();
const fixtureOverlay={...putBack(bounded,'menu'),_meta:{standardCutover:1783971058450,dayEditedAt:J(F.baselineDayStamps)}};
const fixturePublish=J(R.publishMenu(putBack(bounded,'menu'),fixtureOverlay,F.ticks));
const menu=fixturePublish.after, overlay=fixturePublish.saved;
// Synthetic test records, not real people. All routing stays DOOR's existing routing.
const person=(room,tags)=>({room,section:'Regular',tags,restrictions:[],allergenFlags:[],accommodations:tags.filter(t=>t==='No Corn'),preferences:[],avoidances:[],isAnaph:false,_tierMigrated:true});
const REG=[person('gate_regular',['No Corn']),person('gate_vegan',['Vegan','No Corn']),person('gate_halal',['Halal','No Corn']),person('gate_soft',['Soft Meals','No Corn']),person('gate_other',['No Fish']),person('gate_plain',[])];

// This independent current-data oracle deliberately has no fuzzy names, clinical
// inference, calendar pins, or population minima. An explicit unresolved ID must
// not fall back to a similarly named recipe or become an allergen-free result.
function boundSource(binding, sources) {
  const byId = typeof binding.recipeId === 'string' && binding.recipeId.trim();
  const rows = byId ? sources.filter(r => r.recipeId === binding.recipeId)
    : sources.filter(r => r.recipeName === binding.recipeName);
  if (rows.length !== 1) return { status: rows.length ? 'ambiguous' : 'unresolved' };
  if (!Array.isArray(rows[0].allergens)) return { status: 'unknown-allergens' };
  return { status: 'known', source: rows[0] };
}

test('current warning oracle resolves only exact unique identity and keeps unknown source facts explicit',()=>{
  const sources=[{recipeId:'corn-id',recipeName:'Corn test',allergens:['Corn (source)']},
    {recipeId:'plain-id',recipeName:'Plain test',allergens:['None']},
    {recipeName:'Duplicate',allergens:['Corn']},{recipeName:'Duplicate',allergens:['None']},
    {recipeName:'Unknown'}];
  assert.equal(boundSource({recipeId:'corn-id',recipeName:'Plain test'},sources).source.recipeId,'corn-id');
  assert.equal(boundSource({recipeName:'Corn test'},sources).status,'known');
  assert.equal(boundSource({recipeId:'retired-id',recipeName:'Corn test'},sources).status,'unresolved');
  assert.equal(boundSource({recipeName:'corn test'},sources).status,'unresolved','no guessed name normalization');
  assert.equal(boundSource({recipeName:'Duplicate'},sources).status,'ambiguous');
  assert.equal(boundSource({recipeName:'Unknown'},sources).status,'unknown-allergens');
});

test('current exact-bound Corn recipes retain their own warning floor wherever the meal moves',(t)=>{
  const regularSlots=new Set(['main','starch','vegside','xtra','extras']);
  const live=menuArtifact.menu, warnings=R.engine(live,null,REG).out, unresolved=[], checked=[];
  for(const [wk,days] of Object.entries(live)) for(const [day,meal] of Object.entries(days)) {
    for(const period of ['breakfast','lunch','dinner']) for(const [slotName,binding] of Object.entries(meal[period+'_slots']||{})) {
      if(!binding || typeof binding!=='object' || (!binding.recipeId&&!binding.recipeName))continue;
      const location=[wk,day,period,slotName].join('|'), found=boundSource(binding,fallback);
      if(found.status!=='known') { unresolved.push({location,status:found.status});continue; }
      if(!has(found.source.allergens,'Corn'))continue;
      if(regularSlots.has(slotName)) {
        assert.equal(binding.flags?.hasCorn,true,location+' exact source Corn must remain on its slot');
        assert.equal(meal[period+'_flags']?.hasCorn,true,location+' exact source Corn must remain on its regular/shared meal');
      } else if(slotName==='veganalt' || slotName==='halalalt') {
        const plate=slotName==='veganalt'?'veg':'halal';
        assert.ok(hasToken(warnings[[wk,day,period].join('|')]?.[plate],'CORN'),location+' exact source Corn must remain on its own plate');
      } else { unresolved.push({location,status:'unmapped-plate'});continue; }
      checked.push(location);
    }
  }
  t.diagnostic('Known current Corn bindings checked: '+checked.length+'. Unknown bindings are not asserted allergen-free: '+JSON.stringify(unresolved));
});

test('manifest measures nine regular/shared/halal ticks, eight vegan-only meals and 43 scoped fallback records',()=>{
  assert.equal(F.ticks.length,9);assert.equal(F.vegan.length,8);assert.equal(F.meals.length,21);
  assert.equal(F.fallbackDeltas.length,43);assert.equal(F.fallbackDeltas.filter(d=>!d.before).length,14);
  for(const t of [...F.ticks,...F.vegan])assert.ok(has(F.source.find(r=>r.recipeName===t.recipe)?.allergens,'Corn'),t.recipe+' lacks source Corn');
});
test('the fixed Corn meals export their meal ticks and main-slot copies',()=>{
  const missing=F.ticks.filter(t=>!menu[t.wk]?.[t.day]?.[t.period+'_flags']?.hasCorn||!slot(menu[t.wk]?.[t.day]?.[t.period+'_slots']).hasCorn);
  assert.deepEqual(missing.map(key),[]);
});
test('saving the fixed Corn overlay carries the edits with a newer day stamp',()=>{
  const missing=F.ticks.filter(t=>!overlay[t.wk]?.[t.day]?.[t.period+'_flags']?.hasCorn
    ||!slot(overlay[t.wk]?.[t.day]?.[t.period+'_slots']).hasCorn
    ||!(Number(overlay._meta?.dayEditedAt?.[t.wk+'|'+t.day])>Number(F.baselineDayStamps[t.wk+'|'+t.day]||0)));
  assert.deepEqual(missing.map(key),[]);
});
test('vegan-only Corn never becomes a regular meal tick; existing Corn and uncertain Teriyaki meal Sulphites stay',()=>{
  const at=t=>menu[t.wk][t.day];
  assert.deepEqual(F.vegan.filter(t=>at(t)[t.period+'_flags'].hasCorn||slot(at(t)[t.period+'_slots']).hasCorn).map(key),[]);
  for(const t of F.held)assert.equal(at(t)[t.period+'_flags'][t.flag],true,key(t)+' '+t.flag);
  assert.equal(menu['4'].THURSDAY.dinner_slots.veganalt.flags.hasSulphites,true,'existing tofu slot warning is not silently cleared');
});
test('a fresh tablet sweep preserves every regular/shared/halal Corn tick',()=>{
  const report=J(R.sweep(overlay));
  assert.deepEqual(report.details.filter(r=>F.ticks.some(t=>t.wk===r.week&&t.day===r.day&&t.period===r.period)&&r.dropped.includes('hasCorn')),[]);
});

test('normal overlay save and publish carry the nine flags and day stamps with unchanged generated allergen text',()=>{
  const before=putBack(bounded,'menu'),prior={...J(before),_meta:{standardCutover:overlay._meta.standardCutover,dayEditedAt:J(F.baselineDayStamps)}};
  const built=J(R.publishMenu(before,prior,F.ticks));
  assert.deepEqual(putBack(built.after,'menu'),built.before,'normal publish moves no other menu field');
  for(const t of F.ticks){
    assert.equal(built.after[t.wk][t.day][t.period+'_flags'].hasCorn,true,key(t));
    assert.equal(built.after[t.wk][t.day][t.period+'_slots'].main.flags.hasCorn,true,key(t)+' main');
    assert.equal(built.after[t.wk][t.day]['allergens_'+t.period],built.before[t.wk][t.day]['allergens_'+t.period],key(t)+' current export map');
    assert.ok(built.saved._meta.dayEditedAt[t.wk+'|'+t.day]>F.baselineDayStamps[t.wk+'|'+t.day],key(t)+' stamp');
  }
  assert.equal(built.side.length,1);assert.equal(built.side[0][0],'menu_overlay.json');
  assert.deepEqual(JSON.parse(built.side[0][1]),built.saved,'side publish is the exact stamped overlay');
});
// 2026-11-07 (Jason: the offline list follows CODEX). The offline list was refreshed from CODEX main 096ee08
// (2026-11-06; frozen in tests/fixtures/), so the Oct 22 exact records give way to "a faithful copy of CODEX".
const CODEX_FROZEN=read('tests/fixtures/codex_door_recipe_data_2026-11-06_096ee08.json');
test('offline fallback is a faithful copy of CODEX for every recipe CODEX has, and the Corn recipes still say Corn',()=>{
  const byName=new Map(CODEX_FROZEN.map(r=>[r.recipeName,r]));
  const wrong=fallback.filter(r=>byName.has(r.recipeName)&&!eq(r,byName.get(r.recipeName)));
  assert.deepEqual(wrong.map(r=>r.recipeName),[]);
  const corn=F.fallbackDeltas.filter(d=>has(d.after?.allergens,'Corn')&&has(byName.get(d.recipeName)?.allergens,'Corn'));
  assert.ok(corn.length>0,'the Oct 22 Corn recipes are still checked');
  for(const d of corn)assert.ok(has(fallback.find(r=>r.recipeName===d.recipeName)?.allergens,'Corn'),d.recipeName+' says Corn offline');
});
test('offline fallback names remain unique',()=>{
  assert.equal(new Set(fallback.map(r=>r.recipeName)).size,fallback.length,'no duplicate fallback names');
});
// 2026-11-07: "the paired CODEX feed is the canonical source…" compared DOOR with whichever CODEX copy sat beside it, so it
// failed on every CODEX change (Jason: make it an advisory report). See tests/advisory/codex_offline_drift.mjs.
// Re-pinned 2026-11-09 (v31-standard.61, bare side words; Jason: "spin up a session for #2"). The Oct 22 receipt gave
// W1 and W2 SUN dinner Corn from "Vegan Baked Pasta", but neither meal ever served it: their vegan lines were then, and
// are now, "Mushroom Stroganoff, Pasta" and "Vegan Sausage and Vegetable Pasta, Pasta". The bare word "Pasta" matched
// Vegan Baked Pasta by name, the bug this build fixes. Neither meal is checked for Corn any more; the other six keep
// the original check. W1 SUN must now read none. W2 SUN is not asserted here: in this fixture 21-record source Vegan
// Sausage is absent, so its full name still shares two words with Vegan Baked Pasta; on the whole CODEX feed it reads
// no Corn (tests/bare_side_word_gate.mjs check 2). The frozen fixture is unchanged.
const NOT_SERVED=new Set(['1|SUNDAY|dinner','2|SUNDAY|dinner']);
test('the six vegan-only Corn meals read Corn online and on a fresh offline tablet, with no regular tick; W1 SUN dinner reads none',()=>{
  const online=R.engine(bounded,F.source,REG).out,offline=R.engine(bounded,null,REG).out;
  assert.equal(F.vegan.filter(t=>NOT_SERVED.has(key(t))).length,2,'both re-pinned meals are in the frozen list');
  for(const t of F.vegan.filter(t=>key(t)==='1|SUNDAY|dinner')) {
    assert.ok(!hasToken(online[key(t)].veg,'CORN'),key(t)+' online: no Corn from a bare "Pasta"');
    assert.ok(!hasToken(offline[key(t)].veg,'CORN'),key(t)+' offline: no Corn from a bare "Pasta"');
  }
  for(const t of F.vegan.filter(t=>!NOT_SERVED.has(key(t)))) {
    assert.equal(bounded[t.wk][t.day][t.period+'_flags'].hasCorn,false,key(t)+' regular tick');
    assert.ok(hasToken(online[key(t)].veg,'CORN'),key(t)+' online');
    assert.ok(hasToken(offline[key(t)].veg,'CORN'),key(t)+' offline');
  }
});
test('synthetic No Corn routing and other residents keep their existing seats; only Corn warning text can be added',()=>{
  const regBefore=canon(REG);
  const before=putBack(bounded,'menu'),sourceBefore=F.source.map(r=>({...r,allergens:r.allergens.filter(a=>!has([a],'Corn'))}));
  const old=R.engine(before,sourceBefore,REG).out,now=R.engine(bounded,F.source,REG).out;
  const strip=s=>String(s||'').split(/ · |, /).filter(x=>x.toLowerCase()!=='no corn').join(' · ');
  let warnings=0;
  for(const k of Object.keys(old)) {
    assert.deepEqual(now[k].seat,old[k].seat,k+' seating');
    for(const id of REG.map(r=>r.room)) {
      assert.equal(strip(now[k].notes[id]),strip(old[k].notes[id]),k+' non-Corn note');
      if(/no corn/i.test(now[k].notes[id]||''))warnings++;
    }
    for(const plate of ['veg','halal'])assert.deepEqual(
      String(now[k][plate]).split(',').map(x=>x.trim()).filter(x=>x&&x!=='CORN').sort(),
      String(old[k][plate]).split(',').map(x=>x.trim()).filter(x=>x&&x!=='CORN').sort(),k+' other plate families');
  }
  assert.ok(warnings>0,'No Corn still produces a serving warning');
  assert.equal(REG.length,6);assert.equal(canon(REG),regBefore,'routing never mutates resident data');
});
// 2026-11-07: "offline source additions expose only the two declared extra-family lines…" was the Oct 22 refresh's own receipt.
// The offline list now follows CODEX whole (Jason, 2026-11-07); the copy check above replaces it.

test('shared overlays preserve the base Corn warning, add the bagged sauce, and require the Teriyaki removal stamp',()=>{
  const peas=F.source.find(r=>r.recipeName==='Peas and Corn'),stale=J(F.shared.find(s=>s.record.recipeName===peas.recipeName).record);
  const old=J(R.core.doorOverlaySharedRecipes([peas],{recipes:[stale]}));
  assert.ok(has(old.list[0].allergens,'Corn'));assert.ok(!old.list[0].allergens.includes('None'));
  const sauce=F.shared.find(s=>/Bagged/.test(s.record.recipeName));
  const corrected={...J(sauce.record),allergens:sauce.after,door:{...sauce.record.door,allergens:sauce.after}};
  const original=JSON.stringify(corrected),out=J(R.core.doorOverlaySharedRecipes([peas],{recipes:[corrected]}));
  assert.ok(has(out.list[1].allergens,'Corn')&&has(out.list[1].allergens,'Sulphites'));
  assert.equal(out.list[1].recipeId,sauce.record.door.recipeId);assert.equal(JSON.stringify(corrected),original);
  const prior=F.fallbackDeltas.find(d=>d.recipeName===F.teriyaki.recipeName).before;
  const clean={...F.source.find(r=>r.recipeName===F.teriyaki.recipeName)};
  const unconfirmed=J(R.core.doorOverlaySharedRecipes([prior],{recipes:[{recipeName:clean.recipeName,door:clean}]}));
  assert.ok(has(unconfirmed.list[0].allergens,'Sulphites'));
  const confirmed=J(R.core.doorOverlaySharedRecipes([prior],{recipes:[{recipeName:clean.recipeName,door:{...clean,removedAllergens:['Sulphites']}}]}));
  assert.ok(!has(confirmed.list[0].allergens,'Sulphites')&&has(confirmed.list[0].allergens,'Soy')&&has(confirmed.list[0].allergens,'Gluten'));
});
test('the five published artifacts are one valid publish; Corn fixes do not splice a separate registry or routing file',()=>{
  const arts={'menu_current.json':menuArtifact,'menu_overlay.json':liveOverlay,'door_state.json':read('door_state.json'),'routing_by_meal.json':read('routing_by_meal.json'),'registry_summary.json':read('registry_summary.json')};
  const v=R.core.validateDoorPublishArtifacts(arts,{});
  assert.equal(v.counts.Stop,0,'publish validation Stop');assert.equal(v.counts.Review,0,'publish validation Review');
  const h=R.core.doorContentHash(menuArtifact.menu);
  for(const f of ['door_state.json','routing_by_meal.json','registry_summary.json'])assert.equal(arts[f]._meta.builtFromMenu?.hash,h,f+' built from this menu');
});

