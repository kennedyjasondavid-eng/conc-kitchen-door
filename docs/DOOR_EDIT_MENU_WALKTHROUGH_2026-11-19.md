# Edit Menu: UX audit (Kitchen DOOR, `v31-standard.102`)

Audit date: 2026-11-19. No repo file was changed.
Method: real Chromium from `file://` with the network blocked, at 1280×900 (`d_`) and 390×860 (`m_`). The browser was seeded with the published `menu_current.json`, an empty overlay and operator "QA". There is no resident list, so plate counts are empty.
Screenshots and scripts were kept in the walkthrough session (not committed); the before/after page shows the key ones.

**The yardstick (owner).** The page should be clean and unintimidating, and should make clear what will happen. It should meet a supervisor who wants to change their site's menu. It should link to CODEX and the rest of HOUSE quietly and cleanly. It should still show everything needed to get a plate right. The user is a kitchen expert and a software novice. Kitchen words are fine (plate, line, side, allergen, halal, soft). Software words are not (slot, flag, overlay, stream, sync, publish, recipe ID, route, and "CODEX" as a bare system name).

**Offline caveats.** With the network blocked, DOOR uses its built-in recipe list: 144 recipes, against about 240 live.
- Some messages may read differently live: "recipe unavailable" on the plain-plate choices, and "Recipe unavailable — review link" on Vegan Bean Patties.
- The category filter in H1 is in the code (`recipeMatchesSlotDef`, line 22858), so H1 is not an offline effect.
- The "not sent to the kitchen" toast is expected, because there is no connection key.

---

## 1. Map of the current flow

1. **Sidebar → Menu Config** (`showScreen('menu-config')`).
   - Title "Menu Config", with the subtitle "View the 4-week rotation, edit flags, and swap meals…".
   - Seven header buttons of equal weight (line ~2042): Swap Slots · Special Meal · Edit Menu · Test Meal · ↑ Rex's week sheet · Send to kitchen.
   - Up to six banners can stack above the grid (swaps, menu source, overlay diff, label resave, unmapped allergens, specials).
   - Week tabs, then a 7-day × 3-meal grid. Each cell shows the regular text, the vegan text and 4–10 coloured tag pills.
   - Change Log and Undo Last sit below the grid.
2. **Clicking a cell while not in edit mode** opens a different panel below the grid (`mc-edit-panel`) with three tabs:
   - **Routing:** "Section Activation".
   - **Swap Meal:** replacement name boxes, a 25-checkbox "Allergen & Routing Flags" grid, Apply Swap, Revert to Original and **Make Permanent**.
   - **Edit Flags:** the same grid plus a soft-alternative box and Save Flags.
   - Two of these tabs change the rotation for good.
3. **Edit Menu** (`toggleEditMenuMode`, line 21479).
   - The button becomes "✓ Done". A blue banner appears: "Edit Menu Mode — Click any meal cell to edit it directly in the rotation", with **↑ Upload Menu** and **Done Editing**.
   - Cells get dashed outlines.
4. **Clicking a cell in edit mode** runs `openMenuEdit` (line 22389). The Edit Menu panel opens below the grid. The page jumps so the **Main** box is focused, with its text selected and the search list open (line 22490). The meal title is off the top of the screen.
5. **The Edit Menu panel** (HTML line ~2187) has two columns.
   - **Left, top to bottom:**
     - ten dish boxes: Main · Main Alt · (+ Add No Pork Alt) · Vegan Alt · Starch Side · Veg Side · Extras · Vegan line also gets · Halal line also gets · Event Name;
     - each filled box has a link badge, a "Shown on menu as" box when linked, a 21-pill "Allergens — click to set" row, and, on sides, "Vegan line: / Halal line:" dropdowns;
     - **Plain / Soft Alternatives** (a red REQUIRED badge);
     - **Restriction-specific plates** (six rows: Gluten free, Diabetic, No dairy, No egg / mustard, Bland, Anaphylactic; each has a text box, a plate dropdown and 2–4 lines of "Draft routing" text);
     - **Meal Allergens & Flags** (25 checkboxes in five groups);
     - **Save Edit** and, after a change, **Reset to Original**.
   - **Right:** Section Preview, then "Will save as". Neither is sticky.
6. **Save Edit** (`saveMenuEdit`, line 21984) asks up to five questions in a row, then shows the halal dialog. In order:
   1. held typed words;
   2. "More than one dish in a slot?";
   3. "No soft or plain alternative?";
   4. "Keep the meal's warnings?";
   5. Halal Certification Check (`_showHalalCertDialog`, line 22133).

   Then `_finishMenuSave` (line 22197) writes the change, closes the panel, redraws the grid, shows a toast and sends to the kitchen if connected.
7. **Leaving the meal:**
   - **Close** with changes asks "Save menu changes?" (Stay and keep editing / Discard changes / Save changes).
   - **Reset to Original** asks "Reset this meal?" and names the original.
   - **Undo Last** sits under the grid.

---

## 2. Findings

Severity: **High** means it can cause a wrong plate, lost or changed data, or a task that can't be finished. **Medium** means confusing, slow or error-prone. **Low** means polish.

### High

**H1. Search can't find a recipe that exists, then offers "Add manually (no allergen data)".**
- **Where:** the Main box search: `slotSearch` (line 22873), `doorRankedRecipeMatches` (line 22770), `recipeMatchesSlotDef` (line 22858).
- **What the supervisor sees:** typing "Pork Adobo", then "Adobo", in Main gives "No matches — Add 'Adobo' manually (no allergen data)". The adobo recipe is in CODEX ("Adobo Pork/Chicken/Tofu (Adobo Marinade & Sauce)"), and this same meal's Vegan Alt is linked to it.
- **Why:**
  - Each box quietly filters by a hidden recipe category. Main only shows "protein / stew_main / salad"; the adobo is filed as "sauce".
  - The search matches whole strings and word starts in order, so "Pork Adobo" never matches "Adobo Pork…".
  - The supervisor has no way to see why, and the only way forward is a typed dish with no recipe allergens.
- **Evidence:** `d_10_task_type_pork_adobo.png`, `d_11_task_type_adobo.png`, and `m_10`/`m_11`. `d_12_task_main_linked.png` shows that no link happened.
- **Direction:** search every recipe and every word in any order. Put the best matches for the box first, and show the rest under "Other recipes" instead of hiding them. If nothing matches, say what DOOR will do: "Save as a typed dish. You tick its allergens."

**H2. Opening a meal and saving without changing anything rewrites its menu text.**
- **Where:** `parseMealNameIntoSlots` (line 22334), used by `openMenuEdit` when a meal has no saved boxes or its saved boxes are behind the text.
- **What happens:**
  - Wk1 MON breakfast "Pancakes, turkey bacon, fruit & yoghurt" opened and saved with no edits became **"Pancakes & turkey bacon & fruit & yoghurt"**.
  - Wk1 FRI dinner previews as "Pork Adobo & Garlic Green Bean, Rice": the order changed and a side was joined to the main.
  - That text is what EXPO, HUB and the plating sheets read. The supervisor did nothing and the menu changed.
- **Evidence:** `d_06_wk1mon_breakfast_top.png` (its "Will save as" line), `d_20_breakfast_nochange_save_dialog1.png`, `d_20_breakfast_nochange_after_save.png`, and `m_20_*`.
- **Direction:** a save with no changes writes nothing. When DOOR has to guess the dishes from text, keep the original wording and order.

**H3. DOOR builds its own "combined box", then blames the supervisor for it at Save.**
- **Where:** `parseMealNameIntoSlots` (it joins sides it can't classify into Main with " & "), `doorReadInLineVersions` (line 21017), and the run-on question in `saveMenuEdit`.
- **What the supervisor sees:**
  - Wk1 FRI dinner's Main reads "Pork Adobo & Garlic Green Bean".
  - Wk4 SUN lunch's Main reads "Pork Souvlaki & Steamed Carrots & Tzatziki", and Wk4 MON lunch's Main "Chicken Ranch Salad Sandwich & Fruit and Chips".
  - Vegan Alt "Shown on menu as" boxes hold whole lines ("Vegetarian Adobo, Garlic Green Bean"; "Black bean patty, Steamed Carrots, Tzatziki").
  - At Save, "More than one dish in a slot? … EXPO plans one dish per slot, so it may miss one of them." The supervisor didn't type any of these.
  - For Wk1 FRI there is **no** "read from the menu text" notice, even though DOOR ignored the saved boxes (the warning goes to the console only). The notice appears only on meals with no saved boxes at all (breakfast).
- **Evidence:** `d_03_wk1fri_dinner_open_viewport.png`, `d_06_wk4sun_lunch_top.png`, `d_06_wk4mon_lunch_top.png`, `d_18_task_save_dialog1.png`, `d_30_wk4sat_open_blur_save_dialog1.png`, and the `m_` versions.
- **Direction:** on open, split the text at commas into one row per dish ("Pork Adobo", "Rice", "Garlic Green Bean"). Only ask when DOOR truly can't tell, and then show a one-line "DOOR read these dishes from the menu text. Check them."

**H4. Clicking out of the auto-focused Main box silently re-links it and changes its allergens.**
- **Where:** `openMenuEdit` focuses Main (line 22490), and `slotAutoSave` (line 23027) runs when the box loses focus.
- **What happens on Wk4 SAT lunch:**
  - The meal opens with Main as a typed dish carrying Gluten, Dairy, Chicken, Brassicas and Halal-certified on its card.
  - Simply clicking elsewhere links it to the CODEX recipe, and the card's pills drop to Sulphites and Nightshades.
  - At Save the supervisor is asked "Keep the meal's warnings? The main changed from 'Lime-Spiced Chicken Legs' to 'Lime-Spiced Chicken Legs'" (Brassicas, Dairy, Gluten).
  - Then the halal question comes again, though the meal was already halal-certified.
  - The saved meal kept its ticks, because "Keep them" is the default, but only through a confusing question about a change nobody made.
- **Evidence:** `m_07_preview_position_after_save_button.png` (before: "Unlinked (manual)" with Gluten, Dairy and others) against `d_06_wk4sat_lunch_top.png` (after a blur: "Linked to CODEX", two pills). Also `d_30_wk4sat_open_blur_save_dialog2.png` and `…dialog3.png`.
- **Direction:** don't auto-focus or auto-link on blur. Offer "Link to the CODEX recipe?" as a visible choice, and show the allergen difference before it applies.

**H5. "Meal Allergens & Flags" doesn't show the meal's allergens.**
- **Where:** `#mc-edit-flag-grid` (HTML line ~2221), filled in `openMenuEdit`, and read at Save as "additional".
- **What happens:** on Wk4 SAT lunch, whose saved meal carries Gluten, Dairy, Chicken, Brassicas, Sulphites, Nightshades and Halal-certified, the grid shows only Sulphites, Carb-swap and Nightshades ticked.
  - The grid's title says "Meal Allergens & Flags", so a supervisor checking it reads "no gluten, no dairy" on a garlic-bread and chicken meal.
  - The real meal allergens are spread across the dish cards' pills and appear in no single place.
- **Evidence:** the bottom of `d_03b_wk1fri_dinner_panel.png`, `m_17_task_save_button_area.png`, and the console receipt in `s7.mjs`.
- **Direction:** one read-only summary, "This meal contains: …", worked out from the dishes and always visible beside Save. Hand ticks become "Also contains…", clearly labelled as extra.

**H6. On a phone the panel stays two columns, and "Will save as" is squeezed into a 78 px strip.**
- **Where:** `#mc-menu-edit-panel` (inline `grid-template-columns:1fr 1fr`). The phone rule that stacks the other Menu Config grids does not reach it.
- **What happens:** at 390 px the dish column is 258 px and the right column 78 px. "Section Preview" and "Will save as" wrap one word per line ("Lime- / Spiced / Chicken / Legs…"), and the meal title wraps to three lines.
  - The one summary of what Save will write is unreadable on a phone.
- **Evidence:** `m_07_preview_position_after_save_button.png`.
- **Direction:** stack at phone width, and put the summary in a sticky footer with Save.

**H7. Sides typed in plain words get no allergens and no warning about it.**
- **Where:** `renderSlotCard` and `slotAutoSave`.
- **What happens:** "Garlic Green Bean" (no recipe offline) is saved as a typed side with every allergen unticked. The amber "Unlinked (manual)" badge is the only cue, and it also appears on plain Rice, so it reads as noise.
  - If the supervisor doesn't tick pills on each side, the side's allergens are missing from that plate (for example a garlic butter, or the gluten in Wk4 SAT's garlic bread).
- **Evidence:** `d_15_task_vegside_entered.png`.
- **Direction:** for a typed dish, ask once, in place: "No recipe. What does Garlic Green Bean contain?" Offer a short pill row, with "Nothing to declare" as an explicit choice.

### Medium

**M1. Three different doors change a meal for good.**
- Edit Menu (this panel), the cell panel's **Edit Flags → Save Flags**, and **Swap Meal → Make Permanent** (line ~2152).
- A supervisor who clicks a cell without edit mode lands in a "Routing / Section Activation" panel and can change allergens permanently without opening Edit Menu.
- **Evidence:** `d_04a_cellclick_without_editmode_panel_view.png`, `d_04c_cellclick_panel_swap.png`, `d_04d_cellclick_panel_editflags.png`.
- **Direction:** one "Change this meal" path. Clicking a cell opens it, and it asks "Every week, or just on <date>?"

**M2. Edit Menu is a hidden mode with two exits and a risky neighbour.**
- The Edit Menu button turns into "✓ Done", and the banner adds "Done Editing". Both do the same thing.
- **↑ Upload Menu**, which can replace the whole rotation, sits beside Done Editing.
- **Evidence:** `d_02_editmode_on.png`.
- **Direction:** no mode. Every cell has an "Edit" affordance, and Upload moves to a quiet "More" menu.

**M3. The landing page doesn't say how to change a meal.**
- The title is "Menu Config" and the subtitle mentions "edit flags". Seven header buttons have equal weight, and the purple Test Meal stands out more than Edit Menu.
- The grid packs 4–10 coloured pills into every cell, about 150 on screen, before the user has asked anything.
- **Evidence:** `d_01_menuconfig_landing.png`, `m_01_menuconfig_landing.png`.
- **Direction:** title it "Menu". Make each cell a tappable card that shows the dishes, with allergens collapsed to a count or a single line, and keep one primary action.

**M4. Opening a meal throws the user into the middle of the form.**
- The page scrolls so the Main box sits at the top, and the meal name ("WEEK 1 — FRIDAY DINNER") is hidden under the sticky header.
- The Main text is pre-selected and the search list is already open, showing "No matches…". The first key pressed wipes the dish name.
- **Evidence:** `d_05_editmode_cellclick_immediate.png`, `m_05_editmode_cellclick_immediate.png`.
- **Direction:** open at the meal title, with no focus, and show the dishes as read-only rows, each with its own "Change" button.

**M5. The panel is 3,200 px tall (3,700 px on a phone), with Save only at the very bottom.**
- Measured: Save Edit is 3,203 px below the panel top on desktop and 3,693 px on the phone. Nothing is sticky.
- About 100 allergen pills, 10 dish boxes, 6 restriction rows and 25 checkboxes are on the page at once.
- **Evidence:** `d_03b_wk1fri_dinner_panel.png`, `m_06_wk4sun_lunch_panel.png`, `d_17_task_save_button_area.png`.
- **Direction:** keep a sticky footer with the "This meal contains" summary, Save and Cancel. Show empty boxes and advanced sections only on demand.

**M6. Every dish box always shows a 21-pill allergen row.**
- The heading is "ALLERGENS — CLICK TO SET". Each pill is about 17 px tall on a phone (below the 44 px touch size).
- Ticked and unticked pills differ only by colour fill.
- **Evidence:** `d_03_*`, `m_06_*`.
- **Direction:** show the ticked allergens as a short line ("Soy · Tree nuts · Coconut") with an "Edit allergens" button. Keep the full row for typed dishes.

**M7. Link badges use system wording and warning colours for normal states.**
- The badges are "⚠ UNLINKED (MANUAL)" (amber, even on Rice), "✓ LINKED TO CODEX", "Linked by name — confirm recipe", "Recipe unavailable — review link", "Ambiguous recipe — review link" and "Conflicting recipe — review link".
- "CODEX lists X, not ticked here" with **Add them**, and "label not checked", were seen in the code only, not in these meals.
- **Evidence:** `d_06_wk4sat_lunch_top.png`, `m_06_wk4sun_lunch_panel.png`.
- **Direction:** two quiet states: "From the recipe book ✓" and "Typed (you set the allergens)". Use amber only when something needs the supervisor, such as a recipe missing or the recipe's allergens changing.

**M8. The "Shown on menu as" label is jargon.**
- It reads "(SAVED RECIPE: '…'; CAPTURED INGREDIENT FLAGS ARE KEPT)", in 10 px capitals.
- **Evidence:** `d_03_wk1fri_dinner_open_viewport.png`.
- **Direction:** "Name on the menu: [Vegetarian Adobo]", with "Recipe: Adobo Marinade & Sauce" as small grey text.

**M9. A routing warning is written in system terms.**
- It reads "'pork', 'chicken', 'tofu', 'marinade', 'sauce' aren't in the shown name — EXPO routes on the dish name, so this may not route. Allergens stay linked, so they're safe."
- It shows on the vegan line of Wk1 FRI, which is linked to a pork-named marinade recipe. That link is itself worth a supervisor's attention, and the current words hide it.
- **Evidence:** `d_03_*`.
- **Direction:** "The vegan plate is linked to the recipe 'Adobo Pork/Chicken/Tofu'. Is that the right recipe?" Leave EXPO out of the sentence.

**M10. The dish boxes are named after the system's internals.**
- The ten boxes are all marked "optional". The halal line is "Main Alt" ("Halal or alternate main…"), and No Pork Alt is hidden behind a button.
- "Vegan line also gets" and "Halal line also gets" sit as separate boxes far from the line they belong to.
- Breakfasts get the same lunch and dinner boxes (Main Alt, Starch Side…).
- **Evidence:** `d_06_wk1mon_breakfast_top.png`.
- **Direction:** group by plate. "Regular plate: main + sides", "Vegan plate: main + what's different", "Halal plate: main + what's different". Use plain plate names, and show an empty plate only when someone adds it.

**M11. Every side shows "Vegan line / Halal line" dropdowns.**
- Each side has two full-width selects ("gets this / gets instead… / doesn't get it"), shown even when nothing differs.
- The idea is good: kitchen words, and it matches how lines work.
- **Evidence:** `d_15_task_vegside_entered.png`.
- **Direction:** collapse to "Same on all plates · change", and open the choice only when it is used.

**M12. "Plain / Soft Alternatives — REQUIRED" is shouted on open, and asked again at every Save.**
- A red REQUIRED badge shows before the user has done anything.
- At Save: "Confirm that no resident requires a soft or plain alternative for this meal — the standard meal already covers every dietary need." This asks a supervisor to certify a clinical fact just to save a side-dish edit.
- **Evidence:** `d_03b_*`, `d_18_task_save_dialog2.png`, `m_18_task_save_dialog2.png`.
- **Direction:** ask only when the change affects what soft or plain residents eat. Say "No soft plate for this meal" as a calm choice, set once, and remember it.

**M13. "Restriction-specific plates" is dense and full of jargon.**
- The help text: "Assign a complete plate to an existing requirement group. Type your own plate or choose a CODEX option. Draft feedback shows recipients and checks; nothing applies until Save Edit. Leaving a box empty keeps the existing fallback."
- Six rows each repeat "Draft routing: 0 residents. Other requirements can place a resident in another section. No replacement entered; existing fallback behavior applies."
- Each row's dropdown offers nine combinations, all "— recipe unavailable" offline.
- The same block is called "Alternatives the kitchen makes" at breakfast (`doorFillKitchenAltInputs`, line 14966).
- **Evidence:** `d_03b_*`, `m_06_wk4sun_lunch_panel.png`.
- **Direction:** title it "Other plates the kitchen makes", with one line per plate that exists ("Gluten free: [dish] · 4 residents"). Add a plate with "+ Add a plate for…", and say once, in plain words, what happens to residents when a plate isn't made.

**M14. The preview shows little when it is needed most.**
- Without a resident list it shows "Regular —" and "counts are unavailable". With a list it shows sections, but which residents' plates change because of this edit is not called out.
- It sits at the top of the right column and scrolls away.
- **Evidence:** `d_03_*`, `d_16_task_preview.png`.
- **Direction:** a sticky "What changes" box: plates opened or closed, residents moved, new allergens on each plate.

**M15. "Will save as" leaves out most of what the save changes.**
- It shows the regular and vegan text only. It doesn't show the halal line, the allergens, the alternatives, or that this applies **every cycle**.
- **Evidence:** `d_16_task_preview.png`.
- **Direction:** show the full before → after for each plate, with "Every week 1 Friday dinner" stated.

**M16. Save is a chain of up to five modal questions in system words.**
- "slot", "EXPO plans one dish per slot", "Starch Side, Veg Side, Extras", "Main Alt (Halal)", "Halal section activates with an alternative".
- One question named the same dish twice ("changed from 'Lime-Spiced Chicken Legs' to 'Lime-Spiced Chicken Legs'").
- **Evidence:** `d_18_task_save_dialog1.png`, `d_30_wk4sat_open_blur_save_dialog1-3.png`, `d_20_breakfast_nochange_save_dialog1-2.png`.
- **Direction:** fold the checks into the "What changes" box before Save, inline and in kitchen words. Keep at most one confirmation, and only for a food-safety decision.

**M17. The halal question asks about a fact the meal already records.**
- After the silent re-link in H4, the meal already said halal-certified, and the question came anyway.
- The "No" answer is a large red button labelled "Halal section activates with an alternative".
- **Evidence:** `d_30_wk4sat_open_blur_save_dialog3.png`.
- **Direction:** ask only when the meat changed. Use "Is the chicken halal-certified? Yes, halal residents eat this plate / No, they need a halal plate", with neutral colours.

**M18. After Save the result is easy to miss.**
- The panel closes, the grid jumps back, and nothing marks the changed cell.
- The key message ("Saved on this computer — not sent to the kitchen…") is a toast that disappears.
- The header's separate **Send to kitchen** button leaves it unclear whether Save already sent.
- **Evidence:** `d_19_task_after_save.png`, `m_19_task_after_save.png`.
- **Direction:** keep the user on the meal and show "Saved. Sending to the kitchen… Sent ✓ (EXPO and HUB will show it)", or a steady "Saved on this computer only. Not sent: <reason>", until it is resolved. Highlight the cell.

**M19. A word typed over a dish is saved silently when the box loses focus.**
- Typing "Adobo" over "Pork Adobo & Garlic Green Bean" saved the main as "Adobo". The menu text lost "Pork", with no question asked, because "Adobo" isn't the start of any recipe the list offered.
- The Pork tick survived only because it was already on the dish.
- **Evidence:** `d_16_task_preview.png` ("Will save as: Adobo, Rice, Garlic Green Bean") and `d_23_reset_to_original_dialog.png`.
- **Direction:** keep edits as a draft that shows before → after on the row, so nothing commits on blur.

**M20. The Meal Allergens grid mixes allergens with kitchen-system terms.**
- Its groups are "Routing: Spicy · Carb-swap · Halal-certified meat · Processed meat" and "Proteins: Pork / Beef…", in capitals with an info icon on each.
- **Evidence:** `m_17_task_save_button_area.png`.
- **Direction:** separate "Contains" (allergens) from "About this meal" (spicy, halal-certified, processed meat, a starch to swap).

**M21. The phone header takes three rows and covers content.**
- The seven buttons wrap to about 200 px. The fixed ☰ button floats over the top-left of the content while scrolling, covering text and pills.
- **Evidence:** `m_02_editmode_on.png`, `m_05_editmode_cellclick_immediate.png`, `m_18_task_save_dialog2.png`.
- **Direction:** one primary action, with the rest under "More". Give the ☰ button its own header bar.

**M22. The phone grid scrolls sideways inside the table.**
- Only Sun, Mon and part of Tue are visible. Reaching Friday dinner means scrolling sideways within the table, then down.
- **Evidence:** `m_02b_editmode_on_full.png`.
- **Direction:** on a phone, a day-by-day list (day picker, then three meal cards).

**M23. The Vegan Alt "Shown on menu as" box holds the whole vegan line.**
- Wk4 SUN reads "Black bean patty, Steamed Carrots, Tzatziki". The supervisor can't tell which words are the dish and which are sides, and editing the box changes the line.
- **Evidence:** `m_06_wk4sun_lunch_panel.png`.
- **Direction:** same as H3. One row per dish.

**M24. Breakfast uses the lunch and dinner editor.**
- Breakfast shows Main Alt, No Pork Alt, Starch and Veg quick-picks (Rice, Naan, Coleslaw…), and every breakfast item goes into Main joined with "&".
- **Evidence:** `d_06_wk1mon_breakfast_top.png`.
- **Direction:** breakfast items as a simple list of dishes, each with its allergens.

**M25. Reset to Original only appears after a change and is far from the top.**
- It sits next to Save Edit at the bottom of a 3,000 px page. Its question is clear and good ("goes back to 'Pork Adobo, Rice, Garlic Green Bean', as it was before it was changed on Nov 19 by QA").
- **Evidence:** `d_23_reset_to_original_dialog.png`.
- **Direction:** put "Changed Nov 19 by QA · Put back the original" near the meal title.

### Low

- **L1.** "optional" in italics on every box is noise when everything is optional (`renderSlotCard`).
- **L2.** Labels are 10–11 px uppercase with letter-spacing throughout, which is hard to read on a tablet.
- **L3.** The Veg Side quick-pick "Seasonal Veg" goes against the house rule to name the vegetable (the Oct 4 sweep).
- **L4.** The Event Name placeholder is truncated ("Named events only — e.g. Jerk Night, Thanksgiving D…").
- **L5.** Three names for the same button: "Save Edit", "Save changes" and "Save Flags".
- **L6.** The editor context "WEEK 1 — FRIDAY DINNER" shows no date. The grid shows dates, the editor doesn't.
- **L7.** The clear button (×) on each box is about 14 px, with only a tooltip.
- **L8.** The Test Meal panel uses "Sandbox", "Flag Toggle Playground" and "Section Activation".
- **L9.** The title gains "(edited)" from a legacy store that no longer exists, a stray state word.
- **L10.** "Section Preview" shows "Regular —" with a dash and no meaning when there is no resident list.

**Noticed in the data, not UX (for Jason):**
- Wk4 SUN lunch's vegan line includes **Tzatziki**, which is usually dairy.
- Wk1 FRI's vegan plate is linked to a pork-named marinade recipe.

Neither was changed. The current UI does not make either easy to spot.

**What already works and should be kept:**
- The close-with-changes question ("Stay and keep editing / Discard changes / Save changes").
- Reset naming the original, with date and person.
- The plain "Saved on this computer only… Not sent: <reason>" wording.
- "Vegan line: gets this / gets instead / doesn't get it": kitchen-shaped thinking.
- The "Link to 'Garlic Bread'? Its allergens come with it" suggestion (seen on Wk4 SAT).
- "Will save as" as a concept.

---

## 3. Each step against the brief

| Step | How intimidating | Meets the user's intent? | CODEX / EXPO / HUB touchpoints |
|---|---|---|---|
| Landing (`d_01`, `m_01`) | High: 7 buttons, about 150 pills, up to 6 banners | Partly. The user must know Edit Menu is a mode | "Send to kitchen" (EXPO/HUB) is separate from Save, so it's unclear whether Save sends; "CODEX Offline" badge in the sidebar |
| Edit mode on (`d_02`) | Medium | No. A mode, plus a second banner, plus Upload | none |
| Open a meal (`d_03`, `d_05`) | Very high: 3,200 px, about 100 pills, focus jumps | No. The user thinks "change Friday's main" and gets 10 boxes named after internals | Link badges on every box (noisy); a routing warning that names EXPO |
| Search a recipe (`d_10`, `d_11`) | Low on screen, high in effect | No. The recipe isn't found | CODEX search hides recipes by category; "no allergen data" fallback |
| Sides / lines (`d_15`) | High | Partly. The line choices are good; always-on dropdowns are not | none |
| Alternatives (`d_03b`) | Very high: red REQUIRED, six rows of draft-routing text | Rarely what the user came for | "CODEX option" plate pickers |
| Meal allergens (`d_03b` bottom) | High | Misleading (H5) | none |
| Save (`d_18`, `d_30`) | High: up to 5 modals | Questions are about DOOR's model, not the change | "EXPO plans one dish per slot"; the send to EXPO/HUB is only a toast |

**Information that must stay visible (don't hide it in a cleanup):**
1. The allergens each plate will carry (regular, vegan, halal, and any other plate the kitchen makes), worked out from the dishes, with hand-added ones marked.
2. Which residents' plates change: plates opened or closed, residents moved, and new conflicts, above all anaphylactic ones.
3. Whether the change is every cycle or one date, and which week, day and date.
4. Whether each dish comes from the recipe book or is typed, so its allergens rest on the supervisor's ticks.
5. A halal-certification decision whenever the meat changes.
6. Whether the change reached the kitchen (EXPO and HUB), and if not, why.
7. A label-not-checked marker on a bought item. Today it shows as a tag on the box; it must survive any cleanup.

**What can be quieter:**
- The full 21-pill rows (show only the ticked ones).
- Empty dish boxes.
- The "same on all lines" choices.
- Restriction plates that aren't made.
- Recipe IDs and "Shown on menu as" mechanics.
- EXPO routing warnings (turn them into a single "check this link" note).
- The REQUIRED badge before any change.
- Section-activation detail.

**Where a cleanup could hide something needed:**
- Collapsing the per-dish allergen pills **without** adding the H5 "This meal contains" summary would remove the only accurate allergen view.
- Dropping the soft-plate question entirely would lose a real decision. Move it, don't delete it.
- Hiding badges must keep the amber case for "recipe missing", "recipe's allergens changed (Add them)" and "label not checked".

---

## 4. Jargon list (on-screen words, with plain alternatives)

| On screen | Plain alternative |
|---|---|
| Menu Config | Menu |
| edit flags / Allergen & Routing Flags / Meal Allergens & Flags | allergens / what this meal contains |
| Edit Menu Mode / Done Editing | (no mode) / Done |
| slot (in questions) | dish / box |
| Main Alt | Halal plate main (or "Other main") |
| No Pork Alt | No-pork plate |
| Vegan Alt | Vegan plate main |
| Starch Side / Extras / Event Name | Starch / Extra / Name for the night (e.g. Jerk Night) |
| Vegan line also gets / Halal line also gets | Vegan plate also has / Halal plate also has |
| UNLINKED (MANUAL) | Typed (you set the allergens) |
| LINKED TO CODEX | From the recipe book ✓ |
| Linked by name — confirm recipe / Ambiguous / Conflicting / Recipe unavailable — review link | Check which recipe this is / Recipe not found |
| SHOWN ON MENU AS (SAVED RECIPE…; CAPTURED INGREDIENT FLAGS ARE KEPT) | Name on the menu |
| EXPO routes on the dish name, so this may not route | The kitchen schedule may not recognise this name |
| ALLERGENS — CLICK TO SET | Allergens (tap to change) |
| CODEX option / CODEX plates | recipe-book plate |
| Restriction-specific plates / requirement group | Other plates the kitchen makes |
| Draft routing: 0 residents / Draft feedback shows recipients and checks | Who gets this plate: 0 residents |
| existing fallback behavior applies | If you leave it empty, these residents get <plate> |
| Section Preview / Section Activation / Inactive | Plates for this meal / not made |
| Carb-swap | Has a starch that can be swapped |
| Halal section activates with an alternative | Halal residents need a halal plate |
| Recipe facts need review | Check this recipe's allergens |
| Save Edit / Save Flags | Save |
| Swap Slots | Swap two meals |
| Make Permanent | Every week from now |
| (edited) | Changed on <date> by <name> |
| EXPO plans one dish per slot | The kitchen schedule needs one dish per line |
| Upload Menu | Replace the whole 4-week menu from a file |
| Sandbox / Flag Toggle Playground | Try a meal (nothing is saved) |

---

## 5. Phone-width problems (390×860)

1. The editor stays two columns, so the preview and "Will save as" are 78 px wide and unreadable (H6, `m_07`).
2. The header's seven buttons wrap to three rows, about 200 px (`m_02`).
3. The fixed ☰ button overlaps content and dialogs while scrolling (`m_05`, `m_18`).
4. The week grid scrolls sideways inside the table: about 2.5 days visible, Saturday hidden (`m_02b`).
5. The editor is 3,700 px tall, with Save at the bottom and nothing sticky (`m_17`).
6. Allergen pills are about 17 px tall, far below a usable touch size. The "+ Add No Pork Alt" and × buttons are small.
7. The meal title wraps to three lines next to Close. After auto-focus it is off-screen.
8. The restriction-plate rows: the label column ("NO EGG / MUSTARD") wraps, and the dropdown's options are long.
9. Dialogs fit and the buttons wrap well. This works.

---

## 6. End-to-end task: split "Pork Adobo & Garlic Green Bean"

**Goal:** Main = Pork Adobo, linked to its CODEX recipe; Veg side = Garlic Green Bean; then Save.

| # | Action | Result |
|---|---|---|
| 1 | Sidebar → Menu Config | Week 4 shown |
| 2 | Week 1 tab | |
| 3 | Edit Menu | Mode on |
| 4 | Click the Fri dinner cell | Panel opens below; the page jumps to Main; "No matches" list already open |
| 5 | Clear Main, type "Pork Adobo" | "No matches — Add manually (no allergen data)" |
| 6 | Try "Adobo" | Still no matches. **Stuck: the CODEX recipe is filed as "sauce" and Main hides it.** |
| 7 | (Gave up on linking; "Adobo" left typed) | |
| 8 | Scroll to Veg Side, type "Garlic Green Bean" | No recipe; saved as a typed side with every allergen off |
| 9 | Enter | Card shows "Unlinked (manual)" and 21 empty pills |
| 10 | Scroll about 3,200 px to Save Edit, click | |
| 11 | Dialog: "More than one dish in a slot?" about Vegan Alt "Vegetarian Adobo, Garlic Green Bean" (DOOR's own text) → Save as it is | |
| 12 | Dialog: "No soft or plain alternative?" → Save with "none required" | Saves "none required" on a meal the supervisor didn't mean to certify |
| 13 | Toast: "Saved on this computer — not sent to the kitchen…" | Panel closes, grid redraws, changed cell not marked |

**Result:** 13 steps (11 actions and 2 dialogs). The main could not be linked to its recipe, the main's menu name became "Adobo" (the word "Pork" was lost), and the side has no allergens. A supervisor would not know any of this went wrong. Reset to Original put it back correctly (`d_23`).

The ideal flow is 5 steps: click the meal → "Change" on the main row → pick "Adobo (pork)" from a search that finds it → "+ Add a side: Garlic Green Bean" (asks what it contains) → Save, with the summary visible.

---

## 7. Top 5 themes for a redesign, each with its ideal screen

### T1. Show the meal as plates of dishes, in kitchen words, not as ten system boxes
**Ideal screen.** Opening a meal shows its title and date at the top ("Week 1 · Friday dinner · next on Nov 27"), then three short plate cards.
- **Regular plate:** "Pork Adobo · Rice · Garlic Green Bean", one row per dish.
- **Vegan plate:** "Vegetarian Adobo, the rest the same".
- **Halal plate:** "Not needed: the main is pork, so halal residents get the Halal Chicken Adobo plate", or "+ Add halal main".
- Each dish row has its name, a small "recipe book ✓" or "typed" marker, its allergens as a short grey line, and a "Change" link.
- Empty boxes, "optional" tags and line dropdowns don't appear until "+ Add a dish" or "Different on the vegan plate" is tapped.
- Breakfast is a plain list of items.
- Nothing is focused on open, and nothing changes until the supervisor acts.

### T2. One always-true allergen summary, beside Save
**Ideal screen.** A sticky footer (on a phone, a bottom sheet handle) reads:
- "Regular plate contains: Soy · Tree nuts · Coconut · Sulphites · Pork · Corn"
- "Vegan plate: Soy · Tree nuts · Coconut · Sulphites"
- "Halal plate: …"

It is worked out live from the dishes. Hand-added allergens are marked "(added by you)", and a label-not-checked item shows "⚠ Silk yogurt: label not checked". The 25-checkbox grid goes, replaced by "Also contains…" on each dish. Removing an allergen shows inline: "Taking Gluten off the regular plate. Residents with No Gluten will get the regular plate."

### T3. CODEX linking that just works, and is quiet
**Ideal screen.** "Change" on a dish opens one search box: "Search the recipe book or type a dish".
- Results match any words in any order ("pork adobo" finds "Adobo Pork/Chicken/Tofu (Adobo Marinade & Sauce)"), best fits first, with each result's allergens shown under it.
- Recipes from other categories appear under "Other recipes", never hidden.
- Picking one shows "Name on the menu: Pork Adobo" (editable) and the recipe's allergens. No IDs, and no "captured ingredient flags".
- Typing a name with no match offers "Use 'Garlic Green Bean' as a typed dish", then asks "What does it contain?" with an explicit "Nothing to declare".
- Amber appears only when the recipe is missing, its allergens changed ("The recipe now lists Sesame. Add it?") or a label isn't checked.
- Nothing links or unlinks on blur.

### T4. Show what changes before Save, and ask at most one question
**Ideal screen.** As soon as anything differs, the footer gains a "What changes" panel:
- "Every Week 1 Friday dinner, from Nov 27: Main Pork Adobo → Adobo (pork); + Garlic Green Bean."
- "Plates: no change. Residents affected: none." Or: "No Dairy plate opens, 3 residents move to it."
- "Kitchen schedule (EXPO) and staff board (HUB) update when you save."

Questions DOOR needs answered sit inline in that panel in kitchen words ("Is the pork adobo's chicken version halal-certified?"), not as modal chains. Save shows "Saving… Sent to the kitchen ✓". If this computer can't send, a steady line says why. The editor stays open on the meal, and the grid cell gets a "Changed today" marker. An unchanged meal writes nothing.

### T5. One way in, one page, for every screen size
**Ideal screen.** The Menu page has a week picker and the grid. On a phone, a day picker, then three meal cards.
- Each cell is a card with its dishes and an allergen count. Tapping it opens the plate view from T1 (a side panel on desktop, full screen on a phone), with "Every week" or "Just on <date>" as the first choice. That choice replaces Edit Menu mode, Swap Meal, Edit Flags and Make Permanent.
- The header keeps one primary action (Send to kitchen, shown only when something is waiting). Swap two meals, Special meal, Rex's week sheet, Upload and Try a meal go under "More".
- The "Other plates the kitchen makes" section lists only the plates that exist, with resident counts, and adds others with "+ Add a plate for…".
- "No soft plate needed" is a calm saved choice, not a red REQUIRED badge.

---

## 8. Counts
**High 7 · Medium 25 · Low 10** (42 findings), plus 2 data notes for Jason.
