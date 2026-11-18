// menu_save_message_gate (2026-11-18, back-on-track plan U4). After an Edit Menu save, one plain line says which
// rotation meal changed and where the change goes: sending to the kitchen, or kept on this computer with the reason.
// It replaced "Saved permanently to rotation", which said neither. Authored red on main 555dabb.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function fnBlock(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'missing function ' + name);
  let depth = 0, i = html.indexOf('{', start);
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}' && --depth === 0) { i++; break; } }
  return html.slice(start, i);
}
function message(cap, throws) {
  const c = { doorDeviceCapabilityInput: () => ({}), doorDeviceCapability: () => { if (throws) throw new Error('x'); return cap; } };
  vm.createContext(c); vm.runInContext(fnBlock('doorMenuSavedMessage'), c);
  return c.doorMenuSavedMessage('2', 'TUESDAY', 'lunch');
}

test('a connected computer says the meal and that it is sending', () => {
  const m = message({ canPublish: true, reasons: [] });
  assert.match(m, /Wk2 Tue lunch, every cycle/);
  assert.match(m, /Sending to the kitchen/);
});
test('an unconnected computer says the change stayed here, and why', () => {
  const m = message({ canPublish: false, reasons: [{ label: 'this computer is not connected to the kitchen — no connection key' }] });
  assert.match(m, /^Saved on this computer only: Wk2 Tue lunch/);
  assert.match(m, /Not sent to the kitchen: this computer is not connected/);
});
test('a failed capability check never claims it was sent', () => {
  assert.match(message(null, true), /Saved on this computer only/);
});
test('Edit Menu save uses the line; the old wording is gone', () => {
  assert.match(fnBlock('_finishMenuSave'), /showToast\(doorMenuSavedMessage\(week, day, period\)\)/);
  assert.ok(!html.includes('Saved permanently to rotation'));
  assert.ok(!html.includes('save to link'));
});
