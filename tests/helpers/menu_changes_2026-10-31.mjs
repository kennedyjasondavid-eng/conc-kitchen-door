// DOOR's menu publish of 2026-10-31 18:37Z (main 4d9f800/50bf716): Jason's permanent edit of Wk1 THU dinner, the main
// "Roast Chicken" -> "Spiced Roast Chicken Legs". A gate pinned to the menu before it puts the edit back first.
// The fixture lists every content field the publish changed (git f54fff9 -> 50bf716, _meta left out). The edit is put
// back only while every one of those fields still holds what the publish wrote; if a later edit changed or dropped any
// of them (the meal's kept original included), nothing is put back and the gate's digest catches it.
import fs from 'node:fs';
const F = JSON.parse(fs.readFileSync(new URL('../fixtures/menu_changes_2026-10-31.json', import.meta.url), 'utf8'));
const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']'
  : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'
  : JSON.stringify(v);
const at = (root, path) => {
  const parent = path.slice(0, -1).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), root);
  return parent && typeof parent === 'object' ? { parent, k: path[path.length - 1] } : null;
};
export function putBackMenuChanges20261031(weeks, which) {
  const out = JSON.parse(JSON.stringify(weeks));
  const spots = F[which].map(c => ({ c, s: at(out, c.path) }));
  const holds = ({ c, s }) => s && ('after' in c
    ? Object.prototype.hasOwnProperty.call(s.parent, s.k) && canon(s.parent[s.k]) === canon(c.after)
    : !Object.prototype.hasOwnProperty.call(s.parent, s.k));
  if (!spots.every(holds)) return out;
  for (const { c, s } of spots) {
    if ('before' in c) s.parent[s.k] = JSON.parse(JSON.stringify(c.before)); else delete s.parent[s.k];
  }
  return out;
}
