# Death-save prompt never retires on other tabs — stale prompt rolls a second real save

## Summary
When a PC drops to 0 HP, the app-wide `DeathSavePromptModal` opens on EVERY tab, but when any one tab adjudicates the save the prompt on all OTHER tabs stays open with a fully live "Roll Death Save" button. Clicking it rolls a SECOND real death save for the same down event — counters advance again, a second `death_save` log row appears, and the stale entries silently accumulate in the passive tab's client queue. This is the exact bug class fixed for the concentration prompt by 6b1800fa2 (passive overlays auto-close ≤3ms on the resolution echo); the death-save modal was not given the same adoption.

## Steps to reproduce
1. In test-campaign (localhost, dev:locked), open TWO GM tabs, both on the Initiative view (12-PC skeleton). Arm a recording `window.confirm` spy returning true on both (the drop step needs no confirm; earlier +NPC spawns may pre-fill the array).
2. Tab A: type `-50` (or `0`) into `input[aria-label="AasimarTest current HP"]` + Enter. The GM-HP death-floor (7bab0824c) floors to 0 and POSTs `deathSavePrompt-AasimarTest` — `.dsp-overlay` opens on BOTH tabs.
3. Tab B: click `.dsp-roll-btn` (Roll Death Save). Panel shows the outcome (e.g. `DEATH SAVE FAILURE`, Roll: 2); server key `deathSavePrompt-AasimarTest` is deleted; log gains one `death_save` row (totalFailures:1). Click Done on B.
4. Tab A (passive): observe `.dsp-overlay` is STILL open with an enabled "Roll Death Save" button (the key is gone server-side). Click it.
5. Observe: a SECOND death save is adjudicated — second `death_save` log row, `deathFailures`/`deathSaves` buckets advance again (live run: roll 2 fail f=1 → stale roll 19 success s=1, from a single KO), zero toast/console/log indicating the save was already resolved.
6. Extra face: while a passive tab holds an open (even already-resolved, pre-Done) panel, every subsequent `deathSavePrompt-<Target>` POST broadcast APPENDS to its queue — resolving the head leaves ghost entries that each require their own Roll click to pop (live: 3 ghosts after a multi-prompt loop; with HP still 0 a ghost roll is another real save).

## Expected behavior
When a prompt is adjudicated on any client (or the `deathSavePrompt-<Target>` key is deleted), the modal on every OTHER client should retire that prompt automatically — the demonstrated concentration-prompt contract (6b1800fa2: passive overlay auto-closes on the resolution echo, ≤~3ms first poll; acting tab keeps its result panel until Done). A passive tab should never be able to spend a second death save for one down event.

## Actual behavior
- Passive-tab overlay persists indefinitely; the roll button performs a genuine second adjudication (verified: 2 `death_save` rows for one KO, counters 0→fail→fail+success, server `deathSavePrompt-` key already absent when the stale roll fired).
- `DeathSavePromptModal.handleEvent` early-returns on `event.data == null`, so the null echo of the DELETE is ignored, and there is no listener on `deathSaveResult-<Target>` (whose payload DOES carry the adjudicated `promptId`) to retire matching queue entries.
- No dismiss affordance exists pre-roll — a player tab (the modal is mounted app-wide at `App.jsx:783` with NO localhost gate) seeing someone else's prompt cannot close it without rolling (or reloading).

## Likely location
High confidence: `src/components/common/DeathSavePromptModal.jsx` — `handleEvent` ignores null echoes (`if (!event.key || event.data == null) return;`) and there is no key-removal/result-echo handling. Fix pattern exists in `src/components/common/ConcentrationPromptModal.jsx` (6b1800fa2 adoption of the null echo) and `savePromptService.js` already DELETEs the prompt key server-side after every roll. Secondary consideration: queue de-dupe against the `deathSaveResult-<Target>` echo (it carries `promptId`, so retirement can be exact per-prompt even with multi-ghost accumulation).

## Suggested fix
Mirror 6b1800fa2: in the modal's SSE `handleEvent`, when a `change-<campaign>-deathSavePrompt-<Target>` event arrives with `data == null`, drop ALL queued prompts for that targetName (or, more precisely, retire by promptId when a `deathSaveResult-<Target>` echo arrives whose `promptId` matches a queued entry). Keep the acting-tab result-panel-until-Done semantics (same asymmetry the concentration modal documents). Add a cross-tab test in the style of `ConcentrationPromptModal.cross-tab.test.jsx`.

## Severity
Data integrity risk — one down event can silently accrue multiple saves (failures or successes) from different windows, corrupting the 3-success/3-failure adjudication and the death-save log history; the double-fire is reachable by any two connected clients (a GM's second window, or a player's tab, since the modal is not localhost-gated).
