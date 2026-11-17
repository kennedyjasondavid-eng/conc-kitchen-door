// Jason's six missing separate meals now name exact, source-backed complete recipes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=n=>JSON.parse(fs.readFileSync(new URL('../'+n,import.meta.url),'utf8'));
const catalog=read('tests/fixtures/anaph_recipe_catalog_2026-11-16.json');
const menu=read('menu_current.json'),overlay=read('menu_overlay.json');
const definitions=[[1,'MONDAY','chicken'],[1,'WEDNESDAY','chicken'],[1,'FRIDAY','chicken'],[2,'WEDNESDAY','basa'],[3,'THURSDAY','chicken'],[4,'MONDAY','basa']];
test('six approved non-vegetarian defaults resolve uniquely to canonical CODEX plate names',()=>{
 for(const [week,day,protein]of definitions){
  const id='plain-'+(protein==='chicken'?'chicken-leg':'basa')+'-with-rice-and-vegetables';
  const matches=catalog.recipes.filter(r=>r.recipeId===id);assert.equal(matches.length,1);
  assert.equal(menu.menu[week][day].dinner_anaphAlt,matches[0].recipeName,`W${week} ${day} menu`);
  assert.equal(overlay[week][day].dinner_anaphAlt,matches[0].recipeName,`W${week} ${day} overlay`);
  assert.ok(matches[0].contentFingerprint);assert.equal(matches[0].door.recipeId,id);
  assert.ok(matches[0].door.allergens.some(x=>x.startsWith('Beans')));
  assert.ok(matches[0].door.allergens.some(x=>x.startsWith('Nightshades')));
  if(protein==='basa')assert.ok(matches[0].door.allergens.some(x=>x.startsWith('Fish')));
 }
});
test('separate meal naming retains positive coconut triggers and resident-specific anaphylactic scope',()=>{
 for(const [week,day]of definitions)assert.equal(menu.menu[week][day].dinner_flags.hasCoconut,true,`W${week} ${day} trigger`);
 const state=read('door_state.json'),r=state.residents.find(x=>x.room==='213');
 assert.ok(state.anaphRooms.includes('213'));
 assert.ok(r.anaphTags.includes('noCoconut')&&r.anaphTags.includes('noTreeNuts'));
 assert.ok(!r.anaphTags.includes('noCorn'),'avoidance is not promoted into anaphylaxis');
 assert.ok(r.tags.includes('Soft Meals')&&r.tags.includes('No Corn'));
});
test('the binding data change remains a coherent publication without a schema extension',()=>{
 const flow=menu._meta.flow;
 for(const name of ['menu_overlay.json','routing_by_meal.json','registry_summary.json','door_state.json'])assert.deepEqual(read(name)._meta.flow,flow,name);
 assert.deepEqual(read('door_flow_publication.json').flow,flow);
 assert.equal(menu._meta.version,32);assert.equal(read('routing_by_meal.json')._meta.version,31);
 assert.equal(read('door_state.json')._meta.version,30);
});
