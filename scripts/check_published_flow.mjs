// Operational publication validation uses the shipped core, not a second model.
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const CARRIERS=['menu_current.json','menu_overlay.json','registry_summary.json','routing_by_meal.json','door_state.json'];
const REQUIRED=[...CARRIERS,'meal_swaps.json','meal_swaps_reverted.json','special_meals.json','special_meals_removed.json','door_flow_publication.json'];
const object=value=>value!==null && typeof value==='object' && !Array.isArray(value);
const owns=(value,key)=>object(value) && Object.hasOwn(value,key);
export async function validatePublishedFlow(files,{html,now=Date.now()}={}) {
  let mode='legacy';
  const bad=issue=>({ok:false,mode,issues:[issue]});
  try {
    if (!object(files)) return bad('Publication inventory is missing.');
    const active=CARRIERS.some(name=>owns(files[name]?._meta,'flow')) || owns(files['routing_by_meal.json'],'flow') || Object.hasOwn(files,'door_flow_publication.json');
    if (!active) return {ok:true,mode};
    mode='active';
    for(const name of REQUIRED) if(!object(files[name])) return bad('Required publication artifact is absent or malformed: '+name);
    const start='/* HOUSE_TESTABLE_CORE_START flow-validity */',end='/* HOUSE_TESTABLE_CORE_END flow-validity */';
    if (typeof html!=='string') return bad('Shipped flow validator is missing.');
    const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
    if(a<0 || b<=a) return bad('Shipped flow validator markers are missing.');
    const core=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,URL,Date,console});
    vm.runInContext(html.slice(a+start.length,b),core,{filename:'DOOR#flow-validity',timeout:1000});
    const menu=files['menu_current.json'],site=menu._meta?.site,receipt=menu._meta?.flow;
    if(typeof site!=='string' || !site || !core.houseFlowReceiptValid(receipt)) return bad('The menu receipt or site is invalid.');
    const expected=core.houseFlowCanonical(receipt);
    for(const name of CARRIERS) {
      if(files[name]._meta?.site!==site || core.houseFlowCanonical(files[name]._meta?.flow)!==expected) return bad('Publication receipts disagree: '+name);
    }
    const counter=files['door_flow_publication.json'];
    if(counter.schema!==1 || counter._meta?.site!==site || core.houseFlowCanonical(counter.flow)!==expected) return bad('The private publication counter does not match.');
    const candidate={menu,overlay:files['menu_overlay.json'],registry:files['registry_summary.json'],routing:files['routing_by_meal.json'],
      swaps:files['meal_swaps.json'],reverted:files['meal_swaps_reverted.json'],specials:files['special_meals.json'],removed:files['special_meals_removed.json']};
    const state=core.houseFlowCreateState(),generation=core.houseFlowBegin(state);
    if(!await core.houseFlowPromote(state,generation,candidate,{source:'live',now})) return bad('The public menu, dated inputs, calendar or routing projection is incoherent.');
    return {ok:true,mode};
  } catch { return bad('The publication could not be validated by the shipped flow core.'); }
}
