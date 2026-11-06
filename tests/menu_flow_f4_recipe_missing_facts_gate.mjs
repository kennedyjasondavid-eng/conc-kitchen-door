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
for(const facts of [[null],[''],['   '],['Fish',null]])test('F4 recipe vector: malformed or blank source facts remain unknown '+JSON.stringify(facts),()=>{
  const c=box(),r=c.doorFlowRecipeVector([rec(facts)])['fixture-vector-rice'];
  assert.equal(r.allergenState,'unknown','an empty or missing source fact is not an explicit None declaration');
  if(facts.includes('Fish'))assert.equal(r.allergenFlags.hasFish,true,'recognized warning remains present');
});
