// Independently authored after F1a build, 2026-11-06. Expectations are the reviewed
// transaction/recovery contract, not a snapshot of the builder's implementation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RecoveryRemote, recoveryBox, roster, initialRemote, plain } from './helpers/door_publish_recovery_box.mjs';
import { DAY_KEY, SWAP, REMOVED, editedOverlay } from './helpers/door_publish_transaction_box.mjs';

const slot = remote => remote.files['routing_by_meal.json'].routing['2'].FRIDAY.dinner;
const roomNames = state => state.residents.map(r => r.room).sort();
const crashAfterRef = async box => {
  box.c.doorOutboxAppend('fixture owed edit', 'pending');
  box.remote.afterPatch = () => { throw new Error('fixture crash: ref accepted, acknowledgement lost'); };
  const result = await box.publish();
  assert.ok(result.error || result.skipped);
  assert.equal(box.remote.visibleWrites.length, 1, 'the ref really landed before the simulated crash');
};

test('F1b: real guards and newer authoritative registry share the same immutable input revision', async () => {
  const shared = roster(['TEST-R', 'TEST-A'], '2026-11-04T11:00:00.000Z', ['TEST-A']);
  const remote = new RecoveryRemote(initialRemote({ 'door_state.json': shared }));
  const box = recoveryBox({ remote }); const head = remote.head;
  assert.equal((await box.publish()).ok, true);
  assert.deepEqual(roomNames(remote.files['door_state.json']), ['TEST-A', 'TEST-R']);
  assert.deepEqual(remote.files['door_state.json'].anaphRooms, ['TEST-A']);
  assert.equal(remote.files['registry_summary.json'].headcounts.total, 2);
  assert.equal(slot(remote).Regular, 1, 'derived routing uses selected anaphylactic routing, not the old local cohort');
  assert.deepEqual(roomNames(JSON.parse(box.storage.concRegistryState)), ['TEST-A', 'TEST-R']);
  assert.ok(remote.readCounts.get('door_state.json') >= 2, 'both authoritative data and the real guard were read');
  assert.ok(remote.requests.filter(r => r.method === 'GET' && r.route.startsWith('/contents/')).every(r => r.ref === head),
    'registry, menu/deltas and guard reads must all be pinned');
});

test('F1b: an authoritative registry read failure cannot publish a local cohort', async () => {
  const remote = new RecoveryRemote(initialRemote({ 'door_state.json': roster(['TEST-NEW'], '2026-11-04T11:00:00.000Z') }));
  const box = recoveryBox({ remote }); remote.failures.set('door_state.json', 503);
  await box.publish(); assert.equal(remote.visibleWrites.length, 0);
  assert.deepEqual(roomNames(remote.files['door_state.json']), ['TEST-NEW']);
  assert.deepEqual(roomNames(JSON.parse(box.storage.concRegistryState)), ['TEST-LOCAL']);
});

test('F1b: a failed pinned guard read holds the entire group even after all input reads succeed', async () => {
  const remote = new RecoveryRemote(initialRemote()); const box = recoveryBox({ remote });
  remote.onRead = ({ file, count }) => { if (file === 'door_state.json' && count === 2) remote.failures.set(file, 503); };
  await box.publish();
  assert.ok(remote.readCounts.get('door_state.json') >= 2);
  assert.equal(remote.visibleWrites.length, 0, 'a guard-read failure is not permission to release an unchecked set');
});

test('F1b: repeated competing commits stop after bounded fresh attempts and retain local intent', async () => {
  const remote = new RecoveryRemote(initialRemote()); const box = recoveryBox({ remote, swaps: { [DAY_KEY]: SWAP } });
  box.c.doorOutboxAppend('fixture swap', 'pending');
  let conflicts = 0;
  const moveRef = r => { conflicts++; r.externalUpdate({ 'fixture_unrelated.json': { revision: conflicts } }); r.beforePatch = moveRef; };
  remote.beforePatch = moveRef;
  const result = await box.publish();
  assert.ok(result.error || result.skipped, 'bounded failure must not masquerade as success');
  assert.ok(conflicts >= 2 && conflicts <= 5, 'use a small bounded retry, not an unbounded publish loop');
  assert.equal(remote.visibleWrites.length, 0);
  const mergeHeads = new Set(remote.requests.filter(r => r.method === 'GET' && r.route === '/contents/meal_swaps_reverted.json').map(r => r.ref));
  assert.equal(mergeHeads.size, conflicts, 'each attempt remerges authoritative inputs at a fresh head (guards may reread it)');
  assert.deepEqual(plain(box.c.loadMealSwaps()), { [DAY_KEY]: SWAP });
  assert.ok(box.c.doorOutboxRead().length, 'failed attempts retain debt');
});

test('F1b: restart recognizes a committed-but-unacknowledged revision without replaying it', async () => {
  const box = recoveryBox({ swaps: { [DAY_KEY]: SWAP } }); await crashAfterRef(box);
  assert.deepEqual(box.remote.files['meal_swaps.json'], { [DAY_KEY]: SWAP });
  const restarted = recoveryBox({ remote: box.remote, storage: box.storage });
  assert.equal((await restarted.publish()).ok, true);
  assert.equal(box.remote.visibleWrites.length, 1, 'reconcile the known commit; do not replay an already-landed operation');
  assert.equal(restarted.c.doorOutboxRead().length, 0);
});

test('F1b: restart rebases a newer local edit after an uncertain committed write', async () => {
  const box = recoveryBox(); await crashAfterRef(box);
  const newer = editedOverlay('Fixture Newer After Crash', 1793793600001);
  box.storage.concMenuBase = JSON.stringify(newer);
  box.c.doorOutboxAppend('fixture edit after uncertain commit', 'pending');
  const restarted = recoveryBox({ remote: box.remote, storage: box.storage });
  assert.equal((await restarted.publish()).ok, true);
  assert.equal(box.remote.visibleWrites.length, 2, 'exactly one genuinely newer content operation follows the uncertain commit');
  assert.equal(box.remote.files['menu_current.json'].menu['2'].FRIDAY.dinner, 'Fixture Newer After Crash');
  assert.equal(JSON.parse(box.storage.concMenuBase)['2'].FRIDAY.dinner, 'Fixture Newer After Crash');
  assert.equal(restarted.c.doorOutboxRead().length, 0);
});

test('F1b: registry edits made during the write stay local and owed until a later complete publish', async () => {
  const box = recoveryBox();
  const newer = roster(['TEST-NEWER-A'], '2026-11-04T13:00:00.000Z', ['TEST-NEWER-A']);
  box.remote.beforePatch = () => { box.setRegistry(newer); box.c.doorOutboxAppend('fixture new anaphylactic resident', 'pending'); };
  assert.equal((await box.publish()).ok, true);
  assert.deepEqual(roomNames(JSON.parse(box.storage.concRegistryState)), ['TEST-NEWER-A']);
  assert.deepEqual(box.c.anaphRooms, ['TEST-NEWER-A']);
  assert.ok(box.c.doorOutboxRead().length);
  const restarted = recoveryBox({ remote: box.remote, storage: box.storage });
  assert.equal((await restarted.publish()).ok, true);
  assert.deepEqual(roomNames(box.remote.files['door_state.json']), ['TEST-NEWER-A']);
  assert.deepEqual(box.remote.files['door_state.json'].anaphRooms, ['TEST-NEWER-A']);
  assert.equal(slot(box.remote).Regular, 0, 'legitimate zero regular cohort is preserved');
});

test('F1b: outbox cap movement cannot leave committed generations owed or clear newer ones', async () => {
  const box = recoveryBox();
  for (let i = 0; i < 49; i++) box.c.doorOutboxAppend('fixture old ' + i, 'pending');
  box.remote.beforePatch = () => {
    box.c.doorOutboxAppend('fixture newer one', 'pending');
    box.c.doorOutboxAppend('fixture newer two', 'pending');
  };
  assert.equal((await box.publish()).ok, true);
  assert.deepEqual(Array.from(box.c.doorOutboxRead(), x => x.context), ['fixture newer one', 'fixture newer two'],
    'acknowledge operation identities, not only an array prefix that the cap can shift');
});

test('F1b: persistent storage failure before publish never changes the remote ref or staff state', async () => {
  const box = recoveryBox({ swaps: { [DAY_KEY]: SWAP } });
  const staffState = { registry: box.storage.concRegistryState, swaps: box.storage.concMealSwaps };
  box.c.localStorage.setItem = () => { throw Object.assign(new Error('fixture full storage'), { name: 'QuotaExceededError' }); };
  const result = await box.publish();
  assert.ok(result.error || result.skipped);
  assert.equal(box.remote.visibleWrites.length, 0);
  assert.deepEqual({ registry: box.storage.concRegistryState, swaps: box.storage.concMealSwaps }, staffState);
});

test('F1b: persistent failure to persist the prepared commit prevents the ref update', async () => {
  const box = recoveryBox({ swaps: { [DAY_KEY]: SWAP } });
  const set = box.c.localStorage.setItem;
  box.c.localStorage.setItem = (key, value) => {
    if (key === 'concPublishTransaction' && JSON.parse(value).status === 'prepared') throw new Error('fixture prepared receipt quota');
    set(key, value);
  };
  const result = await box.publish();
  assert.ok(result.error || result.skipped);
  assert.equal(box.remote.visibleWrites.length, 0);
  assert.deepEqual(plain(box.c.loadMealSwaps()), { [DAY_KEY]: SWAP });
});

test('F1b: receipt quota failure after remote commit is recoverable on restart without replay', async () => {
  const box = recoveryBox(); box.c.doorOutboxAppend('fixture owed receipt', 'pending');
  const set = box.c.localStorage.setItem;
  box.remote.afterPatch = () => {
    box.c.localStorage.setItem = (key, value) => {
      if (key === 'concPublishTransaction') throw new Error('fixture acknowledgement quota');
      set(key, value);
    };
  };
  const result = await box.publish();
  assert.ok(result.error || result.skipped);
  assert.equal(box.remote.visibleWrites.length, 1);
  const restarted = recoveryBox({ remote: box.remote, storage: box.storage });
  assert.equal((await restarted.publish()).ok, true);
  assert.equal(box.remote.visibleWrites.length, 1, 'durable prepared receipt resolves the accepted ref despite failed local acknowledgement');
  assert.equal(restarted.c.doorOutboxRead().length, 0);
});

for (const kind of ['swap', 'special']) test('F1b: actual ' + kind + ' removal entry publishes removal and routing together', async () => {
  const remote = new RecoveryRemote(initialRemote({ [kind === 'swap' ? 'meal_swaps.json' : 'special_meals.json']: { [DAY_KEY]: SWAP } }));
  const box = recoveryBox({ remote, ...(kind === 'swap' ? { swaps: { [DAY_KEY]: SWAP } } : { specials: { [DAY_KEY]: SWAP } }) });
  box.installEntryPoints();
  if (kind === 'swap') box.c.revertSwapFromBanner(DAY_KEY); else await box.c.removeSpecialMeal(DAY_KEY);
  await box.flush();
  assert.ok(remote.visibleWrites.length > 0, 'healthy actual entry still publishes');
  for (const write of remote.visibleWrites) {
    assert.equal(write.kind, 'atomic');
    assert.deepEqual(write.files[kind === 'swap' ? 'meal_swaps.json' : 'special_meals.json'], {});
    assert.ok(write.files[kind === 'swap' ? 'meal_swaps_reverted.json' : 'special_meals_removed.json'][DAY_KEY]);
    assert.ok('Fixture Rice' in write.files['routing_by_meal.json'].routing['2'].FRIDAY.dinner._components);
  }
});

test('F1b: actual Swap Slots publishes both dated halves and their routing in every visible commit', async () => {
  const box = recoveryBox(); box.installEntryPoints();
  box.c.executeSlotSwap({ week: 2, day: 'THURSDAY', period: 'dinner' }, { week: 2, day: 'FRIDAY', period: 'dinner' });
  await box.flush(); assert.ok(box.remote.visibleWrites.length > 0);
  for (const write of box.remote.visibleWrites) {
    assert.equal(write.kind, 'atomic');
    assert.deepEqual(Object.keys(write.files['meal_swaps.json']).sort(), ['2026-11-05-dinner', DAY_KEY]);
    assert.equal(write.files['meal_swaps.json'][DAY_KEY].specialName, 'Fixture Lentils');
    assert.ok('Fixture Lentils' in write.files['routing_by_meal.json'].routing['2'].FRIDAY.dinner._components);
  }
});
