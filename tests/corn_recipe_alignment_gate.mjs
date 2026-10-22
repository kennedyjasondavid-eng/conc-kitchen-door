// Corn recipe alignment, authored red on DOOR 81d7980, 2026-10-22.
// CODEX is the source. Nine regular/shared/halal ticks; eight vegan-only meals use
// their own recipe lookup. No clinical classification or resident snapshot.
// The fixture holds 21 meal contents and source records, never residents.
// Metadata timestamps may change; source/menu content outside the declared Corn
// delta may not. Refresh this fixture only after reviewing a later owning edit.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { liftCornDoor } from './helpers/corn_gate_runtime.mjs';
import { withBaggedNightshadesReview } from './helpers/bagged_curry_nightshades_review.mjs';
const read = f => JSON.parse(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'));
// Separate safety-review correction; the original Corn fixture is unchanged.
const F=withBaggedNightshadesReview(read('tests/fixtures/corn_recipe_alignment_2026-10-22.json'));
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'), R=liftCornDoor(html);
const menuArtifact=read('menu_current.json'), menu=menuArtifact.menu, overlay=read('menu_overlay.json');
const J=x=>JSON.parse(JSON.stringify(x));
const canon=v=>Array.isArray(v)?'['+v.map(canon).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}':JSON.stringify(v);
const hash=v=>crypto.createHash('sha256').update(canon(v)).digest('hex');
const eq=(a,b)=>canon(a)===canon(b);
const has=(list,f)=> (list||[]).some(a=>String(a).split(' (')[0].trim().toLowerCase()===f.toLowerCase());
const key=t=>[t.wk,t.day,t.period].join('|');
const omitMeta=o=>Object.fromEntries(Object.entries(o).filter(([k])=>k!=='_meta'));
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
// Synthetic test records, not real people. All routing stays DOOR's existing routing.
const person=(room,tags)=>({room,section:'Regular',tags,restrictions:[],allergenFlags:[],accommodations:tags.filter(t=>t==='No Corn'),preferences:[],avoidances:[],isAnaph:false,_tierMigrated:true});
const REG=[person('gate_regular',['No Corn']),person('gate_vegan',['Vegan','No Corn']),person('gate_halal',['Halal','No Corn']),person('gate_soft',['Soft Meals','No Corn']),person('gate_other',['No Fish']),person('gate_plain',[])];

test('manifest measures nine regular/shared/halal ticks, eight vegan-only meals and 43 scoped fallback records',()=>{
  assert.equal(F.ticks.length,9);assert.equal(F.vegan.length,8);assert.equal(F.meals.length,21);
  assert.equal(F.fallbackDeltas.length,43);assert.equal(F.fallbackDeltas.filter(d=>!d.before).length,14);
  for(const t of [...F.ticks,...F.vegan])assert.ok(has(F.source.find(r=>r.recipeName===t.recipe)?.allergens,'Corn'),t.recipe+' lacks source Corn');
});
test('nine published meal ticks and their main-slot copies name Corn',()=>{
  const missing=F.ticks.filter(t=>!menu[t.wk]?.[t.day]?.[t.period+'_flags']?.hasCorn||!slot(menu[t.wk]?.[t.day]?.[t.period+'_slots']).hasCorn);
  assert.deepEqual(missing.map(key),[]);
});
test('the shared menu overlay carries the same Corn edits with a newer day stamp',()=>{
  const missing=F.ticks.filter(t=>!overlay[t.wk]?.[t.day]?.[t.period+'_flags']?.hasCorn
    ||!slot(overlay[t.wk]?.[t.day]?.[t.period+'_slots']).hasCorn
    ||!(Number(overlay._meta?.dayEditedAt?.[t.wk+'|'+t.day])>Number(F.baselineDayStamps[t.wk+'|'+t.day]||0)));
  assert.deepEqual(missing.map(key),[]);
});
test('vegan-only Corn never becomes a regular meal tick; existing Corn and uncertain Teriyaki meal Sulphites stay',()=>{
  assert.deepEqual(F.vegan.filter(t=>menu[t.wk][t.day][t.period+'_flags'].hasCorn||slot(menu[t.wk][t.day][t.period+'_slots']).hasCorn).map(key),[]);
  for(const t of F.held)assert.equal(menu[t.wk][t.day][t.period+'_flags'][t.flag],true,key(t)+' '+t.flag);
  assert.equal(menu['4'].THURSDAY.dinner_slots.veganalt.flags.hasSulphites,true,'existing tofu slot warning is not silently cleared');
});
test('putting back only the nine Corn booleans recovers every menu/overlay content field',()=>{
  assert.equal(hash(putBack(menu,'menu')),F.digests.menuBefore,'menu content moved beyond the Corn ticks');
  assert.equal(hash(omitMeta(putBack(overlay,'overlay'))),F.digests.overlayBefore,'overlay content moved beyond the Corn ticks');
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
test('all DOOR app bytes outside scoped fallback, release version and exact public-reader transport stay unchanged',()=>{
  // 2026-10-22: Jason authorized the recipe-only Pages projection because private
  // raw reads return 404. Reviewed index.html diff: one URL and two explanatory
  // comments only. Undo those EXACT lines for the original Corn digest; do not
  // refresh that digest or exempt the loader/overlay implementation from review.
  const transport=[
    ["const DOOR_SHARED_LIBRARY_URL = 'https://kennedyjasondavid-eng.github.io/conc-recipe-hub/library_public.json';",
      "const DOOR_SHARED_LIBRARY_URL = 'https://raw.githubusercontent.com/kennedyjasondavid-eng/conc-recipe-hub/shared-library/library_shared.json';"],
    ["// CODEX's private shared Library. Pages delivers its recipe-only library_public.json projection. DOOR reads that",
      "// CODEX's shared Library (library_shared.json on the conc-recipe-hub `shared-library` branch). DOOR reads that"],
    ['  // Cache-busted AND no-store (HOUSE_PROVEN_SEAMS row 2); public delivery follows the private save asynchronously.',
      '  // Cache-busted AND no-store (HOUSE_PROVEN_SEAMS row 2); the raw CDN can still hold a copy for ~5 min.']
  ];
  let normal=html.replace(/\r\n/g,'\n');
  for(const [current,prior] of transport){
    assert.equal(normal.split(current).length-1,1,'expected exactly one authorized transport line: '+current);
    normal=normal.replace(current,prior);
  }
  normal=normal.replace(/const DOOR_RECIPE_DATA_FALLBACK = [^\n]+/,'const DOOR_RECIPE_DATA_FALLBACK = <scoped fixture>;').replace(/const DOOR_APP_VERSION = '[^']+';/,"const DOOR_APP_VERSION = '<release>';");
  assert.equal(crypto.createHash('sha256').update(normal).digest('hex'),F.digests.htmlOutsideFallback);
});
test('offline fallback has the 42 Corn sources and corrected Teriyaki; source labels and all other fields are exact',()=>{
  const wrong=F.fallbackDeltas.filter(d=>!eq(fallback.find(r=>r.recipeName===d.recipeName),d.after));
  assert.deepEqual(wrong.map(d=>d.recipeName),[]);
});
test('fallback put-back preserves all 131 prior records, their order and every unrelated warning',()=>{
  const additions=new Set(F.fallbackDeltas.filter(d=>!d.before).map(d=>d.recipeName));
  const by=new Map(F.fallbackDeltas.filter(d=>d.before).map(d=>[d.recipeName,d]));
  const restored=fallback.filter(r=>!additions.has(r.recipeName)).map(r=>{
    const d=by.get(r.recipeName),out=d?{...r,allergens:d.before.allergens}:{...r};
    if(r.recipeName===F.fallbackStreamCorrection.recipeName)out.stream=F.fallbackStreamCorrection.before;
    return out;
  });
  assert.equal(hash(restored),F.digests.fallbackBefore);
  assert.equal(new Set(fallback.map(r=>r.recipeName)).size,fallback.length,'no duplicate fallback names');
});
test('the paired CODEX feed is the canonical source for the scoped fallback list',()=>{
  const url=new URL('../../conc-recipe-hub/DOOR_RECIPE_DATA.json',import.meta.url);
  // CI without a paired source still verifies all exact source-derived fallback records above.
  if(!fs.existsSync(url))return;
  const feed=JSON.parse(fs.readFileSync(url,'utf8'));
  const sharedNames=new Set(F.shared.map(s=>s.record.recipeName));
  const wrong=F.source.filter(r=>!(sharedNames.has(r.recipeName)&&!feed.some(x=>x.recipeName===r.recipeName)))
    .filter(r=>!eq(feed.find(x=>x.recipeName===r.recipeName),r));
  assert.deepEqual(wrong.map(r=>r.recipeName),[]);
});
test('all eight vegan-only meals read Corn online and on a fresh offline tablet, with no regular tick',()=>{
  const online=R.engine(bounded,F.source,REG).out,offline=R.engine(bounded,null,REG).out;
  for(const t of F.vegan) {
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
test('offline source additions expose only the two declared extra-family lines; no other family changes',()=>{
  const ds=new Map(F.fallbackDeltas.map(d=>[d.recipeName,d]));
  const before=fallback.filter(r=>!ds.has(r.recipeName)||ds.get(r.recipeName).before).map(r=>{
    const d=ds.get(r.recipeName);return d?d.before:r;
  });
  const priorHtml=html.replace(/const DOOR_RECIPE_DATA_FALLBACK = [^\n]+/,'const DOOR_RECIPE_DATA_FALLBACK = '+JSON.stringify(before)+';');
  const old=liftCornDoor(priorHtml).engine(bounded,null,REG).out,now=R.engine(bounded,null,REG).out;
  const tokens=s=>String(s).split(',').map(x=>x.trim()).filter(Boolean),deltas=[];
  for(const meal of Object.keys(old))for(const plate of ['veg','halal']){
    const a=tokens(old[meal][plate]),b=tokens(now[meal][plate]);
    const added=b.filter(t=>!a.includes(t)&&t!=='CORN').sort(),removed=a.filter(t=>!b.includes(t)&&t!=='CORN').sort();
    if(added.length||removed.length)deltas.push({meal,plate,added,removed});
  }
  assert.deepEqual(deltas,F.offlineOtherFamilyDeltas);
});
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
  const arts={'menu_current.json':menuArtifact,'menu_overlay.json':overlay,'door_state.json':read('door_state.json'),'routing_by_meal.json':read('routing_by_meal.json'),'registry_summary.json':read('registry_summary.json')};
  const v=R.core.validateDoorPublishArtifacts(arts,{});
  assert.equal(v.counts.Stop,0,'publish validation Stop');assert.equal(v.counts.Review,0,'publish validation Review');
  const h=R.core.doorContentHash(menu);
  for(const f of ['door_state.json','routing_by_meal.json','registry_summary.json'])assert.equal(arts[f]._meta.builtFromMenu?.hash,h,f+' built from this menu');
});

