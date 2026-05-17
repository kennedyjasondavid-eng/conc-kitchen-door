# DOOR Menu Config Typo List — 2026-05-15

These were found by scanning `menu_current.json` for typos, double-spaces, trailing punctuation, casing drift, duplicated components, and non-ASCII junk. They need to be fixed in **DOOR's Menu Config UI** (writing localStorage → re-exporting `menu_current.json`). Fixing the JSON file directly gets overwritten on the next DOOR export.

Counts: **53 fields flagged**, **11 substantive content typos**, the rest are whitespace/casing/punctuation cleanups.

---

## A. Substantive typos (real spelling errors)

| Week / Day / Field | Current | Should be |
|---|---|---|
| W4 FRIDAY `dinner` | `Tandoori Pork, Vegetable Briyani` | `Tandoori Pork, Vegetable Biryani` |
| W4 FRIDAY `dinner_veg` | `Tandoori Tofu, Vegetable Briyani, Vegetable Briyani` | `Tandoori Tofu, Vegetable Biryani` (also dedupe) |
| W4 FRIDAY `dinner_sides` | `Vegetable Briyani` | `Vegetable Biryani` |
| W1 SATURDAY `dinner_veg` | `Vegetarin Collard Stew, Carrot Cabbage Fry, Rice` | `Vegetarian Collard Stew, Carrot Cabbage Fry, Rice` |
| W2 FRIDAY `lunch_veg` | `ّّFalafel Sandwich & Seasonal Soup` | `Falafel Sandwich & Seasonal Soup` (has two Arabic shaddah ّّ chars at the start — likely a paste accident) |

## B. Duplicate components in a single field

| Week / Day / Field | Current | Should be |
|---|---|---|
| W1 THURSDAY `lunch_veg` | `Crispy Quinoa Cake, Home Fries, Home Fries` | `Crispy Quinoa Cake, Home Fries` |
| W4 FRIDAY `dinner_veg` | `Tandoori Tofu, Vegetable Briyani, Vegetable Briyani` | `Tandoori Tofu, Vegetable Biryani` |

## C. Trailing periods (12 fields)

Every Saturday breakfast has `Bagel, Cream cheese and Granola.` (trailing period). Same on `breakfast_veg` and `breakfast_sides`. 12 fields across W1–W4 Saturday.

Just strip the period — keep the text identical otherwise.

## D. Trailing commas (7 fields, all allergen lines)

| Week / Day / Field | Current |
|---|---|
| W1 WEDNESDAY `allergens_dinner` | `Gluten,` |
| W2 SUNDAY `allergens_breakfast` | `gluten, egg, dairy,` |
| W2 MONDAY `allergens_breakfast` | `gluten, dairy, egg,` |
| W3 SUNDAY `allergens_breakfast` | `gluten, egg, dairy,` |
| W3 MONDAY `allergens_breakfast` | `gluten, dairy, egg,` |
| W4 SUNDAY `allergens_breakfast` | `gluten, egg, dairy,` |
| W4 MONDAY `allergens_breakfast` | `gluten, dairy, egg,` |

## E. Double spaces (8 fields)

| Week / Day / Field | Current |
|---|---|
| W2 SUNDAY `lunch` | `Philly Cheese Melt, Chips,  Fruit` |
| W2 SUNDAY `lunch_veg` | `Vegan Mushroom Sandwich, Chips,  Fruit` |
| W2 SUNDAY `lunch_sides` | `Chips,  Fruit` |
| W2 MONDAY `lunch` | `Vegan Chilli ,  garlic bread` |
| W2 MONDAY `lunch_veg` | `Vegan Chilli ,  garlic bread` |
| W2 THURSDAY `lunch` | `CONC Salad - Beef, lettuce,  beans, red cabbage, carrots, cheese, pickled onion,  naan` |
| W2 FRIDAY `lunch` | `Tuna Salad Sandwich & Seasonal  Soup` |
| W3 THURSDAY `allergens_lunch` | `gluten,  dairy` |

## F. Space before comma (7 fields)

| Week / Day / Field | Current |
|---|---|
| W1 FRIDAY `allergens_breakfast` | `turkey, gluten, dairy ,egg` |
| W2 MONDAY `lunch` | `Vegan Chilli ,  garlic bread` |
| W2 MONDAY `lunch_veg` | `Vegan Chilli ,  garlic bread` |
| W2 FRIDAY `allergens_breakfast` | `pork, gluten, dairy ,egg` |
| W2 SATURDAY `lunch_veg` | `Vegan Nuggets, Roasted Yams , Seasonal Veg` |
| W3 FRIDAY `allergens_breakfast` | `pork, gluten, dairy ,egg` |
| W4 FRIDAY `allergens_breakfast` | `pork, gluten, dairy ,egg` |

## G. Allergen casing inconsistency (10 fields)

Most allergen lines are lowercase (`gluten, dairy, egg`). These mix Title-case or ALL-CAPS:

| Week / Day / Field | Current | Suggested |
|---|---|---|
| W1 WEDNESDAY `allergens_dinner` | `Gluten,` | `gluten` |
| W1 THURSDAY `allergens_dinner` | `Halal Chicken` | `halal chicken` (also note: this is a label, not an allergen — confirm whether DOOR uses `halal chicken` as an allergen-routing trigger or whether it should just be `chicken`) |
| W1 FRIDAY `allergens_lunch` | `Halal Chicken, Gluten, Egg` | `halal chicken, gluten, egg` |
| W1 FRIDAY `allergens_dinner` | `Pork` | `pork` |
| W1 SATURDAY `allergens_dinner` | `Beef` | `beef` |
| W2 MONDAY `allergens_dinner` | `PEANUTS` | `peanuts` (currently shouting) |
| W2 WEDNESDAY `allergens_dinner` | `Fish` | `fish` |
| W2 THURSDAY `allergens_lunch` | `Gluten, dairy` | `gluten, dairy` |
| W4 FRIDAY `allergens_dinner` | `Pork` | `pork` |
| W4 THURSDAY `allergens_dinner` | `Egg,soy,gluten,sesame` | `egg, soy, gluten, sesame` (needs spaces after commas too) |

---

## "Chilli" vs "Chili" — not a typo

DOOR uses `Vegan Chilli` and `White Chilli` (UK spelling). EXPO uses `Vegan Chili` (US). EXPO's `NAME_ALIASES` already bridges the two. No action needed unless you want one consistent spelling — just confirm which one is the house standard.

## Cross-week consistency issues to consider (not bugs, just inconsistencies)

- `Chips, Fruit` vs `Fruit and Chips` vs `Fruit, Chips` — three different orderings on the same item across weeks.
- `Cream cheese` vs `Cream Cheese` — case differs.
- `Seasonal Veg` vs `Seasonal Vegetables` vs `Vegetables` — three forms.
- `Halal Beef Burger` (EXPO RENO_MENU stale) vs `CONC Salad - Beef…` (DOOR current) on W2 Thursday lunch — the menu item changed but the old text lingers in EXPO.
- `Pork Adobo with Vegetarian and Pineapple Rice` (W1 Friday `dinner`) — the wording "with Vegetarian and Pineapple Rice" is odd; presumably "Vegetarian" got merged in by mistake. Likely should be `Pork Adobo, Pineapple Rice`.
- `Vegetarian Adobo with Vegetarian and Pineapple Rice` (W1 Friday `dinner_veg`) — same issue.

---

Total UI edits needed: roughly **45 short fixes** in Menu Config across all 4 weeks. Most are 5-second saves (strip trailing period, fix one typo, lowercase an allergen line).
