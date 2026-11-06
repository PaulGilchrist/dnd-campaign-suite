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
