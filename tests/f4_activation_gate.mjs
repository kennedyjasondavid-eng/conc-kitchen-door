// 2026-11-09 (F4 switched on, v31-standard.61). EXPO's in-app plan F4 + D1; this repo's
// docs/DOOR_MENU_FLOW_ACTION_PLAN_2026-11-06.md, "F4 readers: design pass" step 5. The readers are served (EXPO #580,
// HUB #58), so DOOR now writes publication receipts. Prevents: the activation values being blanked or set to something
// the producer and the readers can't accept, and _BASE naming a commit that isn't on this branch (the first activated
// publish would then hold every change, "The previous kitchen flow occurrence could not be established").
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
const read = name => { const m = html.match(new RegExp('const ' + name + " = '([^']*)';")); return m ? m[1] : null; };

test('F4 is switched on with an epoch the shared block accepts', () => {
  const epoch = read('DOOR_FLOW_ACTIVATION_EPOCH');
  assert.ok(typeof epoch === 'string' && epoch.length > 0 && epoch.length <= 200, 'DOOR_FLOW_ACTIVATION_EPOCH is a non-empty string of at most 200 characters (houseFlowReceiptValid)');
});

test('the activation base is a commit on this branch', () => {
  const base = read('DOOR_FLOW_ACTIVATION_BASE');
  assert.match(base || '', /^[0-9a-f]{40}$/, 'DOOR_FLOW_ACTIVATION_BASE is a full commit id');
  let shallow = 'false';
  try { shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], { encoding: 'utf8' }).trim(); } catch (e) {}
  if (shallow === 'true') return; // CI fetches full history; a shallow local clone can't prove ancestry
  let ok = true;
  try { execFileSync('git', ['merge-base', '--is-ancestor', base, 'HEAD'], { stdio: 'ignore' }); } catch (e) { ok = false; }
  assert.ok(ok, 'DOOR_FLOW_ACTIVATION_BASE (' + base + ') is an ancestor of HEAD');
});
