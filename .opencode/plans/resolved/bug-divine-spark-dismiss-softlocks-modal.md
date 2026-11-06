# Bug: Dismissing the Divine Spark save prompt soft-locks the DivineSparkModal ("Rolling…" forever, zero buttons)

## Summary
When the Harm branch of Divine Spark (Cleric Channel Divinity) queues a saving-throw prompt and the GM clicks **Dismiss** before rolling, the save is silently abandoned (no damage, no `save-damage`/refusal log row) AND the DivineSparkModal stays mounted showing "Rolling…" with **no buttons at all** (Done and Cancel are both hidden while `rolling===true` and no `result` exists). There is no backdrop-dismiss handler either — the modal cannot be closed without a page reload. The Channel Divinity charge spent at row-click is lost with zero record of the abandoned cast.

## Steps to reproduce
1. In `test-campaign`, ensure a combat board exists with `War_Cleric` and a party target (the owner-residual 13-PC placeholder combatSummary was sufficient; `War_Cleric` cs `targetName` armed to `EvasiveFighter` via scoped PATCH `/api/campaigns/test-campaign/combatSummary`).
2. Create/activate a map where War_Cleric is within 30 ft of EvasiveFighter (e.g. tokens (1,8) and (4,8)) so the harm branch passes its range gate.
3. Open the War_Cleric sheet → click the **Divine Spark** action row (`b.clickable` with text "Divine Spark:") → DivineSparkModal opens ("Channel divine energy at EvasiveFighter.").
4. Choose a damage type radio and click **Harm**. The spark modal shows "Rolling…" and a `Saving Throw Required` prompt appears for EvasiveFighter.
5. On the save prompt, click **Dismiss** (do NOT Roll Save).
6. Observe the DivineSparkModal.

## Expected behavior
Dismissing an un-rolled save should either:
- resolve the producer's listener with a "dismissed/abandoned" outcome (modal shows a refusal/abandoned result with a working Done button, and ideally logs a `divine_spark_refused` row), or
- the spark modal should at least return to an actionable state (Cancel/Done available).

## Actual behavior
- DivineSparkModal is stuck at "Rolling…" permanently; `document.querySelectorAll('.sp-modal button')` inside it returns **[]** (verified live — backdrop click also does nothing, `.sp-overlay` has no click handler).
- No damage is applied (EvasiveFighter runtime `currentHitPoints` unchanged by the dismissed cast).
- Campaign log gets NO `save-damage` row and no refusal row for the dismissed cast — only the two `ability_use` rows from the click ("Divine Spark activated…" + "Divine Spark (Harm) — targeting …, CON save DC 15.").
- The Channel Divinity charge was already spent at row-click (runtime `channelDivinityCharges` decremented) and is never refunded.
- Only recovery is a page reload (verified: reload clears it).

## Likely location
Confident on the seam, based on code read:
- `src/components/common/SavePromptModal.jsx` — `handleDismiss` (:897): the un-rolled branch sweeps prompt residue and `advance()`s but **never dispatches the `save-result` window event** (only `submitResultAndClear` :459 dispatches it, and it is reached only when `current.result` exists).
- `src/services/automation/common/savePrompt.js` — the "Dismiss hygiene (backlog 2026-11-03 …)" comment (:176) states by design: *"a DISMISSED save never resolves"* — the 2026-11-03 fix only swept the bucket-row leak; `createSaveListener().promise` (and any raw `save-result` window listener) stays pending forever, and the window listener is never unregistered. Producers must therefore tolerate a never-resolving outcome — DivineSparkModal does not.
- `src/components/char-sheet/modals/divine/DivineSparkModal.jsx` — `handleHarm` (:184) resolves solely via `window.addEventListener('save-result', handleSaveResult)` gated on `promptId`; `handleSaveResult` is the only setter of `result`, and the render footer (:283-289) hides both Done and Cancel while `rolling===true && !result`.
- Same-hazard producers (grep of `addEventListener('save-result'`): `CharReactions.jsx`, `StepsOfTheFeyTauntModal.jsx`, `shared/AreaEffectTargetModalBase.jsx`, `shared/MassSuggestionModal.jsx` — plus everything awaiting `createSaveListener().promise` (handlePlayerSaveDamage family). Census recommended.

## Suggested fix
Dispatch an abandonment `save-result` (or a new `save-dismissed`) event carrying `promptId` from the un-rolled branch of `handleDismiss`, and have DivineSparkModal treat a dismissed/absent-outcome as `refuse('save was dismissed — no damage dealt')` (it already has a `refuse()` helper that logs + sets a result with a working Done). Alternatively/additionally, make the spark modal's `rolling` state abortable: render a Cancel button when no prompt is pending for the `promptId` anymore (the prompt-queue drop is already broadcast via `dropPendingSavePrompt`). Check every `save-result` listener for the same "producer waits on an event that Dismiss never fires" pattern.

## Severity
Broken feature / minor data-integrity risk. The stuck modal blocks the sheet until reload (broken feature), and the silent charge spend + missing log row means an abandoned cast is invisible in the campaign log (integrity). Not a crash and limited to one modal.

## Resolution
**FIXED 2026-11-05.** Root cause confirmed as diagnosed: the un-rolled branch of
`handleDismiss` (SavePromptModal.jsx) swept queue/bucket residue and `advance()`d
but broadcast no producer-facing outcome, and DivineSparkModal's only result
setter is its promptId-gated `save-result` window listener — so the modal parked
at "Rolling…" with zero buttons (footer hides Done AND Cancel while
`rolling && !result`).

**Why NOT a `save-result` dispatch with an abandonment flag:** the ~40
`createSaveListener().promise` consumers (saveProcessing, handleAoeDamage family,
feature services) all read a falsy `success` as "save failed → apply damage" —
resolving them with a dismissed outcome would apply FULL damage for a save that
was never rolled. The fix therefore emits a dedicated `save-dismissed` window
event (as the bug file itself allowed), which modal producers opt into.

**Changes:**
- `src/components/common/SavePromptModal.jsx` — un-rolled `handleDismiss` now
  dispatches `save-dismissed` `{ promptId, targetName }` before the bucket drop.
  (Post-roll the footer only renders Done/Next Save, so Dismiss IS the sole
  un-rolled abandon surface — verified in the render branch at :798-811.)
- `src/components/char-sheet/modals/divine/DivineSparkModal.jsx` — `handleHarm`
  registers `handleSaveDismissed` (promptId-gated, same shape as
  `handleSaveResult`): on a matching dismissal it detaches BOTH listeners and
  calls the existing `refuse('save was dismissed — no damage dealt')` — which
  logs the `automation / divine_spark_refused` row and renders the refusal
  result view with a working Done. `handleSaveResult` now also detaches the
  dismissed listener (single-shot either way). No 2024 twin exists — the modal
  is shared by both rulesets via `divineSparkHandler.js`.
- `src/services/automation/common/savePrompt.js` — family hygiene:
  `createSaveListener` now listens for `save-dismissed` to DETACH its internal
  `save-result` handler without resolving (the listener-leak the bug file
  flagged; a stray late echo can no longer resurrect a phantom resolution).
  The "a DISMISSED save never resolves" doctrine is kept for `.promise`
  consumers and the doctrine comment updated.

**save-result producer census (blast radius):** no other producer regressed —
the new event is additive and `save-result` semantics are byte-unchanged.
Still-stranded-on-dismiss (pre-existing hazard, now recoverable where the modal
closes): `StepsOfTheFeyTauntModal.waitForSaveResult` (Promise.all parks; ledger
drains on unmount so it is close-recoverable, no window leak);
`shared/AreaEffectTargetModalBase` + `AreaEffectSaveFlow.utils.js` and
`MassSuggestionModal` (effect-scoped listeners removed on unmount; `processing`
stays parked until the modal is closed); `CharReactions.jsx` beguiling-twist
(fire-and-forget grant simply never lands — safe outcome, but its RAW listener
still leaks one window handler per dismissed cast — same leak class the
createSaveListener fix cured, worth a follow-up ticket). These producers can
opt into `save-dismissed` incrementally.

**Not refunded:** the Channel Divinity charge spent at row-click is kept on
dismissal — this matches the accepted §9 pay-early leak family (Cancel /
out-of-range already keep it; deferring the spend is the filed improvement
backlog item, out of scope here). The abandonment is no longer invisible: the
`divine_spark_refused` row is the record.

**Verification:**
- Live repro BEFORE fix (test-campaign, dev pair :5173/:80, combatSummary board
  POST + War_Cleric armed at EvasiveFighter): Harm → prompt → Dismiss ⇒ modal
  stuck "Rolling…", `buttons: []`, log had only the two `ability_use` rows,
  charges 3→2, EF HP unchanged.
- Live re-run AFTER fix, same steps: modal flips to
  "save was dismissed — no damage dealt" with a working **Done** (click closes,
  0 `.sp-modal` left); log gains `automation/divine_spark_refused` row
  "Divine Spark refused — save was dismissed — no damage dealt"; zero damage.
- Adjacent sanity live: fresh Harm cast → Roll Save (24 vs DC 15 success) →
  Done ⇒ modal resolves to "…CON save (DC 15): Success / Target saved and takes
  no damage" with Done, and the normal lane logs intact (`roll/save-damage` +
  `save_result` rows byte-shaped as before).
- Regression tests (new): `SavePromptModal.save-dismissed.test.jsx` (3),
  `DivineSparkModal.save-dismissed.test.jsx` (4: refuse+Done+log row, mismatch
  inert, single-shot, no-overwrite-after-resolve),
  `savePrompt.dismiss-detach.test.js` (3: no-resolve+detach, mismatch keeps
  armed, normal resolution untouched). Touched folders
  (`src/components/common`, `modals/divine`, `services/automation/common`):
  89 files / 1029 tests PASS incl. the pre-existing `.dismiss-hygiene` and
  `DivineSparkModal.test.jsx` suites. `npm run lint` clean (zero warnings);
  `no-timers-guard` OK (no new timers). Full `vitest run`: **3078 files /
  33673 tests passed (+3 expected fail), EXIT=0** — no regressions anywhere.
- Cleanup: Admin "Clear Change Data" + "Clear Campaign Log" (dialogs handled);
  change-data `{}` + log `[]` at exit; no maps/characters touched.
