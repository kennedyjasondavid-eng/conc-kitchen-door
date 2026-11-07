// Advisory, never blocking (Jason, 2026-11-07; HOUSE rule "checks never read live data" — this one reads it on
// purpose, so it only reports). It says when DOOR's built-in offline recipe list has fallen behind CODEX's live
// feed: a computer without internet would then show different allergen warnings from one online.
// Refresh the list from CODEX (as on 2026-11-07, from main 096ee08) when it reports a difference.
import test from 'node:test';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const offline = JSON.parse(/const DOOR_RECIPE_DATA_FALLBACK = (\[.*?\]);\n/.exec(html)[1]);
const fam = (list) => new Set((list || []).map((a) => String(a).split(' (')[0].trim().toLowerCase()).filter((x) => x && x !== 'none'));

async function liveFeed() {
  const sibling = new URL('../../../conc-recipe-hub/DOOR_RECIPE_DATA.json', import.meta.url);
  try {
    const res = await fetch('https://kennedyjasondavid-eng.github.io/conc-recipe-hub/DOOR_RECIPE_DATA.json?t=' + Date.now(), { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (res.ok) return { from: 'CODEX Pages', feed: await res.json() };
  } catch {}
  if (fs.existsSync(sibling)) return { from: 'the CODEX copy beside DOOR', feed: JSON.parse(fs.readFileSync(sibling, 'utf8')) };
  return null;
}

test('advisory: DOOR\'s offline recipe list matches CODEX\'s live allergens', async (t) => {
  const live = await liveFeed();
  if (!live) { t.skip('CODEX feed not reachable'); return; }
  const byName = new Map(live.feed.map((r) => [r.recipeName, r]));
  const lines = [];
  for (const r of offline) {
    const c = byName.get(r.recipeName);
    if (!c) { lines.push(r.recipeName + ': no longer in CODEX'); continue; }
    const a = fam(r.allergens), b = fam(c.allergens);
    const missing = [...b].filter((x) => !a.has(x)), extra = [...a].filter((x) => !b.has(x));
    if (missing.length || extra.length) lines.push(r.recipeName + (missing.length ? ': offline is missing ' + missing.join(', ') : '') + (extra.length ? (missing.length ? ';' : ':') + ' offline still says ' + extra.join(', ') : ''));
  }
  t.diagnostic(lines.length ? 'Offline list differs from ' + live.from + ' on ' + lines.length + ' recipe(s):\n  ' + lines.join('\n  ') : 'Offline list matches ' + live.from + '.');
});
