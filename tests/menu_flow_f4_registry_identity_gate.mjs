// Independent producer review: execute the actual registry projection and anaphylactic resolver.
// Synthetic residents only; no transport, credentials or operational data.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';
const html=fs.readFileSync(process.env.HOUSE_FLOW_HTML||new URL('../index.html',import.meta.url),'utf8');
console.log('F4 registry review source SHA256 '+createHash('sha256').update(html).digest('hex'));
function fn(name){const m=html.match(new RegExp('(?:async )?function '+name+'\\([^]*?\\n\\}'));assert.ok(m,'actual '+name);return m[0];}
function decl(name){const m=html.match(new RegExp('const '+name+' = \\{[^]*?\\n\\};'));assert.ok(m,'actual '+name);return m[0];}
const a='/* HOUSE_TESTABLE_CORE_START flow-validity */',b='/* HOUSE_TESTABLE_CORE_END flow-validity */';
const source=html.slice(html.indexOf(a)+a.length,html.indexOf(b));
function box(){const c=vm.createContext({crypto:webcrypto,TextEncoder,Date,console,REGISTRY_LIST:[],anaphRooms:[]});
  vm.runInContext(source+'\n'+decl('TAG_LABELS_MAP')+'\n'+decl('ANAPH_TAG_TO_MEAL_FLAG')+'\n'+
    ['doorFlowRegistryInput','doorIsAnaphResident','getRoomBase','findRoommates','anaphTagMealFlags','getAnaphConflictRooms'].map(fn).join('\n'),c);return c;}
const base=()=>({registry:{residents:[{room:'901a',tags:['No Peanuts','No Dairy'],isAnaph:true,anaphTags:['noPeanuts']},{room:'901b',tags:[],isAnaph:false}],anaphRooms:[]},custom:[],learned:{}});

test('F4 registry control: anaphTags change the real conflict and roommate routing',()=>{
  const c=box(),i=base();c.REGISTRY_LIST=i.registry.residents;
  assert.deepEqual([...c.getAnaphConflictRooms({hasDairy:true},{})],[]);
  i.registry.residents[0].anaphTags=['noDairy'];
  assert.deepEqual([...c.getAnaphConflictRooms({hasDairy:true},{})],['901a','901b']);
});
test('F4 registry: changed specific anaphylactic allergens change the canonical registry identity',async()=>{
  const c=box(),i=base(),before=await c.houseFlowDigest(c.houseFlowProjection(c.doorFlowRegistryInput(i),'registry'));
  i.registry.residents[0].anaphTags=['noDairy'];
  const after=await c.houseFlowDigest(c.houseFlowProjection(c.doorFlowRegistryInput(i),'registry'));
  assert.notEqual(after,before,'a known anaphylactic routing change must supersede the previous receipt');
});
test('F4 registry control: an unrelated note does not change routing input identity',async()=>{
  const c=box(),i=base(),before=await c.houseFlowDigest(c.houseFlowProjection(c.doorFlowRegistryInput(i),'registry'));
  i.registry.residents[0].staffNote='Synthetic unrelated administration note';
  assert.equal(await c.houseFlowDigest(c.houseFlowProjection(c.doorFlowRegistryInput(i),'registry')),before);
});
