import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('function doorBreakfastVariantBasis('),end=html.indexOf('function computePlatingData(',start);
assert.ok(start>=0&&end>start,'the shared breakfast foundation must exist');
const box=vm.createContext({});vm.runInContext(html.slice(start,end),box);
const plain=v=>JSON.parse(JSON.stringify(v));
const resolve=(...args)=>plain(box.doorResolveBreakfastPlate(...args));
const aggregate=(...args)=>plain(box.doorAggregateBreakfastPlates(...args));
const req=(id,kind='ingredient',role)=>({id,revision:'request-v1',kind,...(role?{role}:{})});
const request=(requirements=[])=>({service:'W1-TUE-breakfast',residentKey:'test-resident',anaphylacticDisposition:'standard-pool',
  requirementSource:{complete:true,revision:'registry-and-requests-v1'},requirements});
const component=(id,role=id,portion=null)=>({id,role,recipeId:id,name:id,fingerprint:id+'-v1',portion});
const variant=(id,components)=>({id,service:'W1-TUE-breakfast',state:'replacement',components,preparation:[],sources:['controlled manual fixture'],assessments:[]});
function catalogue(variants,requirements) {
  const recipes=new Map();
  for(const v of variants)for(const c of v.components)recipes.set(c.recipeId,{recipeId:c.recipeId,name:c.name,fingerprint:c.fingerprint,
    sources:['synthetic catalogue fixture'],requirements:Object.fromEntries(requirements.filter(r=>r.kind==='ingredient'||r.kind==='component'&&r.role===c.role)
      .map(r=>[r.id,{requirementRevision:r.revision,status:'covered',sources:['controlled ingredient assessment']}]))});
  return {revision:'synthetic-catalogue-v1',recipes:[...recipes.values()]};
}
const setFact=(cat,id,key,status)=>{cat.recipes.find(r=>r.recipeId===id).requirements[key].status=status;};
const prove=(v,r,status='covered')=>v.assessments.push({requirementId:r.id,requirementRevision:r.revision,status,
  basis:box.doorBreakfastVariantBasis(v),sources:['controlled preparation assessment']});

test('B0 301a: GF plus vegetarian plus prescribed oat milk keeps the complete cereal plate',()=>{
  const rs=[req('GF'),req('vegetarian'),req('lactose'),req('oat-only','component','milk')];
  const gf=variant('gf-oat',[component('gf-cereal','cereal'),component('oat-milk','milk'),component('whole-fruit')]);
  const ordinary=variant('ordinary-oat',[component('ordinary-cereal','cereal'),component('oat-milk','milk'),component('whole-fruit')]);
  const cat=catalogue([gf,ordinary],rs);setFact(cat,'ordinary-cereal','GF','conflict');
  const result=resolve(request(rs),[ordinary,gf],cat);
  assert.equal(result.status,'resolved');assert.equal(result.variantId,'gf-oat');
  assert.deepEqual(result.components.map(c=>c.recipeId),['gf-cereal','oat-milk','whole-fruit']);
});
test('B0 1207: GF plus lactose/nut avoidance and prescribed soy milk never selects dairy milk',()=>{
  const rs=[req('GF'),req('lactose'),req('nut-avoidance'),req('soy-only','component','milk')];
  const soy=variant('gf-soy',[component('gf-cereal','cereal'),component('soy-milk','milk'),component('fruit')]);
  const dairy=variant('gf-dairy',[component('gf-cereal','cereal'),component('dairy-milk','milk'),component('fruit')]);
  const cat=catalogue([soy,dairy],rs);setFact(cat,'dairy-milk','soy-only','conflict');setFact(cat,'dairy-milk','lactose','conflict');
  assert.equal(resolve(request(rs),[soy,dairy],cat).variantId,'gf-soy');
});
for(const [resident,requirements]of [['304',['halal','no-egg']],['412',['no-egg','no-dairy']]])
test(`B0 ${resident}: secondary exclusions apply to bread, patty, cheese and yoghurt`,()=>{
  const rs=requirements.map(id=>req(id));
  const safe=variant('egg-free',[component('bread'),component('veg-patty'),component('vegan-cheese'),component('df-yoghurt'),component('fruit')]);
  const egg=variant('egg-sandwich',[component('bread'),component('egg'),component('cheese'),component('yoghurt'),component('fruit')]);
  const cat=catalogue([safe,egg],rs);setFact(cat,'egg','no-egg','conflict');
  assert.equal(resolve(request(rs),[egg,safe],cat).variantId,'egg-free');
  setFact(cat,'df-yoghurt',rs[0].id,'unknown');
  assert.equal(resolve(request(rs),[egg,safe],cat).status,'unresolved');
});
test('no assertion on a variant can override conflicting canonical component facts',()=>{
  const rs=[req('GF')],v=variant('plate',[component('bread')]),cat=catalogue([v],rs);
  setFact(cat,'bread','GF','conflict');v.covered=['GF'];
  assert.equal(resolve(request(rs),[v],cat).status,'unresolved');
  v.assessments=[{requirementId:'GF',status:'covered',sources:['plate label']}];
  assert.deepEqual(resolve(request(rs),[v],cat).reasons,['invalid-plate-assessment']);
});
test('complete empty requirements are distinct from absent or incomplete adapter input',()=>{
  const v=variant('plate',[component('fruit')]),cat=catalogue([v],[]);
  assert.equal(resolve(request(),[v],cat).status,'resolved');
  for(const patch of [{requirements:null},{requirementSource:null},{requirementSource:{complete:false,revision:'v1'}},{anaphylacticDisposition:null}])
    assert.equal(resolve({...request(),...patch},[v],cat).status,'unresolved');
  assert.equal(resolve({...request(),anaphylacticDisposition:'separate'},[v],cat).status,'separate');
});
test('missing role, stale recipe, stale requirement evidence and unreferenced facts remain unresolved',()=>{
  const rs=[req('oat-only','component','milk')],v=variant('plate',[component('fruit')]),cat=catalogue([v],rs);
  assert.equal(resolve(request(rs),[v],cat).status,'unresolved');
  const gf=[req('GF')],p=variant('plate',[component('cereal')]),c=catalogue([p],gf);
  for(const change of [()=>c.recipes[0].fingerprint='old',()=>c.recipes[0].requirements.GF.requirementRevision='old',()=>c.recipes[0].requirements.GF.sources=[]]) {
    const fresh=catalogue([p],gf);Object.assign(c,fresh);change();assert.equal(resolve(request(gf),[p],c).status,'unresolved');
  }
});
test('every assembly component is checked; unknown accompaniment is not ignored',()=>{
  const rs=[req('no-dairy')],v=variant('plate',[component('patty'),component('yoghurt')]),cat=catalogue([v],rs);
  delete cat.recipes[1].requirements['no-dairy'];assert.equal(resolve(request(rs),[v],cat).status,'unresolved');
});
test('competing compatible variants are deterministic and preference cannot override a conflict',()=>{
  const rs=[req('GF')],a=variant('a',[component('a')]),b=variant('b',[component('b')]),cat=catalogue([a,b],rs);
  assert.deepEqual(resolve(request(rs),[a,b],cat),resolve(request(rs),[b,a],cat));
  assert.deepEqual(resolve(request(rs),[a,b],cat).reasons,['ambiguous-compatible-variants']);
  assert.equal(resolve(request(rs),[a,b],cat,'b').variantId,'b');
  setFact(cat,'b','GF','conflict');assert.equal(resolve(request(rs),[a,b],cat,'b').status,'unresolved');
  assert.equal(resolve(request(rs),[a,b],cat,'missing').status,'unresolved');
});
test('unresolved variants and malformed duplicate or invalid inputs cannot become eligible',()=>{
  const rs=[req('GF')],v=variant('plate',[component('cereal')]),cat=catalogue([v],rs);
  for(const mutation of [p=>p.state='unresolved',p=>p.components.push({...p.components[0]}),p=>p.components[0].portion={amount:0,unit:'g'},p=>p.assessments=[{requirementId:'nonexistent'}]]) {
    const p=structuredClone(v);mutation(p);assert.equal(resolve(request(rs),[p],cat).status,'unresolved');
  }
  assert.equal(resolve(request([rs[0],rs[0]]),[v],cat).status,'unresolved');
  assert.equal(resolve(request(rs),[v,v],cat).status,'unresolved');
  assert.equal(resolve(request(rs),[v],{...cat,recipes:[...cat.recipes,...cat.recipes]}).status,'unresolved');
});
test('qualitative smaller starch/extra protein preserves the note without inventing quantities',()=>{
  const r=req('smaller-starch-extra-protein','portion'),v=variant('plate',[component('starch'),component('protein')]);
  v.preparation=['Smaller starch portion plus extra protein; no numeric quantity supplied'];prove(v,r);
  const cat=catalogue([v],[r]),result=resolve(request([r]),[v],cat);
  assert.equal(result.status,'resolved');assert.deepEqual(result.preparation,v.preparation);
  assert.equal(aggregate([result],['test-resident']).quantitiesComplete,false);
  v.preparation.push('changed');assert.equal(resolve(request([r]),[v],cat).status,'unresolved');
});
test('required unknown preparation and required unspecified numerical quantities block resolution',()=>{
  const r=req('texture-instruction','preparation'),v=variant('plate',[component('protein')]),cat=catalogue([v],[r]);
  assert.equal(resolve(request([r]),[v],cat).status,'unresolved');prove(v,r,'unknown');
  assert.equal(resolve(request([r]),[v],cat).status,'unresolved');
});
test('results are detached and calls do not mutate the request, variant or catalogue',()=>{
  const r=request(),v=variant('plate',[component('fruit')]),cat=catalogue([v],[]),before=JSON.stringify([r,v,cat]);
  const result=resolve(r,[v],cat);result.components[0].name='changed';result.preparation.push('changed');
  assert.equal(JSON.stringify([r,v,cat]),before);assert.equal(resolve(r,[v],cat).components[0].name,'fruit');
});
test('aggregation requires complete unique roster coverage and never fabricates unresolved portions',()=>{
  const v=variant('plate',[component('fruit','fruit',{amount:100,unit:'g'})]),cat=catalogue([v],[]);
  const a=resolve(request(),[v],cat),b=resolve({...request(),residentKey:'second'},[v],cat);
  const sum=aggregate([b,a],['test-resident','second']);
  assert.equal(sum.complete,true);assert.equal(sum.quantitiesComplete,true);assert.equal(sum.allocations[0].quantityTotal,200);
  assert.equal(sum.allocations[0].allocations,2);assert.deepEqual(sum,aggregate([a,b],['second','test-resident']));
  for(const [values,keys]of [[[a,a],['test-resident','second']],[[a],['test-resident','second']],[[a],null],[[a,b],['test-resident','test-resident']]])
    assert.equal(aggregate(values,keys).complete,false);
  const unknown={...b,status:'unresolved',reasons:['unknown']},incomplete=aggregate([a,unknown],['test-resident','second']);
  assert.equal(incomplete.complete,false);assert.equal(incomplete.allocations[0].quantityTotal,100);assert.deepEqual(incomplete.unresolved,['second']);
});
test('aggregation separates preparation, recipe revisions, units and repeated component allocations',()=>{
  const v=variant('plate',[component('fruit','fruit',{amount:1,unit:'piece'})]);
  const a=resolve(request(),[v],catalogue([v],[]));
  const b=structuredClone(a);b.residentKey='second';b.preparation=['cut'];b.components[0].portion={amount:50,unit:'g'};
  const c=structuredClone(a);c.residentKey='third';c.components[0].fingerprint='new-revision';
  const d=structuredClone(a);d.residentKey='fourth';d.components.push({...d.components[0],id:'extra-fruit'});
  const sum=aggregate([a,b,c,d],['test-resident','second','third','fourth']);
  assert.equal(sum.allocations.length,3);assert.equal(sum.allocations.find(g=>g.fingerprint==='fruit-v1'&&g.portion.unit==='piece').quantityTotal,3);
  assert.equal(sum.allocations.find(g=>g.fingerprint==='fruit-v1'&&g.portion.unit==='piece').residents.length,2);
  const separated={...a,residentKey:'separate',status:'separate'};
  assert.deepEqual(aggregate([separated],['separate']).allocations,[]);
});
test('equivalent quantity objects aggregate identically regardless of property insertion order',()=>{
  const v=variant('plate',[component('fruit','fruit',{amount:100,unit:'g'})]);
  const a=resolve(request(),[v],catalogue([v],[])),b=structuredClone(a);b.residentKey='second';
  b.components[0].portion={unit:'g',amount:100};
  const sum=aggregate([a,b],['test-resident','second']);
  assert.equal(sum.allocations.length,1);assert.equal(sum.allocations[0].quantityTotal,200);
  assert.deepEqual(sum.allocations[0].portion,{amount:100,unit:'g'});
});
test('foundation has no operational call sites or persistence/export additions',()=>{
  for(const name of ['doorBreakfastVariantBasis','doorResolveBreakfastPlate','doorAggregateBreakfastPlates']) {
    const outside=html.slice(0,start)+html.slice(end);
    assert.equal(outside.includes(name+'('),false,name+' must remain inactive');
  }
});
