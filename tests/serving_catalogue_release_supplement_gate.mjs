// Independent release review: frozen counterexamples before builder corrections.
import test from'node:test';import assert from'node:assert/strict';
import{fixture,changed,parse,goodResult,core,setup}from'./fixtures/serving_catalogue_cases.mjs';
const id='technical-fixture-written-yield';
test('retained baseline warning and suppressed vegan claim cannot borrow canonical CFP or yield',async()=>{
 const f=changed(fixture(),({base,library})=>{const r=library.recipes.find(x=>x.recipeId===id);base.push({...r.door,allergens:['Milk (retained baseline)']});r.door.veganFriendly=true;});
 const c=goodResult(await parse(f)),r=c.recipes.find(x=>x.recipeId===id);
 assert.ok(r.door.allergens.some(x=>/^Milk/.test(x)));assert.equal(r.door.veganFriendly,false);
 assert.equal(r.binding,'projection-only');assert.equal(r.sourceFingerprint.kind,'public-projection');assert.equal(r.portionBasis,null);
 assert.ok(c.issues.some(x=>x.index===c.recipes.indexOf(r)&&x.reason==='canonical-unavailable'));
});
test('confirmed removal leaves coherent canonical source association usable',async()=>{
 const f=changed(fixture(),({base,library})=>{const r=library.recipes.find(x=>x.recipeId===id);base.push({...r.door,allergens:['Milk (baseline)']});r.door.removedAllergens=['Milk'];});
 const r=goodResult(await parse(f)).recipes.find(x=>x.recipeId===id);assert.equal(r.binding,'canonical');assert.equal(r.portionBasis.servings,10);assert.ok(!r.door.allergens.some(x=>/^Milk/.test(x)));
});
test('nonconstructible AbortController capability is rejected by inert factory',()=>{
 const{c,ambient}=core();let calls=0;const r=c.houseServingV1CatalogueIOCreate({site:'rexdale'},{fetch:()=>{calls++;},AbortController:()=>{calls++;},setTimeout:()=>{calls++;},clearTimeout:()=>{calls++;}});
 assert.equal(r.ok,false);assert.equal(r.reason,'invalid-input');assert.equal(calls,0);assert.deepEqual(ambient,[]);
});
test('hostile thrown marker getter cannot escape fixed pure failure boundary',async()=>{
 const{c,ambient}=core();let markerReads=0;const poison={};Object.defineProperty(poison,'catalogueReason',{get(){markerReads++;throw Error('SYNTHETIC_RAW_ERROR_MUST_NOT_ESCAPE');}});
 const input=new Proxy({},{getPrototypeOf(){throw poison;}});let result,escaped=false;
 try{result=await c.houseServingV1CatalogueFromPublic(input);}catch(_){escaped=true;}
 assert.equal(escaped,false,'pure API must resolve a fixed failure instead of rejecting');assert.equal(markerReads,0);assert.equal(result.ok,false);assert.equal(result.reason,'invalid-input');assert.deepEqual(ambient,[]);
});
