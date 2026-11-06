// F1 credential cutover gates. Synthetic keys only; no browser credential access.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const authAt = html.indexOf('const PublishAuth = {');
const auth = html.slice(authAt, html.indexOf('window.PublishAuth = PublishAuth;', authAt));
const literals = [...html.slice(authAt - 1500, authAt).matchAll(/^const \w+\s*=\s*'[^'\n]*';/gm)].map(x => x[0]).join('\n');
function box(storage = {}, quota = false) {
  const settings = { 'gh-token': 'fixture-legacy-key', 'gh-repo': 'fixture/door' };
  storage['conc-door-settings'] ||= JSON.stringify(settings);
  storage.concPublishOutbox ||= '[{"context":"fixture pending"}]';
  const input = { value: '' };
  const c = {
    console, Date, JSON, Object, Promise, appSettings: settings, DEFAULT_SETTINGS: {},
    document: { getElementById: id => id === 'gh-token' ? input : null },
    doorSanitizeConnectionKey: s => String(s || '').replace(/[^\x20-\x7e]/g, '').trim(),
    localStorage: { getItem: k => storage[k] ?? null, setItem(k,v) { if (quota) throw new Error('quota'); storage[k] = String(v); }, removeItem: k => { delete storage[k]; } },
    doorSetItemSafe(k,v) { if (quota) return false; storage[k] = String(v); return true; }
  };
  vm.createContext(c); vm.runInContext(literals + '\n' + auth + '\nthis.auth = PublishAuth;', c);
  c.auth.renderStatus = () => {};
  return { c, storage, input, auth: c.auth };
}
test('F1 credential boundary: legacy app/settings/shared keys grant no new writer credential', () => {
  const b = box({ conc_gh_token: 'fixture-shared-key', 'conc-door-gh-token-meta': '{"authModel":"fine-grained-pat-explicit-v1"}' });
  b.auth.migrateLegacyState();
  assert.equal(b.auth.getSavedToken(), '');
  assert.throws(() => b.auth._getSavedCredentials());
  assert.equal(JSON.parse(b.storage.concPublishOutbox).length, 1);
});
test('F1 credential boundary: validated replacement survives restart without entering legacy namespaces', () => {
  const b = box();
  b.auth.saveValidatedToken(' fixture-replacement-key ', 'fixture/door');
  assert.equal(b.auth.getSavedToken(), 'fixture-replacement-key');
  const legacy = [JSON.stringify(b.c.appSettings), b.storage['conc-door-settings'], b.storage.conc_gh_token, b.storage['conc-door-gh-token-meta']].join(' ');
  assert.ok(!legacy.includes('fixture-replacement-key'), 'an already-open legacy tab must never regain the replacement');
  const replacementKeys = Object.keys(b.storage).filter(k => b.storage[k].includes('fixture-replacement-key'));
  assert.equal(replacementKeys.length, 1, 'one atomic versioned credential record');
  assert.match(replacementKeys[0], /v[2-9]/i);
  const restarted = box(b.storage);
  assert.equal(restarted.auth._getSavedCredentials().token, 'fixture-replacement-key');
  assert.equal(JSON.parse(b.storage.concPublishOutbox).length, 1);
});
test('F1 credential boundary: quota cannot report a connection saved only in memory', () => {
  const b = box({}, true);
  try { b.auth.saveValidatedToken('fixture-replacement-key', 'fixture/door'); } catch {}
  assert.equal(b.auth.getSavedToken(), '');
  assert.ok(!JSON.stringify(b.c.appSettings).includes('fixture-replacement-key'));
});
test('F1 credential boundary: the validated destination survives stale legacy settings on restart', () => {
  const b = box();
  b.auth.saveValidatedToken('fixture-replacement-key', 'fixture/validated-destination');
  const restarted = box(b.storage);
  assert.equal(restarted.auth._getSavedCredentials().repo, 'fixture/validated-destination');
});
test('F1 credential boundary: disconnect removes replacement and retains pending staff work', async () => {
  const b = box(); b.auth.saveValidatedToken('fixture-replacement-key', 'fixture/door');
  await b.auth.forgetToken(false);
  assert.equal(b.auth.getSavedToken(), '');
  assert.equal(box(b.storage).auth.getSavedToken(), '');
  assert.equal(JSON.parse(b.storage.concPublishOutbox).length, 1);
});
test('F1 credential boundary: legacy HTA cannot invoke its old Git push writer', () => {
  const hta = fs.readFileSync(path.join(root, 'KitchenDOOR_Push.hta'), 'utf8');
  assert.doesNotMatch(hta, /gitExe\s*\+[^\n]*\\" push/);
  assert.doesNotMatch(hta, /gitExe\s*\+[^\n]*\\" add/);
});
