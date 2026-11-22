// tests/breakfast_note_autofill_gate.mjs — 2026-11-22 (Jason: the breakfast note box filled in his saved login name).
// The browser's password manager paired a free-text box with DOOR's connection-key field and put a saved username in
// it. Both breakfast note boxes turn autofill off, and the connection-key fields say they are a new secret
// (autocomplete="new-password"), so no saved login is offered or paired with a box near them. Authored red on main.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const tag = (re) => { const m = html.match(re); assert.ok(m, 'missing ' + re); return m[0]; };

test('BA-1 both breakfast note boxes turn autofill off', () => {
  for (const id of ['change-breakfast-note', 'ce-breakfast-note']) {
    const t = tag(new RegExp('<input[^>]*id="' + id + '"[^>]*>'));
    assert.match(t, /autocomplete="off"/, id);
    assert.match(t, /name="door-breakfast-note/, id + ' has its own name');
  }
});
test('BA-2 every connection-key field is a new secret, so no saved login is filled or paired', () => {
  const keys = html.match(/<input[^>]*type="password"[^>]*>/g) || [];
  assert.ok(keys.length >= 3);
  for (const t of keys) assert.match(t, /autocomplete="new-password"/, t.slice(0, 60));
});
