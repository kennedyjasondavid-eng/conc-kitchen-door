// Independent F4 source-vector review. Use the existing actual allergen normalizer;
// an unmapped warning remains unknown rather than inventing a classification.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(process.env.HOUSE_FLOW_HTML||new URL('../index.html',import.meta.url),'utf8');
const fn=name=>{const m=html.match(new RegExp('function '+name+'\\([^]*?\\n\\}'));assert.ok(m,'actual '+name);return m[0];};
function box(){
  const flags=html.match(/const FLAG_DEFS = \[[^]*?\n\];/),map=html.match(/const HUB_ALLERGEN_MAP = \{[^]*?\n\};/);
  assert.ok(flags&&map,'actual canonical flag vocabulary');
  const c=vm.createContext({console:{warn(){}}});
  vm.runInContext(flags[0]+'\n'+map[0]+'\nconst _hubUnmappedLabels = new Set();\n'+
    ['_hubAllergenResolve','hubAllergenToFlags','doorFlowRecipeVector'].map(fn).join('\n')+'\nglobalThis.unmapped=_hubUnmappedLabels;',c);
  return c;
}
const rec=allergens=>({recipeId:'fixture-vector-rice',recipeName:'Fixture Rice',allergens});
test('F4 recipe vector control: recognized compounds retain canonical warning flags',()=>{
  const c=box(),r=c.doorFlowRecipeVector([rec(['Egg and Mustard (Mayo)','Tree Nuts (Coconut)'])])['fixture-vector-rice'];
  assert.equal(r.allergenState,'known');assert.equal(r.allergenFlags.hasEgg,true);assert.equal(r.allergenFlags.hasMustard,true);
  assert.equal(r.allergenFlags.hasTreeNuts,true);assert.equal(r.allergenFlags.hasCoconut,true);assert.equal(r.portionBasis,null);
});
test('F4 recipe vector control: explicit None is known, absent facts remain unknown',()=>{
  const c=box();assert.equal(c.doorFlowRecipeVector([rec(['None'])])['fixture-vector-rice'].allergenState,'known');
  for(const facts of [[],null])assert.equal(c.doorFlowRecipeVector([rec(facts)])['fixture-vector-rice'].allergenState,'unknown');
});
test('F4 recipe vector control: duplicate identity cannot choose the first record',()=>{
  const c=box(),r=c.doorFlowRecipeVector([rec(['Fish']),{...rec(['None']),recipeName:'Fixture Different Rice'}])['fixture-vector-rice'];
  assert.equal(r.allergenState,'unknown');assert.equal(r.canonicalName,null);assert.equal(r.portionBasis,null);
});
for(const labels of [['Synthetic Unmapped Allergen'],['Fish','Synthetic Unmapped Allergen']])test('F4 recipe vector: unmapped source warning is unknown for '+labels.join(' + '),()=>{
  const c=box(),r=c.doorFlowRecipeVector([rec(labels)])['fixture-vector-rice'];
  assert.equal(c.unmapped.has('synthetic unmapped allergen'),true,'actual parser diagnoses the unresolved source label');
  assert.equal(r.allergenState,'unknown','a nonempty array cannot erase a parser warning by declaring all facts known');
  if(labels.includes('Fish'))assert.equal(r.allergenFlags.hasFish,true,'unknown does not discard the warning facts that are known');
  assert.equal(r.portionBasis,null);
});
