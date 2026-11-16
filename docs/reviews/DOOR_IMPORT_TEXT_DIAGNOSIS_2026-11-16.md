# DOOR imported restriction text diagnosis

Frozen diagnosis dated November 16, 2026. Scope: explain the home-screen entry showing `No sp+B4:B23icy Meals` separately from the glyph work. No source workbook or operational data was changed.

## Source of the visible text

The provided workbook, `C:\Users\Jason\Downloads\Meal List - Nov 17th 2026.xlsx`, contains room 405 in A59 and the restriction in C59 on the worksheet named **Aug 20th 2026**. C59 contains the literal substring `No sp+B4:B23icy Meals`. It is a stored text value, not a formula or a formula display. The workbook filename and worksheet label refer to different dates; the cell evidence does not establish which file was consumed during the earlier update.

DOOR's recent_log.json contains the same corrupted substring in the imported-text review entry. learned_nr.json retains the matching lowercased full text and a matching fragment key. `nrDoneReview()` copies the raw text into the log; `renderRecentLog()` escapes and displays it. Neither function inserts a cell range into the word.

This establishes that the supplied workbook already has the corruption before import and matches DOOR's stored text. An accidental spreadsheet range insertion is a plausible explanation for `+B4:B23`, but its original editing action is not recoverable from the file.

## The saved Halal answer is a separate concern

For room 405, learned_nr.json stores `_tags: ["halal"]` against this text. The corresponding recent-log entry says Import text classified as Halal. The source text itself does not say Halal.

An isolated browser reproduction using DOOR's real normalizer gave Soft Meals, No Pork and No Spicy both before and after removing `+B4:B23`. The corrupted spicy fragment remained in the unmatched list before correction. Once the actual learned answers were applied, both versions also acquired Halal. `doorApplyLearnedTags()` can reuse an answer when every remaining unread fragment was previously answered; it does not require only an exact full-text match. Therefore correcting C59 alone does not reliably remove that remembered Halal classification.

The current published room-405 record includes Vegetarian, Soft Meals, No Pork and No Spicy, and routes to Vegan / Vegetarian. It contains no Halal tag. This diagnosis is about what a subsequent import can propose, not evidence that the current No Spicy restriction has been lost.

## How the form could save Halal

The review tag dropdown originally listed the tags in TAG_LABELS_MAP order, starting with Halal, without an empty option. The browser therefore selected Halal automatically. Clicking Add and Done without changing it committed that default. The saved record proves a Halal review answer was committed, but cannot distinguish an intentional choice from acceptance of the default. The follow-up code fix adds an empty Choose a tag option so adding a known-tag classification requires a selection. It does not rewrite the earlier learned answer.

## Correction to review separately

Correct the literal source text to No Spicy Meals and review the stored Halal answer for this room against the intended dietary requirements. Treat those as separate source-data and learned-answer corrections. Keep the historical import log intact as an audit trail. Do not infer intended dietary classification from a spelling cleanup or silently strip arbitrary spreadsheet-looking text from resident restrictions.

## Provenance

Workbook SHA-256: `2f7f01c2b06703949a3904b2b15f069f728d647603322a59df0d7847e3ec5673`. Source cell: `Aug 20th 2026!C59`; room cell: A59. The value and absence of a formula were checked directly in the XLSX XML. DOOR reproduction used the local published learned_nr.json in isolated browser storage with network requests disabled. [Verification receipt](../receipts/door_glyph_fixes_2026-11-16.json) records the input hashes and before/after normalizer results. No resident names were needed for the diagnosis.
