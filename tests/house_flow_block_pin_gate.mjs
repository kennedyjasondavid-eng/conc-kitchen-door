// 2026-11-08 (F4 readers prep; HOUSE_PROVEN_SEAMS.md row 11). Prevents: DOOR's shared flow-validity block changing
// while EXPO's and HUB's byte-for-byte copies don't, so the apps check F4 receipts by different rules and the counts
// staff see are certified one way and read another (HOUSE rule: a cross-app contract changes in one change set).
//
// The block is DOOR's /* HOUSE_TESTABLE_CORE_START flow-validity */ … END marker region. EXPO and HUB carry the same
// pinned digest in their own gates once they copy it (F4 + D1, after EXPO's U1). To change the block: change it here,
// in EXPO and in HUB together, and update FLOW_BLOCK_SHA256 in all three gates in the same change set.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const FLOW_BLOCK_SHA256 = 'a81d86f5ee1e389d6cfc69bade4bacbefdd669d9cc10f0c55688765334f6c527';
const START = '/* HOUSE_TESTABLE_CORE_START flow-validity */';
const END = '/* HOUSE_TESTABLE_CORE_END flow-validity */';

test('DOOR\'s shared flow-validity block is the pinned one EXPO and HUB copy', () => {
  // Line endings normalized: the repo's checkout may be CRLF on Windows (autocrlf), LF in CI.
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
  const a = html.indexOf(START), e = html.indexOf(END);
  assert.ok(a >= 0 && e > a, 'the flow-validity block and its markers are present');
  assert.equal(html.indexOf(START, a + 1), -1, 'one block only');
  const block = html.slice(a, e + END.length);
  const digest = createHash('sha256').update(block, 'utf8').digest('hex');
  assert.equal(digest, FLOW_BLOCK_SHA256,
    'the shared block changed: change EXPO\'s and HUB\'s copies and all three pinned digests in the same change set');
});
