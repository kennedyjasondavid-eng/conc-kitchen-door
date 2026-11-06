// Synthetic F4 contract fixtures and independent SHA-256 oracle. No production records.
import { createHash } from 'node:crypto';
export const clone = v => JSON.parse(JSON.stringify(v));
export const NOW = Date.parse('2026-11-06T17:00:00Z');
export const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
export const DAYS = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
export const CALENDAR = { mode:'standard',cycleStart:'2026-06-07',cycleWeeks:4,weekStartsOn:'SUNDAY',zone:'America/Toronto' };
export const SERVICE = { site:'rexdale',date:'2026-11-06',week:'2',day:'FRIDAY',meal:'dinner' };
export function canonical(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '['+v.map(canonical).join(',')+']';
  return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
}
export const digest = v => 'sha256:'+createHash('sha256').update(canonical(v),'utf8').digest('hex');
export function inputs(regular=148) {
  const day = { breakfast:'Fixture Rice',lunch:'Fixture Rice',dinner:'Fixture Rice',dinner_flags:{hasCorn:false},
    dinner_slots:{main:{recipeId:'fixture-rice',recipeName:'Fixture Rice',flags:{hasCorn:false}}} };
  return {
    site:'rexdale',
    menu:Object.fromEntries(['1','2','3','4'].map(w=>[w,Object.fromEntries(DAYS.map(d=>[d,clone(day)]))])),
    dated:{swaps:{},reverted:{},specials:{},removed:{}},
    registry:{residents:Array.from({length:regular},(_,i)=>({room:'synthetic-'+String(i).padStart(3,'0'),tags:[],isAnaph:false})),anaphRooms:[],customRules:[],learned:{}},
    recipe:{records:[{recipeId:'fixture-rice',canonicalName:'Fixture Rice',allergenState:'known',allergenFlags:{hasCorn:false}}],sharedOverrides:[]},
    calendar:clone(CALENDAR)
  };
}
export function receipt(source) {
  const components=Object.fromEntries(['menu','dated','registry','recipe','calendar'].map(k=>[k,digest(source[k])]));
  return {schema:1,inputRevision:digest({schema:1,site:source.site,components}),components,calendar:clone(source.calendar)};
}
export function candidate(source=inputs(),sequence=1,epoch='synthetic-epoch-one') {
  const flow={...receipt(source),publication:{epoch,sequence}}, meta=()=>({site:source.site,exported:'2026-11-06T17:00:00Z',flow:clone(flow)});
  const count=source.registry.residents.length;
  const slot={status:'valid',counts:{Regular:count,_components:{'Fixture Rice':count}}};
  const rotation=Object.fromEntries(['1','2','3','4'].map(w=>[w,Object.fromEntries(DAYS.map(d=>[d,Object.fromEntries(['breakfast','lunch','dinner'].map(m=>[m,clone(slot)]))]))]));
  const dated={};
  for (const [key,entry] of Object.entries({...source.dated.swaps,...source.dated.specials})) {
    const [date,meal]=[key.slice(0,10),key.slice(11)];
    const removed=source.dated.specials[key]?source.dated.removed[key]:source.dated.reverted[key];
    if (removed && (!entry.createdAt || entry.createdAt<=removed)) continue;
    dated[date] ||= {};
    dated[date][meal]={status:'valid',kind:source.dated.specials[key]?'special':'swap',week:'2',day:'FRIDAY',
      counts:{Regular:count,_components:{[entry.specialName]:count}}};
  }
  return {
    menu:{_meta:meta(),menu:clone(source.menu)},overlay:{_meta:meta()},
    registry:{_meta:meta(),headcounts:{total:count,regular:count}},
    routing:{_meta:meta(),routing:Object.fromEntries(['1','2','3','4'].map(w=>[w,{}])),flow:{schema:1,inputRevision:flow.inputRevision,recipes:{},rotation,dated}},
    ...clone(source.dated)
  };
}
export function swappedInputs() {
  const out=inputs();
  out.dated.swaps['2026-11-06-dinner']={specialName:'Fixture Sausages',createdAt:'2026-11-05T12:00:00Z',_flagsRaw:{hasPork:true}};
  return out;
}
export function reorder(v) {
  if (Array.isArray(v)) return v.map(reorder);
  return v && typeof v==='object' ? Object.fromEntries(Object.keys(v).reverse().map(k=>[k,reorder(v[k])])) : v;
}
