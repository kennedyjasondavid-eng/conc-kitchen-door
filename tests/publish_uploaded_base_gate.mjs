// F1c: the accepted uploaded base belongs to the same frozen publish input as
// overlays, dated changes and residents. Gate authored before its product repair.
import test from 'node:test';
import assert from 'node:assert/strict';
import { publishBox, ApplyingRemote, initialRemote, plain } from './helpers/door_publish_transaction_box.mjs';

const remoteTime = Date.parse('2026-11-04T12:00:00Z');
const makeMenu = name => { const m = initialRemote()['menu_current.json'].menu; m['2'].FRIDAY.dinner = name; return m; };
function fixture({ localTime = remoteTime - 1000 } = {}) {
  const cloud = initialRemote();
  cloud['menu_current.json'].menu = makeMenu('Fixture Cloud Accepted');
  const storage = { concUploadedMenu: JSON.stringify(makeMenu('Fixture Local Upload')), concUploadedMenuTimestamp: String(localTime) };
  const b = publishBox({ remote: new ApplyingRemote(cloud), storage });
  b.c.MENU_DATA = makeMenu('Fixture Baked');
  b.c.getDoorPublishMenuOverlayOverride = () => b.c._doorPublishMenuOverlayOverride;
  b.load('loadUploadedMenu', 'mergeDoorMenuDataWithOverlay', 'getMenuData');
  b.c.buildMenuJSON = () => ({ ...plain(cloud['menu_current.json']), menu: plain(b.c.getMenuData()) });
  return b;
}
test('F1c: an older imported base cannot replace a newer accepted cloud menu', async () => {
  const b = fixture();
  const result = await b.publish(); assert.ifError(result.error); assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(b.remote.files['menu_current.json'].menu['2'].FRIDAY.dinner, 'Fixture Cloud Accepted');
  assert.equal(JSON.parse(b.storage.concUploadedMenu)['2'].FRIDAY.dinner, 'Fixture Cloud Accepted');
});
test('F1c control: a newer unsent workbook upload survives and becomes the accepted base', async () => {
  const b = fixture({ localTime: remoteTime + 1000 });
  const result = await b.publish(); assert.ifError(result.error); assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(b.remote.files['menu_current.json'].menu['2'].FRIDAY.dinner, 'Fixture Local Upload');
});
test('F1c: an upload during the ref request remains local and pending after acknowledgement', async () => {
  const b = fixture();
  b.c.doorOutboxAppend('fixture original operation', 'pending');
  b.remote.beforePatch = () => {
    b.storage.concUploadedMenu = JSON.stringify(makeMenu('Fixture Newer Upload'));
    b.storage.concUploadedMenuTimestamp = String(remoteTime + 2000);
    b.c.doorOutboxAppend('fixture concurrent workbook', 'pending');
  };
  const result = await b.publish(); assert.ifError(result.error); assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(b.remote.files['menu_current.json'].menu['2'].FRIDAY.dinner, 'Fixture Cloud Accepted');
  assert.equal(JSON.parse(b.storage.concUploadedMenu)['2'].FRIDAY.dinner, 'Fixture Newer Upload');
  assert.ok(b.c.doorOutboxRead().some(x => x.context === 'fixture concurrent workbook'));
});
test('F1c: a ref conflict reselects a newer accepted cloud base before rebuilding', async () => {
  const b = fixture();
  b.remote.beforePatch = r => r.externalUpdate({ 'menu_current.json': {
    ...r.files['menu_current.json'], _meta: { ...r.files['menu_current.json']._meta, exported: '2026-11-04T12:00:01Z' },
    menu: makeMenu('Fixture Concurrent Cloud')
  } });
  const result = await b.publish(); assert.ifError(result.error); assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(b.remote.files['menu_current.json'].menu['2'].FRIDAY.dinner, 'Fixture Concurrent Cloud');
});
