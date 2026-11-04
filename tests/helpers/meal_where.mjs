// tests/helpers/meal_where.mjs — a gate checks a meal, not the day it sits on (2026-11-04, Jason: "the swap should
// change the rule"). Jason moves whole meals between days (Menu Config's Swap Slots, Rex's week sheet). Gates that named
// a meal by its day went red on every move: six on the Nov 4 Wk2 THU <-> FRI dinner swap, after the Oct 30 trade of the
// same two dinners had them re-pinned by hand. A gate now finds the meal by what makes it that meal (its name, its linked
// recipe), within its week and period, and checks the meal in full wherever DOOR put it: a meal that arrives without
// its halal line, plates or links still fails.
//
// mealDay(menu, wk, day, period, isMeal): the day the meal is on. The day it was pinned on wins while the meal is still
// there; otherwise the one other day of that week whose meal it is. None, or more than one, is an error naming them.
export function mealDay(menu, wk, day, period, isMeal) {
  const week = menu[wk] || {};
  if (week[day] && isMeal(week[day])) return day;
  const days = Object.keys(week).filter((d) => week[d] && isMeal(week[d]));
  if (days.length !== 1) {
    throw new Error(`Wk${wk} ${period}: the meal pinned on ${day} is on ${days.length ? days.join(' and ') : 'no day'} of the week`);
  }
  return days[0];
}
// The meal whose regular or vegan line names the dish.
export const namesDish = (period, dish) => (d) =>
  !dish || (String(d[period] || '') + ' ' + String(d[period + '_veg'] || '')).toLowerCase().includes(String(dish).toLowerCase());
// The meal whose vegan dish links the recipe.
export const linksVegan = (period, recipe) => (d) => ((((d[period + '_slots'] || {}).veganalt) || {}).recipeName) === recipe;
