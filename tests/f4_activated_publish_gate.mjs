// 2026-11-09 (F4 switched on, v31-standard.62). The publish as it runs in the kitchen once F4 is on, through DOOR's real
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

// ── The F4 switch-on review (2026-11-09) ──
import { DAY_KEY, SWAP } from './helpers/door_publish_transaction_box.mjs';

test('P1: more than 32 receipt-free commits above the base still start sequence 1 (no bounded walk)', async () => {
  const remote = new ApplyingRemote();
  for (let i = 0; i < 40; i++) remote.externalUpdate({ 'recent_log.json': [{ n: i }] });
  const box = publishBox({ remote });
  const result = await box.publish();
  assert.equal(result?.ok, true, JSON.stringify(result).slice(0, 300));
  assert.deepEqual(remote.files['menu_current.json']._meta.flow.publication, { epoch: 'rexdale-f4-2026-11-09', sequence: 1 });
});

test('a counter that existed in history never restarts at sequence 1, even after the receipts were stripped', async () => {
  const box = publishBox();
  assert.equal((await box.publish())?.ok, true);
  const remote = box.remote;
  const stripped = {};
  for (const name of STAMPED) { const f = JSON.parse(JSON.stringify(remote.files[name])); delete f._meta.flow; if (f.flow) delete f.flow; stripped[name] = f; }
  stripped['door_flow_publication.json'] = null;
  remote.externalUpdate(stripped);
  const files = remote.files; delete files['door_flow_publication.json'];
  remote.revisions.set(remote.head, files); remote.trees.set(remote.commits.get(remote.head).tree, files);
  const fresh = publishBox({ remote });          // another computer: remembers nothing
  fresh.storage.concMenuBase = JSON.stringify(editedOverlay('Fixture After Strip', 1793793600003));
  const result = await fresh.publish();
  const pub = remote.files['menu_current.json']._meta.flow?.publication;
  assert.ok(!(result?.ok === true && pub && pub.sequence === 1), 'never sequence 1 again: ' + JSON.stringify({ result, pub }).slice(0, 300));
});

test('two computers racing on the first publish: one commit each, sequences 1 and 2', async () => {
  const remote = new ApplyingRemote();
  const a = publishBox({ remote }), b = publishBox({ remote });
  b.storage.concMenuBase = JSON.stringify(editedOverlay('Fixture B Dish', 1793793600004));
  remote.beforePatch = async () => { remote.beforePatch = null; const r = await a.publish(); assert.equal(r?.ok, true, 'A lands first'); };
  const rb = await b.publish();
  assert.equal(rb?.ok, true, 'B retries and lands: ' + JSON.stringify(rb).slice(0, 300));
  assert.equal(remote.visibleWrites.length, 2);
  assert.deepEqual(remote.visibleWrites.map(w => w.files['menu_current.json']._meta.flow.publication.sequence), [1, 2]);
});

test('a dated swap is in the first stamped routing projection', async () => {
  const box = publishBox({ swaps: { [DAY_KEY]: SWAP } });
  assert.equal((await box.publish())?.ok, true);
  const flow = box.remote.files['routing_by_meal.json'].flow;
  assert.ok(box.c.houseFlowRoutingValid(flow), 'a valid routing projection');
  const date = DAY_KEY.replace(/-(lunch|dinner)$/, ''), meal = DAY_KEY.split('-').pop();
  assert.ok(flow.dated[date] && flow.dated[date][meal], 'the swap date and meal are projected: ' + JSON.stringify(Object.keys(flow.dated)));
});
