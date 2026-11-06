// F1a gate author, 2026-11-06. Frozen behavioral expectations precede the build.
// These tests intentionally fail on 8066a1f; do not relax them to match that code.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ApplyingRemote, publishBox, initialRemote, plain, emptyOverlay, editedOverlay,
  DAY_KEY, CREATED, REMOVED, SWAP, CONSISTENCY_PATHS
} from './helpers/door_publish_transaction_box.mjs';

const portions = remote => remote.files['routing_by_meal.json'].routing['2'].FRIDAY.dinner._components;
const dependent = files => Object.fromEntries(CONSISTENCY_PATHS.map(path => [path, files[path]]));
const assertLanded = (box, result) => {
  assert.equal(result?.ok, true, 'healthy publish must complete, not merely avoid writing');
  assert.equal(box.remote.visibleWrites.length, 1, 'one complete visible commit');
  assert.equal(box.remote.visibleWrites[0].kind, 'atomic');
};

test('F1a control: synthetic menu/roster publishes one complete valid set', async () => {
  const box = publishBox();
  assertLanded(box, await box.publish());
  for (const path of CONSISTENCY_PATHS) assert.ok(path in box.remote.files, path);
  assert.deepEqual(portions(box.remote), { 'Fixture Rice': 1 });
  assert.equal(box.messages.some(x => String(x[0]).includes('structural defect')), false);
});

test('F1a: authoritative swap revert is merged before the first successful routing build', async () => {
  const remote = new ApplyingRemote(initialRemote({ 'meal_swaps_reverted.json': { [DAY_KEY]: REMOVED } }));
  const box = publishBox({ remote, swaps: { [DAY_KEY]: SWAP } });
  assertLanded(box, await box.publish());
  assert.deepEqual(remote.files['meal_swaps.json'], {}, 'other computer already reverted this swap');
  assert.deepEqual(remote.files['meal_swaps_reverted.json'], { [DAY_KEY]: REMOVED });
  assert.deepEqual(portions(remote), { 'Fixture Rice': 1 }, 'the first landed routing must describe the restored meal');
});

test('F1a: authoritative special removal is merged before deriving routing', async () => {
  const remote = new ApplyingRemote(initialRemote({ 'special_meals_removed.json': { [DAY_KEY]: REMOVED } }));
  const box = publishBox({ remote, specials: { [DAY_KEY]: { ...SWAP, specialName: 'Fixture Celebration' } } });
  assertLanded(box, await box.publish());
  assert.deepEqual(remote.files['special_meals.json'], {});
  assert.deepEqual(remote.files['special_meals_removed.json'], { [DAY_KEY]: REMOVED });
  assert.deepEqual(portions(remote), { 'Fixture Rice': 1 });
});

for (const failure of [503, 401, 'malformed', 404]) {
  test('F1a: unreadable revert history (' + failure + ') cannot erase it; first recovery is coherent', async () => {
    const remote = new ApplyingRemote(initialRemote({ 'meal_swaps_reverted.json': { [DAY_KEY]: REMOVED } }));
    const box = publishBox({ remote, swaps: { [DAY_KEY]: SWAP } });
    remote.failures.set('meal_swaps_reverted.json', failure);
    const before = dependent(remote.files);
    await box.publish();
    assert.deepEqual(dependent(remote.files), before, 'failed authoritative read must not release the dependency group');
    assert.equal(remote.visibleWrites.length, 0, 'no destructive candidate may reach the visible ref');
    assert.deepEqual(plain(box.c.loadMealSwaps()), { [DAY_KEY]: SWAP }, 'unsent local intent is retained');
    remote.failures.clear();
    assertLanded(box, await box.publish());
    assert.deepEqual(remote.files['meal_swaps_reverted.json'], { [DAY_KEY]: REMOVED });
    assert.deepEqual(remote.files['meal_swaps.json'], {});
    assert.deepEqual(portions(remote), { 'Fixture Rice': 1 }, 'one successful recovery, no second staff click');
  });
}

for (const failedPath of ['special_meals_removed.json', 'menu_overlay.json']) {
  test('F1a: unreadable ' + failedPath + ' cannot release dependent snapshots', async () => {
    const remote = new ApplyingRemote(initialRemote({
      'special_meals_removed.json': { [DAY_KEY]: REMOVED },
      'menu_overlay.json': editedOverlay('Fixture Cloud Rice')
    }));
    const box = publishBox({ remote, specials: { [DAY_KEY]: SWAP } });
    remote.failures.set(failedPath, 503);
    const before = dependent(remote.files);
    await box.publish();
    assert.deepEqual(dependent(remote.files), before);
    assert.equal(remote.visibleWrites.length, 0);
    remote.failures.clear();
    assertLanded(box, await box.publish());
    assert.deepEqual(portions(remote), { 'Fixture Cloud Rice': 1 });
  });
}

test('F1a: truly absent initial lists can be initialized within a readable pinned revision', async () => {
  const files = initialRemote();
  for (const path of ['meal_swaps.json', 'meal_swaps_reverted.json', 'special_meals.json', 'special_meals_removed.json']) delete files[path];
  const box = publishBox({ remote: new ApplyingRemote(files), swaps: { [DAY_KEY]: SWAP } });
  assertLanded(box, await box.publish());
  assert.deepEqual(box.remote.files['meal_swaps.json'], { [DAY_KEY]: SWAP });
  assert.deepEqual(portions(box.remote), { 'Fixture Sausage': 1 });
});

test('F1a: authoritative inputs are all read at the same immutable merge head', async () => {
  const box = publishBox();
  const initialHead = box.remote.head;
  assertLanded(box, await box.publish());
  const requiredReads = ['menu_overlay.json', 'meal_swaps.json', 'meal_swaps_reverted.json', 'special_meals.json', 'special_meals_removed.json'];
  for (const path of requiredReads) {
    const reads = box.remote.requests.filter(r => r.method === 'GET' && r.route === '/contents/' + path);
    assert.ok(reads.length, 'authoritative read required: ' + path);
    assert.ok(reads.every(r => r.ref === initialHead), path + ' must use the merge head, never moving main');
  }
});

for (const blockedPath of ['routing_by_meal.json', 'meal_swaps_reverted.json']) {
  test('F1a: a guard blocking ' + blockedPath + ' blocks the whole dependent group', async () => {
    const box = publishBox({ blockedPath, swaps: { [DAY_KEY]: SWAP } });
    const before = dependent(box.remote.files);
    await box.publish();
    assert.deepEqual(dependent(box.remote.files), before, 'atomic means dependency-atomic, not a coherent subset of files');
    assert.ok(box.remote.visibleWrites.every(w => JSON.stringify(dependent(w.files)) === JSON.stringify(before)));
    assert.deepEqual(plain(box.c.loadMealSwaps()), { [DAY_KEY]: SWAP });
  });
}

test('F1a: ref conflict rereads removals and rebuilds artifacts, not just their commit parent', async () => {
  const remote = new ApplyingRemote(initialRemote({ 'meal_swaps.json': { [DAY_KEY]: SWAP } }));
  const box = publishBox({ remote, swaps: { [DAY_KEY]: SWAP } });
  remote.beforePatch = r => r.externalUpdate({ 'meal_swaps.json': {}, 'meal_swaps_reverted.json': { [DAY_KEY]: REMOVED } });
  assertLanded(box, await box.publish());
  assert.deepEqual(remote.files['meal_swaps_reverted.json'], { [DAY_KEY]: REMOVED }, 'racing revert must survive');
  assert.deepEqual(remote.files['meal_swaps.json'], {});
  assert.deepEqual(portions(remote), { 'Fixture Rice': 1 });
  assert.ok(remote.requests.filter(r => r.route === '/contents/meal_swaps_reverted.json').length >= 2, 'conflict needs a fresh authoritative merge');
});

test('F1a: an edit made while the commit is in flight remains durable and pending', async () => {
  const box = publishBox();
  box.c.doorOutboxAppend('fixture original edit', 'pending');
  const newer = editedOverlay('Fixture Newer Local Dish', 1793793600001);
  box.remote.beforePatch = () => {
    // Simulate the local persistence/queue edge while HTTP is awaiting the ref update.
    box.storage.concMenuBase = JSON.stringify(newer);
    box.c.doorOutboxAppend('fixture newer edit', 'pending');
  };
  assertLanded(box, await box.publish());
  assert.deepEqual(JSON.parse(box.storage.concMenuBase), newer, 'publish acknowledgement must not restore its older overlay over a newer edit');
  assert.ok(box.c.doorOutboxRead().some(x => x.context === 'fixture newer edit'), 'only the committed generation is acknowledged');
});

test('F1a control: interruption before the ref update leaves remote files and local intent intact', async () => {
  const box = publishBox({ swaps: { [DAY_KEY]: SWAP } });
  const before = box.remote.files;
  box.c.doorOutboxAppend('fixture swap', 'pending');
  box.remote.beforePatch = () => { throw new Error('fixture disconnect before ref update'); };
  const result = await box.publish();
  assert.ok(result.error || result.skipped, 'interruption must not be reported as a landed publish');
  assert.deepEqual(box.remote.files, before);
  assert.deepEqual(plain(box.c.loadMealSwaps()), { [DAY_KEY]: SWAP });
  assert.ok(box.c.doorOutboxRead().length);
  // Recreate the VM to prove the local store, rather than an in-memory closure, is enough to recover.
  const restarted = publishBox({ remote: box.remote, storage: box.storage });
  assertLanded(restarted, await restarted.publish());
  assert.deepEqual(portions(restarted.remote), { 'Fixture Sausage': 1 });
});

for (const entry of ['saveMealSwaps', 'saveSpecialMeals', 'saveMenuBaseOverlay', 'swap removal timer', 'special removal timer']) {
  test('F1a writer boundary: ' + entry + ' cannot side-publish one dependent file', async () => {
    const box = publishBox();
    if (entry === 'saveMealSwaps') box.c.saveMealSwaps({ [DAY_KEY]: SWAP });
    else if (entry === 'saveSpecialMeals') box.c.saveSpecialMeals({ [DAY_KEY]: SWAP });
    else if (entry === 'saveMenuBaseOverlay') box.c.saveMenuBaseOverlay(editedOverlay('Fixture Edited Rice'));
    else if (entry === 'swap removal timer') box.c.REVERTED_SWAP_KEYS.add(DAY_KEY, REMOVED);
    else box.c.REMOVED_SPECIAL_KEYS.add(DAY_KEY, REMOVED);
    await box.flush();
    assert.equal(box.remote.visibleWrites.filter(w => w.kind === 'single' && CONSISTENCY_PATHS.includes(w.path)).length, 0,
      'this real store/timer must enter the coherent publisher, not bypass it');
    assert.ok(box.remote.visibleWrites.some(w => w.kind === 'atomic'), 'healthy dependent edit must still reach the kitchen');
  });
}
