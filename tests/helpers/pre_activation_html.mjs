// tests/helpers/pre_activation_html.mjs — 2026-11-09 (F4 switched on, v31-standard.62).
// DOOR's F4/F6 browser contracts were written before activation and check the producer's pre-activation (legacy)
// rules: a legacy receipt is uncertified, a remembered occurrence can't move backward, a seeded epoch at sequence 40
// recovers from history. Since F4 is on, they run on a copy of index.html with DOOR_FLOW_ACTIVATION_EPOCH / _BASE
// blanked, so those rules stay checked. Activated publishing is checked by tests/f4_activated_publish_gate.mjs.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
let made = null;
export function preActivationHtmlPath() {
  if (made) return made;
  const src = readFileSync(resolve(root, 'index.html'), 'utf8');
  const out = src
    .replace(/const DOOR_FLOW_ACTIVATION_EPOCH = '[^']*';/, "const DOOR_FLOW_ACTIVATION_EPOCH = '';")
    .replace(/const DOOR_FLOW_ACTIVATION_BASE = '[^']*';/, "const DOOR_FLOW_ACTIVATION_BASE = '';");
  if (!/const DOOR_FLOW_ACTIVATION_EPOCH = '';/.test(out) || !/const DOOR_FLOW_ACTIVATION_BASE = '';/.test(out)) throw new Error('pre-activation copy: activation constants not found');
  const dir = mkdtempSync(join(tmpdir(), 'door-pre-activation-'));
  made = join(dir, 'index.html');
  writeFileSync(made, out);
  return made;
}
