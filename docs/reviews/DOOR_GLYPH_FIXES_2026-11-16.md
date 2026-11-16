# DOOR glyph fixes

Prepared November 16, 2026, following the [glyph audit](DOOR_GLYPH_AUDIT_2026-11-16.md). Includes the follow-up correction requiring an explicit review-tag choice.

## Interface and export changes

- Added a blank Choose a tag option to the review form. Add rejects an empty choice; the form resets to the blank choice after adding a classification. Service note and Not applicable remain available. Existing learned answers are unchanged.
- Removed the ambiguous square from both Review and Generate empty-state templates.
- Changed permanent-edit log labels to plain text, kept escaping for stored content, and rendered the type icon separately. A populated log now shows Permanent edit rather than an HTML entity.
- Replaced font-dependent navigation, action, status and help decoration with an embedded SVG vocabulary. SVGs inherit the surrounding text colour, contain their own paths, and work offline and in popup documents. Mathematical symbols no longer stand in for printing, settings, files or other actions.
- Standardized Add controls on ASCII plus. Standardized check, close, edit, swap, refresh, theme, spreadsheet, print and warning icons. Temporary button messages restore the original SVG markup when they finish.
- Kept text-only messages as text. Spreadsheet safety labels now use explicit ANAPHYLACTIC and Moderate allergy wording without decorative warning/lightning/circle glyphs. Red styling, containment language, allergens and routing rules remain intact. Browser plating warnings use SVGs alongside their text.
- Preserved the stored black-flag sentinel and all comparisons against it. Changed only its visual rendering. Imported text, accented names and ordinary punctuation are not passed through an icon-replacement sweep.
- Added names to icon-only close/remove buttons and made the two information tooltips focusable with readable descriptions. All SVG decoration is hidden from assistive technology.
- Updated upload guidance to name the actual Send to kitchen action.

The delivered app remains one HTML file with no new runtime dependency, build step or external icon/font service. The migration used a temporary parser script; that script is not part of DOOR.

## Verification

- Explicit tag-selection follow-up: 130 smoke tests passed; an isolated browser confirmed rejection of blank choices, acceptance of an explicit tag, reset after Add and the other action choices.
- Full root-level Node test suite: 934 tests, 933 passed, one skipped, zero failed.
- Existing browser theme and print gate: 263 checks passed across light/dark themes at 1280, 820, 390 and 320 pixels, with HTTP(S) disabled.
- Focused browser pass: all ten main screens opened; generated SVGs contained valid SVG paths, no icon markup leaked into displayed text, and no page errors occurred.
- Populated permanent-edit log: one SVG type icon, readable Permanent edit label, no literal arrow entity, and a synthetic SVG/onload payload remained escaped text.
- Review empty state: no square or empty-icon element. Theme and Edit Menu toggles retained SVG icons after state changes.
- Dark-mode dinner plating under print media retained its paper palette, ANAPHYLACTIC wording and SVG warning on the anaphylactic resident row. Print screenshots were visually inspected.
- After the final text-only cleanup, the 151 affected smoke, undo and kitchen-reader checks passed again.
- Existing test harnesses now load the real SVG helper where they extract a renderer in isolation. Text assertions were updated for intentional copy changes. XSS checks still reject arbitrary SVG and event attributes; only exact known SVG strings produced by the real helper are excluded from the hostile-payload scan.

Native Excel and physical printer rendering were not exercised. The workbook change removes decorative glyph dependencies from safety labels, while preserving their text and cell formatting.

## Separate import diagnosis

The home-screen `sp+B4:B23icy` issue is source text plus a remembered classification, not icon rendering. See the [separate diagnosis](DOOR_IMPORT_TEXT_DIAGNOSIS_2026-11-16.md). No workbook, published JSON snapshot, learned answer or resident record was edited.

## Provenance

[Verification receipt](../receipts/door_glyph_fixes_2026-11-16.json) records the input hashes, browser results and separate source-cell reproduction. Base commit: `5bcba1bb6fd81a73ee977b6f8e951dfb173115bd`. Final index.html SHA-256: `2c9b7d34d1a0ea1998d5fca77a94f4ada59f4e98bc9ab52c8110363c77c11f81`. The original audit remains a frozen review of its original source revision.
