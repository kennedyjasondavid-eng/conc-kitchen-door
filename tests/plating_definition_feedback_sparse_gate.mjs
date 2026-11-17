// Independent pre-fix review probe: malformed presentation must not get ordinary treatment.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=process.env.DOOR_FEEDBACK_HTML||new URL('../index.html',import.meta.url),html=fs.readFileSync(source,'utf8');
const a=html.indexOf('/* DOOR_TESTABLE_CORE_START plating-readiness-feedback-v1 */'),z=html.indexOf('/* DOOR_TESTABLE_CORE_END plating-readiness-feedback-v1 */',a);assert.ok(a>=0&&z>a);const c=vm.createContext({WeakMap,Set,Map,Error});vm.runInContext(html.slice(a,z),c);
const cases=[{name:'sparse issues',value:{ready:false,issues:Array(1)}},{name:'sparse rooms',value:{ready:false,issues:[{kind:'definition-gap',label:'W1 MONDAY breakfast',reason:'Synthetic missing definition',rooms:Array(1)}]}}];let failed=0;
for(const x of cases){const m=c.doorPlatingReadinessFeedbackModel(x.value),pass=m.ordinaryDefinitionGaps===false&&m.ready===false;console.log((pass?'PASS ':'FAIL ')+x.name+' '+JSON.stringify(m));if(!pass)failed++;}assert.equal(failed,0,'Malformed sparse arrays cannot become ordinary-only gaps');
