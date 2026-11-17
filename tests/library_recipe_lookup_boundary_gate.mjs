import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('const DOOR_LEGACY_LIBRARY_VEG_HINT_IDS'),end=html.indexOf('\n// FOOD SAFETY',start);
const recipe=(recipeId,recipeName,allergens)=>({recipeId,recipeName,allergens,stream:'vegan'});
function lookup(records,base=[],fallback=base) {
 const c={DOOR_RECIPE_DATA:records,_doorRecipeBase:base,DOOR_RECIPE_DATA_FALLBACK:fallback};vm.createContext(c);vm.runInContext(html.slice(start,end),c);return text=>c.getVegAltAllergenStr(text);
}
test('adding a Library-only cauliflower/bean assembly does not reinterpret Green Beans',()=>{
 const base=[recipe('old-beans','Green Beans',['Beans (Green Beans)'])];
 const added=recipe('plain-cauliflower-and-green-beans','Plain Cauliflower and Green Beans',['Beans (Green Beans)','Brassicas (Cauliflower)']);
 const find=lookup([...base,added],base);
 assert.equal(find('Green Beans'),'BEANS');assert.equal(find('Tofu Dish, Green Beans'),'BEANS');
 assert.equal(find(added.recipeName),'BEANS, BRASSICAS');
});
test('new onion assembly does not supply facts for an existing Peas/Carrots component',()=>{
 const base=[recipe('old-peas','Peas and Carrot',['None'])];
 const added=recipe('peas-carrots-onions','Peas, Carrots and Onions (Plain)',['Beans (Peas)']);
 const find=lookup([...base,added],base);
 assert.equal(find('Main, Peas & Carrots'),'');assert.equal(find(added.recipeName),'BEANS');
});
test('containment and word-overlap are both refused for Library-only identities',()=>{
 const r=recipe('new-compound','Cauliflower with Green Beans',['Brassicas (Cauliflower)']);const find=lookup([r]);
 assert.equal(find('Green Beans'),'');assert.equal(find('Green Bean Side'),'');assert.equal(find('Long prefix '+r.recipeName),'');
 assert.equal(find(r.recipeName),'BRASSICAS');
});
test('legacy base eligibility follows identity, while its facts remain current',()=>{
 const old=recipe('old-id','Old Dish',['None']),current=recipe('old-id','Roasted Green Bean Dish',['Beans (Green Beans)']);
 assert.equal(lookup([current],[old])('Green Bean Dish'),'BEANS');
 assert.equal(lookup([{...current,allergens:['Beans (Green Beans)','Mustard']}],[old])('Green Bean Dish'),'BEANS, MUSTARD');
});
test('the explicit pre-addition compatibility identities preserve current Library hints',()=>{
 const r=recipe('kimchi-fried-rice-vegan','Kimchi Fried Rice (Vegan)',['Gluten']);
 assert.equal(lookup([r])('Kimchi Fried Rice'),'GLUTEN');
});
test('base-name fallback is allowed only where the base genuinely lacks an ID',()=>{
 const old={recipeName:'Roasted Green Bean Dish'},current=recipe('current-id',old.recipeName,['Beans']);
 assert.equal(lookup([current],[old])('Green Bean Dish'),'BEANS');
 assert.equal(lookup([current],[{...old,recipeId:'different-id'}])('Green Bean Dish'),'');
});
test('live, cached and shipped fallback inputs never make a new Library compound a loose match',()=>{
 const r=recipe('new-id','Plain Cauliflower and Green Beans',['Brassicas','Beans']);
 for(const base of [[],null,undefined])assert.equal(lookup([r],base,[])('Green Beans'),'');
});
test('ambiguous exact names do not choose an arbitrary record',()=>{
 const a=recipe('a','Exact Plate',['Eggs']),b=recipe('b','Exact Plate',['Mustard']);
 assert.equal(lookup([a,b])('Exact Plate'),'');assert.equal(lookup([b,a])('Exact Plate'),'');
});
