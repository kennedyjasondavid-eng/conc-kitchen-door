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
  // Rex's week sheet names Wk2 SUN's vegan lunch "Portobello Cheese Melt" (Jason, 2026-10-30: vegan cheese); the recipe
  // link stays, so only its words and the meal's kept original are put back.
  const sun = out['2'] && out['2'].SUNDAY;
  if (sun) {
    if (which === 'menu') sun.lunch_veg = 'Vegan Mushroom Sandwich, Chips,  Fruit';
    else { delete sun.lunch_veg; delete sun.lunch_original; }
    const va = sun.lunch_slots && sun.lunch_slots.veganalt;
    if (va && va.displayText === 'Portobello Cheese Melt (vegan cheese)') delete va.displayText;
  }
  // Rex's week sheet adds Seasonal Soup to Wk2 TUE lunch (Jason, 2026-10-30: "Add the seasonal soup too").
  const tue = out['2'] && out['2'].TUESDAY;
  if (tue && /Seasonal Soup/.test(String(tue.lunch || ''))) {
    tue.lunch = 'Tuna Salad Sandwich Mix, Chips, Fruit Cup';
    tue.lunch_veg = 'Falafel Sandwich, Chips, Fruit Cup';
    if (which === 'menu') tue.lunch_sides = 'Chips, Fruit Cup';
    else { delete tue.lunch_sides; delete tue.lunch_original; }
    if (tue.lunch_slots) delete tue.lunch_slots.vegside;
  }
  return out;
}
// Retired 2026-11-04: rexMealDay read Wk2 THU and FRI dinners at a fixed traded day (Rex's sheet, Oct 30), so Jason's
// Nov 4 swap back put every gate using it red. Gates find a meal where it is now: tests/helpers/meal_where.mjs.
