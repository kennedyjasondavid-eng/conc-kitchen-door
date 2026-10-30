// Mat's Rexdale menu changes (2026-10-30): Wk2 THU dinner, Wk2 FRI lunch, Wk2 SAT lunch and dinner, Wk3 SUN dinner, and
// Wk3 MON dinner's Moroccan-legs link. A gate pinned to the menu before them puts the five days back first.
import fs from 'node:fs';
const F = JSON.parse(fs.readFileSync(new URL('../fixtures/rex_menu_changes_2026-10-30.json', import.meta.url), 'utf8'));
export function putBackRexMenuChanges(weeks, which) {
  const out = JSON.parse(JSON.stringify(weeks));
  for (const k of F.days) {
    const [wk, day] = k.split('|'), before = F[which][k];
    if (!out[wk]) continue;
    if (before === undefined || before === null) delete out[wk][day];
    else out[wk][day] = JSON.parse(JSON.stringify(before));
  }
  return out;
}
// Rex's week sheet is canon for meal placement (Jason, 2026-10-30): Wk2 THU and FRI dinners traded days (Arroz con Pollo
// on Thursday, the sausages on Friday). A gate that names a meal by its old day reads it where it is now.
const REX_MOVED = { '2|THURSDAY|dinner': 'FRIDAY', '2|FRIDAY|dinner': 'THURSDAY' };
export function rexMealDay(wk, day, period) { return REX_MOVED[wk + '|' + day + '|' + period] || day; }
