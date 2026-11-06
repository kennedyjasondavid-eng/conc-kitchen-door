// Independent C2b gate: retain every Node contract; select only browser cost.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const modulePath=new URL('../scripts/ci_door_scope.mjs',import.meta.url);
const implementation=fs.existsSync(modulePath)?await import(modulePath):null;
const classify=raw=>{assert.ok(implementation,'C2b classifier implementation is required');return implementation.classifyNameStatus(raw);};
const event=(...args)=>{assert.ok(implementation,'C2b classifier implementation is required');return implementation.coverageForEvent(...args);};
const data=['menu_current.json','menu_overlay.json','meal_swaps.json','meal_swaps_reverted.json',
  'special_meals.json','special_meals_removed.json','routing_by_meal.json','registry_summary.json',
  'door_state.json','learned_nr.json','custom_tag_rules.json','door_flow_publication.json','recent_log.json','change_log.json','push-log.txt'];
for(const path of data)test('C2b known operational A/M: '+path,()=>{
  for(const status of ['A','M'])assert.equal(classify(status+'\0'+path+'\0').browser,false);
});
test('C2b docs and known data can share the light browser lane',()=>{
  assert.equal(classify('A\0docs/review notes.md\0M\0README.md\0M\0menu_current.json\0').browser,false);
});
for(const path of ['index.html','tests/fixtures/new.json','tests/README.md','.github/workflows/door-tests.yml',
  '.github/README.md','scripts/ci_door_scope.mjs','new_snapshot.json','menu_reno.json','recipe_production.json',
  'docs/unknown-script.js','unknown/README.md','MENU_CURRENT.JSON','../menu_current.json'])test('C2b code/contract/unknown mixed diff: '+path,()=>{
  assert.equal(classify('M\0menu_current.json\0M\0'+path+'\0').browser,true);
});
for(const [label,raw]of [['delete','D\0menu_current.json\0'],['rename','R100\0old.json\0menu_current.json\0'],
  ['rename as delete/add','D\0docs/old.md\0A\0docs/new.md\0'],['copy','C100\0menu_current.json\0copy.json\0'],
  ['type change','T\0menu_current.json\0'],['unknown status','Q\0menu_current.json\0'],
  ['empty',''],['missing final NUL','M\0menu_current.json'],['missing path','M\0'],['empty path','M\0\0']])test('C2b fail closed: '+label,()=>assert.equal(classify(raw).browser,true));
const base='1'.repeat(40),head='2'.repeat(40);
test('C2b exact checked revisions, no rename collapse and NUL-safe paths',()=>{
  const calls=[],git=args=>{calls.push(args);return{status:0,stdout:args[0]==='diff'?'M\0menu_current.json\0':head};};
  assert.equal(event('push',{before:base},head,git).browser,false);
  assert.equal(calls.at(-1).at(-1),base+'..'+head);
  assert.ok(calls.some(a=>a.includes(base+'^{commit}')));assert.ok(calls.some(a=>a.includes(head+'^{commit}')));
  assert.equal(event('pull_request',{pull_request:{base:{sha:base},head:{sha:head}}},'untrusted-merge-sha',git).browser,false);
  assert.equal(calls.at(-1).at(-1),base+'...'+head);
  assert.ok(calls.at(-1).includes('--no-renames'));assert.ok(calls.at(-1).includes('-z'));
});
test('C2b manual/unknown/missing revisions never invoke a light default',()=>{
  const git=()=>({status:0,stdout:'M\0menu_current.json\0'});
  for(const name of ['workflow_dispatch','schedule','unknown'])assert.equal(event(name,{},head,git).browser,true);
  for(const before of [undefined,'0'.repeat(40),'main','bad'])assert.equal(event('push',{before},head,git).browser,true);
  assert.equal(event('push',{before:base},'bad',git).browser,true);
});
test('C2b absent bases, diff failures, spawn errors and exceptions run full coverage',()=>{
  for(const git of [()=>({status:1}),()=>({status:null,error:new Error('spawn')}),()=>{throw new Error('transport');},
    args=>({status:args[0]==='diff'?1:0,stdout:'M\0menu_current.json\0'}),
    args=>({status:0,stdout:args[0]==='diff'?'':head})])assert.equal(event('push',{before:base},head,git).browser,true);
});
test('C2b one existing required job retains complete Node suite and independent Pages',()=>{
  const workflow=fs.readFileSync(new URL('../.github/workflows/door-tests.yml',import.meta.url),'utf8');
  assert.equal([...workflow.slice(workflow.indexOf('\njobs:')).matchAll(/^  [\w-]+:$/gm)].length,1);
  assert.match(workflow,/name: DOOR safety checks/);assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/run: node --test tests\/\*\.mjs/);
  assert.match(workflow,/id: browser_scope/);assert.match(workflow,/node scripts\/ci_door_scope\.mjs/);
  assert.match(workflow,/fetch-depth: 0/);
  const steps=workflow.split(/^      - name: /m);
  const node=steps.find(s=>s.startsWith('Run smoke tests'));
  assert.ok(node&&!/\bif:/.test(node),'entire Node suite is unconditional');
  for(const label of ['Install Playwright for publisher contracts','Restore Chromium cache','Install Chromium for publisher contracts','Run coherent publisher browser contracts']){
    const step=steps.find(s=>s.startsWith(label));assert.ok(step,label);
    assert.match(step,/if: \$\{\{ !cancelled\(\) && steps\.browser_scope\.outputs\.browser != 'false' \}\}/,label+' fails closed');
    assert.ok(!step.includes('continue-on-error:'),label+' retains real failures');
  }
  assert.match(workflow,/ubuntu-24\.04/);assert.match(workflow,/playwright@1\.56\.1/);
  const advisory=steps.find(s=>s.startsWith('Review architect-set menu decisions'));
  assert.match(advisory,/if: \$\{\{ !cancelled\(\) \}\}/);assert.match(advisory,/continue-on-error: true/);
  const pages=fs.readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
  assert.ok(!/^\s+needs:/m.test(pages),'Pages remains independent');
  assert.ok(!pages.includes('ci_door_scope'),'browser scope cannot gate delivery');
});
