// Independent source-authority supplement. Copied receipt/attestation metadata
// cannot turn imported, manual or unknown work into a consumed DOOR build.
import {harness,clone,sourceHash} from './menu_flow_f6_harness.mjs';
let pass=0,fail=0;
const check=(label,ok,detail)=>{console.log((ok?'PASS ':'FAIL ')+label+(ok?'':' '+JSON.stringify(detail).slice(0,1200)));ok?pass++:fail++;};
console.log('F6 source '+sourceHash);const h=await harness();
try {
 for(const source of ['live','cached','imported','manual',undefined,'rebuilt','unknown']){
  const run=await h.boot();await run.publish();run.delivery.files=clone(run.remote.files);
  const flow=clone(run.remote.files['menu_current.json']._meta.flow);
  const buildAttestation={schema:1,capability:'door-flow-build-v1',inputRevision:flow.inputRevision,publication:clone(flow.publication)};
  run.delivery.expo={_doorMenu:{site:'rexdale',flow,buildAttestation},...(source===undefined?{}:{_menuSource:source})};run.delivery.expoStatus=200;
  await run.recheck();const evidence=await run.record(),expected=source==='live'||source==='cached';
  const exact=evidence?.consumed?.inputRevision===flow.inputRevision&&JSON.stringify(evidence?.consumed?.publication)===JSON.stringify(flow.publication);
  check('S1 '+(source??'missing')+' source with copied valid capability',!!evidence?.served&&(expected?exact:evidence.consumed===null),evidence);
  check('S2 '+(source??'missing')+' verification causes no extra content writes or runtime errors',run.remote.visibleWrites.length===1&&run.errors.length===0&&run.illegal.length===0,{writes:run.remote.visibleWrites.length,errors:run.errors,illegal:run.illegal});
 }
} finally {await h.close();}
console.log('menu_flow_f6_source_authority: '+pass+' passed, '+fail+' failed');process.exitCode=fail?1:0;
