// P1 — persistent device-capability banner.
// (DOOR_DEVICE_PUBLISH_RESILIENCE_ACTION_PLAN_2026-09-11.md §5 P1)
//
// A device that cannot publish used to say so only as a one-shot red sync-bar line
// under Generate. Three months of daily entries died on one machine that way.
// P1 adds a STANDING banner on Enter Changes driven by a pure capability function:
// what is missing (connection key / operator name / auto-publish off / stale tab /
// last publish skipped-or-failed), how much work exists only on this device, and
// one button per fix. It never blocks import or Generate.
//
// Authored-to-fail: against pre-P1 index.html the helpers and the skip-reason map
// are missing, and neither the daily prompt nor the publish paths record anything.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function fnBlock(name) {
  const m = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(html);
  assert.ok(m, 'missing function ' + name);
  let depth = 0, i = html.indexOf('{', m.index);
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) break; }
  }
  return html.slice(m.index, i + 1);
}
function constBlock(name) {
  const start = html.indexOf('const ' + name + ' =');
  assert.ok(start >= 0, 'missing const ' + name);
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) break; }
  }
  // include the closing `)` of Object.freeze(...) and the `;`
  const end = html.indexOf(';', i);
  return html.slice(start, end + 1);
}

const GOOD = {
  hasToken: true, tokenExpired: false, operatorName: 'Joan', autoPublishOn: true, tabStale: false,
  lastSkip: null, lastError: null, lastGeneratedAt: '2026-09-11T10:00:00Z', lastPublishOkAt: '2026-09-11T10:00:05Z'
};

function loadPure() {
  const sb = { console };
  vm.createContext(sb);
  vm.runInContext(constBlock('DOOR_PUBLISH_SKIP_REASONS') + '\n' + fnBlock('doorDeviceCapability'), sb);
  return sb;
}
function cap(sb, overrides) {
  return vm.runInContext('doorDeviceCapability(' + JSON.stringify({ ...GOOD, ...overrides }) + ')', sb);
}

test('P1 symbols exist', () => {
  ['doorDeviceCapability', 'doorDeviceCapabilityInput', '_doorDeviceBannerHTML', 'doorDeviceBannerFix'].forEach(n =>
    assert.ok(new RegExp('function\\s+' + n + '\\s*\\(').test(html), 'missing ' + n));
  assert.ok(/const DOOR_PUBLISH_SKIP_REASONS\s*=/.test(html), 'missing DOOR_PUBLISH_SKIP_REASONS');
});

test('capability: a fully connected, published-up-to-date device has no reasons, no banner', () => {
  const sb = loadPure();
  const c = cap(sb, {});
  assert.equal(c.canPublish, true);
  assert.equal(c.reasons.length, 0);
  assert.equal(c.unpublished.pending, false);
  assert.equal(c.level, 'none');
});

test('capability: each missing prerequisite is its own reason with the right fix action', () => {
  const sb = loadPure();
  const one = (o) => { const c = cap(sb, o); assert.equal(c.canPublish, false, JSON.stringify(o)); assert.equal(c.reasons.length, 1, JSON.stringify(o)); return c.reasons[0]; };
  assert.equal(one({ hasToken: false }).action, 'connect');
  assert.equal(one({ tokenExpired: true }).action, 'connect');
  assert.equal(one({ operatorName: '' }).action, 'name');
  assert.equal(one({ autoPublishOn: false }).action, 'settings');
  assert.equal(one({ tabStale: true }).action, 'reload');
  // combined: all five, distinct codes
  const c = cap(sb, { hasToken: false, tokenExpired: true, operatorName: '', autoPublishOn: false, tabStale: true });
  assert.equal(new Set(c.reasons.map(r => r.code)).size, c.reasons.length);
  assert.ok(c.reasons.length >= 4);
});

test('capability: staff-facing copy never says "token" or "GitHub" (F4 ruling)', () => {
  const sb = loadPure();
  const c = cap(sb, { hasToken: false, tokenExpired: true, operatorName: '', autoPublishOn: false, tabStale: true, lastSkip: { reason: 'missing_auth', message: 'x', at: '2026-09-11T09:00:00Z' } });
  const text = c.reasons.map(r => r.label).join(' ');
  assert.ok(!/token|github/i.test(text), 'staff copy leaked GitHub vocabulary: ' + text);
  const map = vm.runInContext('DOOR_PUBLISH_SKIP_REASONS', sb);
  Object.values(map).forEach(v => assert.ok(!/token|github/i.test(v.label), v.label));
});

test('capability: unpublished work = last Generate newer than last successful publish → level red', () => {
  const sb = loadPure();
  const pending = cap(sb, { lastGeneratedAt: '2026-09-11T12:00:00Z', lastPublishOkAt: '2026-09-11T10:00:00Z' });
  assert.equal(pending.unpublished.pending, true);
  assert.equal(pending.unpublished.since, '2026-09-11T12:00:00Z');
  assert.equal(pending.level, 'red');
  // never published at all but generated → pending
  assert.equal(cap(sb, { lastPublishOkAt: null }).unpublished.pending, true);
  // never generated → nothing pending
  assert.equal(cap(sb, { lastGeneratedAt: null, lastPublishOkAt: null }).unpublished.pending, false);
  // a reason with nothing pending → amber
  assert.equal(cap(sb, { hasToken: false }).level, 'amber');
});

test('capability: the last skipped publish surfaces through the reason map', () => {
  const sb = loadPure();
  const c = cap(sb, { lastSkip: { reason: 'stale-tab', message: 'stale tab — reload', at: '2026-09-11T09:00:00Z' } });
  const r = c.reasons.find(x => x.code === 'last-skip');
  assert.ok(r, 'last skip must become a reason');
  assert.equal(r.action, 'reload');
  // unknown reason code degrades to a generic line, never throws
  const u = cap(sb, { lastSkip: { reason: 'something_new', message: 'm', at: '2026-09-11T09:00:00Z' } });
  assert.ok(u.reasons.find(x => x.code === 'last-skip'));
});

test('every publish skip reason the app can emit has a banner mapping', () => {
  const sb = loadPure();
  const map = vm.runInContext('DOOR_PUBLISH_SKIP_REASONS', sb);
  const emitted = new Set();
  const src = fnBlock('_doPublishToGitHub') + fnBlock('_ghEvaluateWriteGuards') + fnBlock('publishAndSync');
  for (const m of src.matchAll(/reason\s*:\s*'([^']+)'/g)) emitted.add(m[1]);
  // PublishAuth.sidePublish emits two more
  for (const m of html.matchAll(/return (?:Promise\.resolve\()?\{\s*skipped\s*:\s*true,\s*reason\s*:\s*'([^']+)'/g)) emitted.add(m[1]);
  assert.ok(emitted.size >= 8, 'expected to discover the app\'s skip reasons, found ' + [...emitted]);
  const unmapped = [...emitted].filter(r => !map[r]);
  assert.deepEqual(unmapped, [], 'skip reasons without banner copy');
});

test('banner renderer: no banner when nothing to say; escapes text; one button per reason', () => {
  const sb = loadPure();
  sb.escapeHtml = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  sb._escAttr = s => String(s).replace(/"/g, '&quot;');
  sb.localStorage = { getItem: () => null };
  sb.document = { documentElement: { getAttribute: () => null } };
  vm.runInContext(fnBlock('_doorDeviceBannerHTML'), sb);
  const render = (c) => vm.runInContext('_doorDeviceBannerHTML(' + JSON.stringify(c) + ')', sb);
  assert.equal(render(cap(sb, {})), '');
  const hostile = cap(sb, { lastSkip: { reason: 'error', message: '<img src=x onerror=alert(1)>', at: '2026-09-11T09:00:00Z' } });
  const out = render(hostile);
  assert.ok(!out.includes('<img'), 'skip message must be escaped');
  const many = render(cap(sb, { hasToken: false, operatorName: '', tabStale: true }));
  assert.equal((many.match(/doorDeviceBannerFix\(/g) || []).length, 3, 'one fix button per reason');
});

test('wiring: daily prompt renders the device banner in BOTH branches; publish paths record ok/skip', () => {
  const prompt = fnBlock('updateDailyImportPrompt');
  assert.ok(/_doorDeviceBannerHTML\(/.test(prompt), 'updateDailyImportPrompt must build the device banner');
  assert.ok((prompt.match(/_deviceBanner/g) || []).length >= 3, 'device banner must be inserted in both the imported-today and start-today branches');
  const pas = fnBlock('publishAndSync');
  assert.ok(/concLastPublishSkip/.test(pas), 'publishAndSync must record the last skip');
  assert.ok(/updateDailyImportPrompt\(\)/.test(pas), 'publishAndSync must refresh the banner');
  const pub = fnBlock('_doPublishToGitHub');
  assert.ok(/concLastPublishOk/.test(pub), '_doPublishToGitHub must record the last successful publish');
  assert.ok(/removeItem\('concLastPublishSkip'\)/.test(pub), 'a successful publish must clear the last skip');
});
