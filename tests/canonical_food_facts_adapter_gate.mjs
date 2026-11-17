import fs from'node:fs';import vm from'node:vm';import assert from'node:assert/strict';import test from'node:test';
const facts=(id,basis)=>({schema:1,revision:'facts-v1',subject:{recipeId:id,productId:'test-canadian-product',region:'CA',basisFingerprint:basis},ingredientPanel:'partial',precautionaryPanel:'unknown',assessments:[
 {requirementId:'GF',requirementRevision:'r1',status:'covered',evidenceRevision:'claim-v1',sources:['evidence:gf-claim']},
 {requirementId:'NoDairy',requirementRevision:'r1',status:'unknown',evidenceRevision:'panel-v1',sources:['evidence:missing-milk-assessment']},
 {requirementId:'NoCorn',requirementRevision:'r1',status:'conflict',evidenceRevision:'panel-v1',sources:['evidence:corn-positive']}
]});

const html=fs.readFileSync(process.env.DOOR_HTML||new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('function doorCanonicalFoodFactAssessment(');
const end=start<0?-1:html.indexOf('\n}',start)+2;
const box=vm.createContext({});
if(start>=0&&end>start)vm.runInContext(html.slice(start,end),box);
const assess=(r,id='GF',revision='r1')=>{assert.equal(typeof box.doorCanonicalFoodFactAssessment,'function','inactive canonical adapter must exist');return JSON.parse(JSON.stringify(box.doorCanonicalFoodFactAssessment(r,{id,revision})));};
const record=()=>({recipeId:'product',basisFingerprint:'basis-v1',contentFingerprint:'full-v1',foodFacts:facts('product','basis-v1')});
test('exact independent predicates: GF covered, NoDairy unknown, Corn conflict',()=>{const r=record();assert.equal(assess(r).status,'covered');assert.equal(assess(r,'NoDairy').status,'unknown');assert.equal(assess(r,'NoCorn').status,'conflict');assert.equal(assess(r,'NoPeanuts').status,'unknown');assert.equal(assess(r,'NoBeans').status,'unknown');});
test('legacy/missing block and unsupported schema cannot become covered from []',()=>{for(const foodFacts of[undefined,null,{schema:2},{}])assert.equal(assess({...record(),allergens:[],foodFacts}).status,'unknown');});
test('source identity, basis or request revision edits invalidate assessments',()=>{for(const change of[{recipeId:'other'},{basisFingerprint:'new-basis'}])assert.equal(assess({...record(),...change}).status,'unknown');assert.equal(assess(record(),'GF','r2').status,'unknown');});
test('duplicate contradictory facts and missing source proof cannot green',()=>{const r=record();r.foodFacts.assessments.push({...r.foodFacts.assessments[0],status:'conflict'});assert.equal(assess(r).status,'unknown');const s=record();s.foodFacts.assessments[0].sources=[];assert.equal(assess(s).status,'unknown');});
test('returned facts detached; independent missing precautions stay unknown',()=>{const r=record(),a=assess(r);a.sources.push('mutation');assert.deepEqual(r.foodFacts.assessments[0].sources,['evidence:gf-claim']);assert.equal(assess(r,'peanut-precautions').status,'unknown');assert.equal(r.foodFacts.precautionaryPanel,'unknown');});
