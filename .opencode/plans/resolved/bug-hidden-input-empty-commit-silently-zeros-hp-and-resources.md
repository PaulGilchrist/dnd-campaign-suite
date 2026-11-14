# HiddenInput sheet editors: clear-then-blur silently commits 0 — HP and tracked resources zeroed with no confirm, no cancel

## Summary

Every click-to-edit badge on the character sheet (Hit Points, Gold, all tracked-resource pools) opens the shared `HiddenInput` number editor. Clearing the field and committing (blur via Tab/click-away, or Enter) writes **0** — silently, with an `hp_change` audit row for the HP lane — and Escape does not cancel the edit (the editor just stays open holding the empty value). A GM who means to abandon an edit instead downs the character or empties a class resource.

## Steps to reproduce

Starting from a clean state in **test-campaign** on localhost:

1. Select the campaign, open the ElderPaladin sheet. Note `Hit Points: 224/224 (cur/max)` and `Lay On Hands Pool: 100/100 (cur/max)` in the summary badges.
2. Click the `Hit Points:` badge row — an inline `input[type=number]` opens pre-filled with `224`.
3. Select-all + delete so the field is EMPTY, then press `Tab` (or click anywhere else, or press `Enter`).
4. Observe: badge now reads `Hit Points: 0/224 (cur/max)`; `GET /api/campaigns/test-campaign/change-data` shows `ElderPaladin.currentHitPoints === 0`; the campaign log gained an `hp_change` row. No confirm dialog, no toast, no undo.
5. Repeat on the `Lay On Hands Pool` badge (or any tracked-resource badge): clear + commit → badge `0/100`, bucket `layOnHandsPool: 0` persisted.
6. Re-open an editor, clear it, press `Escape`: the editor REMAINS OPEN holding the empty value (Escape is inert); a subsequent blur/Enter still commits 0.

## Expected behavior

An empty field is not a value the user typed — committing it should CANCEL (close the editor, write nothing), or at minimum restore the previous value. Zeroing HP (a down-state) or a class resource from an abandoned edit should be impossible without explicitly typing `0`. Escape should cancel the edit.

## Actual behavior

`commit()` computes `Number('') === 0` and commits it through the normal save lane. Live-verified this run (KB 2026-11-14):
- ElderPaladin HP `224 → 0` via clear+Tab (bucket GET `currentHitPoints: 0`, one `hp_change` log row, badge `0/224`). Restoring `224` + Enter wrote back fine — the damage lane and the normal lane are indistinguishable to the user.
- ElderPaladin `layOnHandsPool` `3 → 0` and (after a fresh re-seed) `100 → 0` via the same gesture, each persisted to change-data.
- Escape leaves the editor open with the empty value; no cancel path exists.
- Side effect witnessed: the transient HP-0 armed the death-save lane enough to fire a `GET /api/campaigns/test-campaign/deathSavePrompt-ElderPaladin → 404` console error on recovery (see separate note — prompt-key evict probe on a never-created key).

NOTE: the commit-0-on-clear behavior is unit-pinned by `src/components/common/HiddenInput.test.jsx` ("commits 0 when the input is cleared"), so it is the shared editor's INTENDED spec — but that spec is destructive at the `CharHitPoints`/`CharGold`/`TrackedResourceInput` consumers, where an accidental empty blur is indistinguishable from an intentional zeroing. Changing the pin is part of the fix (owner-ratify the cancel-on-empty semantics).

## Likely location

Confident on the mechanism, on the shared component: `src/components/common/HiddenInput.jsx` — `commit()` (`const numVal = Number(localValue)` with empty-string draft; `onBlur={commit}`), and `handleKeyDown` which branches ONLY on Enter (no Escape branch, no cancel affordance anywhere in the file). Consumers that inherit the hazard: `src/components/char-sheet/char-summary/CharHitPoints.jsx` (max unbounded — 0 = downed), `CharGold.jsx`, `TrackedResourceInput.jsx` (pool badges).

## Suggested fix

In `commit()`: if `String(localValue).trim() === ''` → close without committing (call `handleInputToggle()` only). Add an `Escape` branch doing the same (it already `stopPropagation`s keydown, so no parent will double-handle). If an owner prefers clear→0 to stay legal for resource badges, scope the cancel-on-empty to the HP/Gold consumers via a prop (e.g. `cancelOnEmpty` default true). Update `HiddenInput.test.jsx`'s "commits 0 when the input is cleared" pin to the ratified semantics and add an Escape-cancel pin.

## Severity

Data integrity risk — a plausible accidental keystroke sequence (open, clear, tab away) silently overwrites canonical game state; zeroed HP means a downed character with an audit row attesting a change nobody intended, and there is no visible undo.

## Resolution

FIXED 2026-11-14 — diagnosis from the bug file confirmed exactly: `HiddenInput.commit()` computed `Number('') === 0` and pushed it through the normal save lane, and `handleKeyDown` branched only on Enter (Escape inert). Fixed at the shared editor (cancel-on-empty for ALL consumers, per the Expected section — an empty draft is never a value; explicit `0` stays the only way to zero).

**Changes:**
- `src/components/common/HiddenInput.jsx` — added a `cancel()` helper (restores the displayed `value` into the draft so a reopen never shows a stale empty edit, then `handleInputToggle()`); `commit()` now cancels when `String(localValue).trim() === ''`; `handleKeyDown` gained an `Escape` branch calling `cancel()` (keydown already `stopPropagation`s, no parent double-handling).
- `src/components/common/HiddenInput.test.jsx` — flipped the `commits 0 when the input is cleared` pin to cancel-on-empty (blur AND Enter variants, no `handleValueChange`, toggle once); pinned explicit `0` still commits; added an Escape-cancel pin; the old `does not commit on other keys` pin (which relied on Escape being inert) now uses ArrowUp/Tab only.
- `src/components/char-sheet/char-summary/CharHitPoints.test.jsx` — consumer-face regression pins: cleared editor committed by blur/Enter/Escape writes NO runtime value and NO `hp_change` log row and closes the editor; explicitly typed `0` still writes HP 0 + the unconscious `hp_change` row.

No consumer-side prop was needed — all four consumers (`CharHitPoints`, `CharGold`, `TrackedResourceInput`, plus the comment-only `MoonlightStepResourceModal` reference) want the same semantics; `CharHitPoints`' own `committing 0 (unconscious)` pin passes a literal `'0'` string and is unaffected. `HiddenInput` is ruleset-agnostic (no 2024 sibling).

**Verified live (test-campaign, :5173, post-fix):**
- Repro BEFORE fix: clear + Enter on the HP badge → `Hit Points: 0/224`, bucket `currentHitPoints: 0`, one `hp_change` row (`delta:-224, isUnconscious:true`); clear + Escape → editor stayed open holding `''`.
- AFTER fix: clear + Enter, clear + Tab, clear + Escape all CLOSE the editor with badge still `224/224` (bucket never re-zeroed); reopen shows real value `224` (no stale empty draft); Lay On Hands Pool clear+blur stays `100/100`.
- Adjacent sanity: explicit `0` + Enter → `0/224` committed; normal edit-and-save `224` restored; pool explicit `90` committed and restored to `100`. Console clean except the pre-existing `deathSavePrompt-ElderPaladin` 404 evict-probe (Improvement Backlog item, fired by the transient HP-0 in the explicit-0 check).
- Tests: `npx vitest run` on `HiddenInput.test.jsx` + `CharHitPoints.test.jsx` → 41 passed; touched folders `src/components/common` + `src/components/char-sheet/char-summary` → 117 files / 1348 passed. `npm run lint` clean (zero warnings).
- Cleanup: tab closed, admin clear-change-data + clear-log via curl, GET-verified `{}`/`[]`; char files on disk untouched (HP/pool churn lived only in change-data).
