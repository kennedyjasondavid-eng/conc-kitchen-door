// tests/recent_log_publish_merge_gate.mjs — 2026-11-20 (the #273 review's follow-up). A full publish pushed this
// computer's recent log as it stood, so a computer that published before its next sync dropped what other computers
// had logged from recent_log.json. Now the kitchen copy at the publish revision is merged in first (doorRecentLogKey),
// and a kitchen copy that cannot be read sends no recent log at all. Authored red on main 548e402. Rooms are made up.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
function fn(name, async_) {
  const head = (async_ ? 'async ' : '') + 'function ' + name + '(';
  const s = html.indexOf(head); assert.ok(s >= 0, 'missing ' + name);
  const e = html.indexOf('\n}\n', s); return html.slice(s, e) + '\n}\n';
}
const b64 = (v) => Buffer.from(unescape(encodeURIComponent(JSON.stringify(v)))).toString('base64');
function ctx(files) {
  const c = { atob: (x) => Buffer.from(x, 'base64').toString('binary'), escape, decodeURIComponent, console: { warn() {} }, calls: [] };
  c.doorPublishReadJSON = async (creds, path) => { c.calls.push(path); const k = path.split('/contents/')[1].split('?')[0]; if (files[k] === 'bad') return {}; return { content: b64(files[k]) }; };
  vm.createContext(c);
  vm.runInContext([fn('doorRecentLogKey'), fn('doorMergeRecentLogs'), fn('doorPublishReadRecentLog', true)].join('\n'), c);
  return c;
}
const A = { ts: '2026-11-20T14:00:00.000Z', date: 'Nov 20', room: '101a', desc: 'Notes edited', _real: true };
const B = { ts: '2026-11-20T15:00:00.000Z', date: 'Nov 20', room: '101b', desc: 'Intake', _real: true };
const C = { ts: '2026-11-19T10:00:00.000Z', date: 'Nov 19', room: '101c', desc: 'Discharged', _real: true };

test('RP-1 a publish keeps what other computers logged: the kitchen copy merges in, each entry once', async () => {
  const c = ctx({ 'recent_log.json': [B, A] });
  const got = await c.doorPublishReadRecentLog({}, { head: 'abc', paths: { 'recent_log.json': {} } });
  assert.equal(got.ok, true);
  assert.match(c.calls[0], /\/contents\/recent_log\.json\?ref=abc/, 'read at the publish revision');
  const merged = c.doorMergeRecentLogs([A, C], got.entries);
  assert.equal(JSON.stringify(merged.map((e) => e.room).sort()), JSON.stringify(['101a', '101b', '101c']));
});
test('RP-2 no kitchen copy yet: this computer list goes; an unreadable copy: nothing goes', async () => {
  const c = ctx({ 'recent_log.json': 'bad' });
  assert.deepEqual(JSON.parse(JSON.stringify(await c.doorPublishReadRecentLog({}, { head: 'h', paths: {} }))), { ok: true, entries: [] });
  assert.equal((await c.doorPublishReadRecentLog({}, { head: 'h', paths: { 'recent_log.json': {} } })).ok, false);
});
test('RP-5 a kitchen copy that is not a list is repaired by this computer list; the publish never prunes what it sends', async () => {
  // Added 2026-11-20 (CI on #274: menu_flow_f6_dedupe D14 and D16b). saveRecentLog prunes undated entries, and a
  // malformed kitchen copy left unsent read as unchanged; main sent this computer list over it.
  const c = ctx({ 'recent_log.json': { malformed: 'not a list' } });
  const got = await c.doorPublishReadRecentLog({}, { head: 'h', paths: { 'recent_log.json': {} } });
  assert.equal(got.ok, true); assert.equal(got.entries.length, 0);
  const s = html.indexOf('const _kitchenLog = await doorPublishReadRecentLog(creds, revision);');
  assert.doesNotMatch(html.slice(s, s + 900), /saveRecentLog\(|pruneRecentLog\(/, 'the publish prunes the log it sends');
});
test('RP-3 the publish merges before it stages, and skips the file when the kitchen copy cannot be read', () => {
  const s = html.indexOf('const _kitchenLog = await doorPublishReadRecentLog(creds, revision);');
  assert.ok(s > 0, 'the publish does not read the kitchen copy');
  const block = html.slice(s, s + 900);
  assert.match(block, /if \(_kitchenLog\.ok\) \{[\s\S]*doorMergeRecentLogs\(RECENT_LOG, _kitchenLog\.entries\)[\s\S]*_push\('recent_log\.json'/);
  assert.equal((html.match(/_push\('recent_log\.json'/g) || []).length, 1, 'one place stages the recent log');
  assert.ok(html.indexOf("_push('recent_log.json'") > s, 'staged after the merge');
});
test('RP-4 an entry marked not real never travels, from either side', () => {
  const c = ctx({});
  const merged = c.doorMergeRecentLogs([{ ...A, _real: false }], [B, { ...C, _real: false }]);
  assert.equal(JSON.stringify(merged.map((e) => e.room)), JSON.stringify(['101b']));
});
