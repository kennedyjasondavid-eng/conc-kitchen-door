# Receipt: Wk2 FRI lunch's Vegetarian Chili carries Mushroom (publication 60, 2026-11-25)

The vegan dish on Wk2 FRI lunch, **Vegetarian Chili**, is the Beef Chili pot's vegan batch. The base is set aside before
any beef goes in, and 3½ lbs of the house Vegan Meat Replacement go into it. CODEX's Beef Chili record (conc-recipe-hub
#418, edition `2026-11-25-beef-chili`, from Jason's Cook's Card) lists **Mushroom** for that replacement's button
mushrooms. Jason, 2026-11-25: "Add Beans + Mushroom". Every other CODEX dish made with the replacement lists Mushroom
too (Vegan Meatballs, Meatloaf, Stew, Lasagna Sauce, Nacho Mix, Sloppy Joe Mix, Kebabs, Baked Pasta, CONC Salad Mix).

DOOR's vegan box is typed ("Vegetarian Chili", no recipe link). Its six ticks came from the recipe card on Oct 30
(Gluten, Sulphites, Corn, Nightshades, Spicy, Beans), but it had no Mushroom tick. Jason, 2026-11-25: "Yes, tick
Mushroom".

- **How:** the W6 method. DOOR's own `index.html` ran in headless Chromium, seeded from the published files as a computer
  that took publication 59 (2026-11-25 14:56). Its storage held the published menu, overlay, registry and import fields,
  with the one-time alt-flag sweep marked done, as on every kitchen computer.
  - It read every published file it reads in the kitchen, from the same addresses, through DOOR's test transport
    (`tests/helpers/door_publish_recovery_box.mjs` `RecoveryRemote`). That covers raw, Pages and the contents API, with
    GitHub's raw Accept header honoured. CODEX's feed and `library_public.json` came from live Pages, the HOUSE sites
    from `conc-kitchen-house` `main`, and `hub_schedule.json` from `conc-kitchen-hub` `main`.
  - A **control run** with no edit rebuilt publication 59 exactly, with only stamps differing.
  - The change was then written the way Edit Menu's answers-only save writes one: the stored dish boxes were copied with
    `hasMushroom` on the vegan box, then `doorNoteMealChange` (Edit Menu), `saveMenuBaseOverlay` and `appendChangeLog`.
    It was published once with `publishToGitHub(true)`, which reported "Available to the kitchen".
  - The files DOOR committed are this change. Only the trailing newline was matched to DOOR's own files.
- **What moved:**
  - `menu_current.json` and `menu_overlay.json`: `menu.2.FRIDAY.lunch_slots.veganalt.flags.hasMushroom` is on.
  - `change_log.json` and `recent_log.json` gain one entry each (by Jason Kennedy). Under the newest-10 rule,
    `change_log.json`'s 11th entry drops its kept copy.
  - Publication 59 → 60 on every stamped file. `door_state.json`, `registry_summary.json` and `routing_by_meal.json`
    change only their stamps.
- **Not moved:**
  - Every routing count; no resident moves plate.
  - The meal's own ticks (the regular plate) and the Beef Chili box. The beef batch has no mushroom.
  - The meal words, the vegan line, and every other meal.
  - The meal's Oct 30 original is kept, so Put back the original still reaches the meal before Mat's change.
- **Who it reaches:** today no one on the vegan plate has a mushroom restriction. Only one resident has one, and they are
  on another plate. The tick protects whoever DOOR plates Vegetarian Chili to later.
- **Check:**
  - `tests/veg_chili_mushroom_gate.mjs` (3), red 2/3 on `main` `dfcfdcd`.
  - Node suite: 1215 pass, 3 fail, 4 skipped. The 3 failures read CODEX's feed from the worktree's sibling folder, which
    on this machine is a stale June clone. They test feed parsing, not menu data, and are unchanged by this change.
  - Advisory `menu-decisions`: 4/4.
- **After merge:** EXPO picks it up at its next DOOR review (Menu & Board → Review DOOR menu → Apply).
