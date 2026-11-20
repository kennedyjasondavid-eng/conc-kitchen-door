// tests/recent_log_key_gate.mjs — 2026-11-20 (from the breakfast-line session; Jason: "send both to the review session
// queue"). Merging this computer's recent log with the kitchen's dropped a real second entry made the same day: the key
// was room + date + words. An entry carries the time it was made (ts), the same on every computer, so the time joins the
// key; an entry without one keeps the old key. Authored red on main ad85a91. Rooms are made up.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
const has = html.includes('function doorRecentLogKey(');
function fn(name) { const s = html.indexOf('function ' + name + '('); assert.ok(s >= 0, 'missing ' + name); const e = html.indexOf('\n}\n', s); return html.slice(s, e) + '\n}\n'; }
const c = {}; vm.createContext(c);
if (has) vm.runInContext(fn('doorRecentLogKey'), c);
const merge = (local, remote) => { const seen = new Set(); return [...local, ...remote].filter(e => { const k = has ? c.doorRecentLogKey(e) : e.room + e.date + e.desc; return seen.has(k) ? false : (seen.add(k), true); }); };

test('RL-1 both merges in pullSecondaryState and the boot sync go through doorRecentLogKey', () => {
  assert.ok(has, 'doorRecentLogKey is missing');
  assert.equal((html.match(/const k=e\.room\+e\.date\+e\.desc/g) || []).length, 0, 'an old room+date+desc key is left');
  assert.equal((html.match(/const k=doorRecentLogKey\(e\)/g) || []).length, 2);
});
test('RL-2 two same-day entries with the same words and different times both survive the merge', () => {
  const a = { ts: '2026-11-20T14:00:00.000Z', date: 'Nov 20', room: '101a', type: 'update', desc: 'Notes edited', _real: true };
  const b = { ts: '2026-11-20T16:30:00.000Z', date: 'Nov 20', room: '101a', type: 'update', desc: 'Notes edited', _real: true };
  assert.equal(merge([b], [a, b]).length, 2);
});
test('RL-3 the same entry held on both computers is kept once; entries without a time keep the old key', () => {
  const a = { ts: '2026-11-20T14:00:00.000Z', date: 'Nov 20', room: '101a', desc: 'Notes edited' };
  assert.equal(merge([a], [{ ...a }]).length, 1);
  const o = { date: 'Nov 2', room: '101b', desc: 'Intake' };
  assert.equal(merge([o], [{ ...o }]).length, 1);
});
