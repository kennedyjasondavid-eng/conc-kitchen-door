// Port of HUB's reviewed browser-scope seam. All Node safety contracts still run.
import {appendFileSync, readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const DATA = new Set([
  'menu_current.json','menu_overlay.json','meal_swaps.json','meal_swaps_reverted.json',
  'special_meals.json','special_meals_removed.json','routing_by_meal.json','registry_summary.json',
  'door_state.json','learned_nr.json','custom_tag_rules.json','door_flow_publication.json',
  'recent_log.json','change_log.json','push-log.txt'
]);
const full = reason => ({browser:true,reason});
function documentation(path) {
  if (!path || path.includes('\\') || path.split('/').some(part=>!part || part==='.' || part==='..')) return false;
  return /^[^/]+\.md$/i.test(path) || /^docs\/.+\.md$/i.test(path);
}
export function classifyNameStatus(raw) {
  if (typeof raw !== 'string' || !raw || !raw.endsWith('\0')) return full('empty or incomplete diff');
  const fields=raw.slice(0,-1).split('\0');
  if (fields.length%2) return full('unrecognized diff records');
  for(let i=0;i<fields.length;i+=2) {
    if (!['A','M'].includes(fields[i]) || !(DATA.has(fields[i+1]) || documentation(fields[i+1]))) {
      return full('code, contract, deletion or unknown path');
    }
  }
  return {browser:false,reason:'verified ordinary data or Markdown only'};
}
export function coverageForEvent(eventName,event,sha,git=args=>spawnSync('git',args,{encoding:'utf8',timeout:10000,maxBuffer:8*1024*1024})) {
  try {
    if (!['push','pull_request'].includes(eventName)) return full('manual or unknown event');
    const pr=eventName==='pull_request',base=pr?event?.pull_request?.base?.sha:event?.before;
    const head=pr?event?.pull_request?.head?.sha:sha;
    const valid=value=>typeof value==='string' && /^[a-f0-9]{40}$/i.test(value) && !/^0+$/.test(value);
    if (!valid(base) || !valid(head)) return full('missing or invalid revisions');
    for (const ref of [base,head]) {
      const result=git(['rev-parse','--verify','--quiet',ref+'^{commit}']);
      if (!result || result.status!==0 || result.error) return full('revision unavailable');
    }
    const result=git(['diff','--no-ext-diff','--no-renames','--name-status','-z',base+(pr?'...':'..')+head]);
    if (!result || result.status!==0 || result.error || typeof result.stdout!=='string') return full('diff unavailable');
    return classifyNameStatus(result.stdout);
  } catch { return full('event or diff could not be checked'); }
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  let result;
  try { result=coverageForEvent(process.env.GITHUB_EVENT_NAME,JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')),process.env.GITHUB_SHA); }
  catch { result=full('event could not be read'); }
  console.log('DOOR publisher browser contracts: '+(result.browser?'run':'skip')+' ('+result.reason+')');
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,'browser='+result.browser+'\n');
}
