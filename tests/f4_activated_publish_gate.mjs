// 2026-11-09 (F4 switched on, v31-standard.61). The publish as it runs in the kitchen once F4 is on, through DOOR's real
// publisher in the F1 publish box (tests/helpers/door_publish_transaction_box.mjs). The F4/F6 browser contracts keep
// checking the pre-activation rules on a copy with the activation constants blanked (tests/helpers/pre_activation_html.mjs).
//   1. the first publish after activation: its walk reaches DOOR_FLOW_ACTIVATION_BASE and starts sequence 1 in the epoch;
//      every stamped file carries the one receipt and the site (menu_overlay.json never carried a site, and the delivery
//      check needs it), and the publication counter rides in the same commit;
//   2. the next publish reads the counter and takes sequence 2;
//   3. a head with a receipt nothing explains (no counter, no history to the base) is held: nothing is written.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ApplyingRemote, publishBox, initialRemote, editedOverlay, ACTIVATION_BASE } from './helpers/door_publish_transaction_box.mjs';

const STAMPED = ['menu_current.json', 'menu_overlay.json', 'routing_by_meal.json', 'registry_summary.json', 'door_state.json'];
const canon = v => JSON.stringify(v);

test('F4 is on in this build (the activation base is set)', () => {
  assert.match(ACTIVATION_BASE, /^[0-9a-f]{40}$/);
});

test('the first activated publish starts sequence 1, stamps every file with one receipt and the site, and writes the counter', async () => {
  const box = publishBox();
  assert.equal(box.remote.head, ACTIVATION_BASE, 'the receipt-free starting set sits on the activation base');
  const result = await box.publish();
  assert.equal(result?.ok, true, 'the publish completes: ' + JSON.stringify(result).slice(0, 300));
  assert.equal(box.remote.visibleWrites.length, 1);
  const files = box.remote.files;
  const flow = files['menu_current.json']._meta.flow;
  assert.ok(box.c.houseFlowReceiptValid(flow), 'a valid receipt');
  assert.deepEqual(flow.publication, { epoch: 'rexdale-f4-2026-11-09', sequence: 1 });
  for (const name of STAMPED) {
    assert.equal(canon(files[name]._meta.flow), canon(flow), name + ' carries the same receipt');
    assert.equal(files[name]._meta.site, 'rexdale', name + ' names its site');
  }
  assert.equal(canon(files['door_flow_publication.json'].flow), canon(flow), 'the counter holds the same receipt');
  assert.equal(files['routing_by_meal.json'].flow.inputRevision, flow.inputRevision, 'the dated routing projection is bound to the receipt');
});

test('the next publish reads the counter and takes sequence 2', async () => {
  const box = publishBox();
  assert.equal((await box.publish())?.ok, true);
  box.storage.concMenuBase = JSON.stringify(editedOverlay('Fixture Second Dish', 1793793600002));
  const second = await box.publish();
  assert.equal(second?.ok, true, JSON.stringify(second).slice(0, 300));
  const files = box.remote.files;
  assert.deepEqual(files['menu_current.json']._meta.flow.publication, { epoch: 'rexdale-f4-2026-11-09', sequence: 2 });
  assert.equal(canon(files['door_flow_publication.json'].flow), canon(files['menu_current.json']._meta.flow));
  assert.equal(box.remote.visibleWrites.length, 2);
});

test('a receipt nothing explains (no counter, no history to the base) holds the publish and writes nothing', async () => {
  const start = initialRemote();
  const box0 = publishBox();
  assert.equal((await box0.publish())?.ok, true);
  const orphan = box0.remote.files['menu_current.json']._meta.flow;
  for (const name of STAMPED) start[name]._meta = { ...start[name]._meta, site: 'rexdale', flow: orphan };
  const remote = new ApplyingRemote(start);   // a receipt-carrying set sits on a commit that is not the base
  assert.notEqual(remote.head, ACTIVATION_BASE);
  const box = publishBox({ remote });
  const result = await box.publish();
  assert.notEqual(result?.ok, true, 'held');
  assert.equal(remote.visibleWrites.length, 0, 'nothing is written');
  assert.ok(box.messages.some(m => /could not be established/.test(m.map(x => x && x.message ? x.message : String(x)).join(' '))), 'it says why');
});
