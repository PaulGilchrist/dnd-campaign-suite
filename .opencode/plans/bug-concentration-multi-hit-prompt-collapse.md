# Bug: Multi-hit concentration saves collapse — resolving one queued prompt silently voids every other pending save for that target (no roll, no log, key deleted)

## Summary
When a concentrating player takes damage more than once before a prompt is answered, each hit queues its own prompt (client modal even shows “(1 of 2)”), but the prompts all share ONE server key `concentrationPrompt-<Target>`, and clearing/answering deletes by target name. So resolving the first save wipes the second save for a real, separate damage event — it never gets a save, produces no log row, and the concentration incorrectly persists. Follow-up to `6b1800fa2` (cross-tab double-roll fix); this is the over-clearing side of the same lane.

## Steps to reproduce
Live-proven 2026-10-29 in `test-campaign` (dev:locked, two tabs on :5173):

1. Get a monster on the Initiative board (EB, search `Goblin`, native checkbox, **Join Encounter**) and give the player `AasimarTest` concentration: GET `/api/campaigns/test-campaign/combatSummary` → set `creatures.find(c=>c.name==='AasimarTest').concentration = {spell:'Hex', dc:10, target:'<anything>'}` → POST `{value: cs}` back (playbook §124/§125 free-write rig lane; production writes to the same `cs.concentration` slot are what real concentration grants produce).
2. Arm the Goblin’s own-card `[data-testid=target-select]` on `AasimarTest`. Open its stat modal (avatar click) and roll **Scimitar +4** (`mc-dice-link`) — land a HIT, click **Done** on the popup. A `.cnp-overlay` appears and change-data holds `concentrationPrompt-AasimarTest` = promptId **A**.
3. **Do not answer the prompt.** Fire a second Scimitar attack and land a HIT. Change-data key is now promptId **B** (same key, overwritten), and the modal header shows `Concentration Check (1 of 2)`.
4. Click **Roll Con Save** (adjudicates prompt A; panel shows MAINTAINED). Click **Done**.

## Expected behavior
Each damage instance requires its own Constitution save (RAW — multiple damage instances = multiple saves). After answering A, the modal should advance to B (“2 of 2”) so B gets its own roll and its own `roll:concentration-save` log row. If B is going to be voided, the void should at least be logged/adjudicated — not silently lost.

## Actual behavior
Answering A makes B vanish:
- After step 4, `document.querySelectorAll('.cnp-overlay').length === 0` — the second prompt modal **never appears** (no roll opportunity, no Dismiss — fully silent).
- `concentrationPrompt-AasimarTest` is absent on the server, but it held **B**’s payload; answering **A**’s prompt `DELETE`s the whole key by target name, destroying B’s live record.
- Total new `roll:concentration-save` rows for the sequence: exactly **1** for **2** damage instances (`hp_change` d-6 and d-7 both present in the log; only one save row).
- `AasimarTest.concentration` (Hex) stays intact even though B was never adjudicated — RAW, B could have broken it.
- Cross-tab: the passive tab’s queue also loses the pending entry on A’s resolution (the null DELETE-echo now drops every un-adjudicated entry for that target — `ConcentrationPromptModal.jsx:88-97`). Observed both tabs converge to 0 overlays with B unanswered.

Session-wide fingerprint: 9+ GM-landed damage instances on the concentrating PC produced only 5 save rows (every back-to-back pair collapsed).

## Likely location
Two interacting layers (confident, from code read + live evidence):
- `src/services/rules/combat/applyDamage.js:632` — `promptPlayerConcentrationSave` POSTs every hit to the SAME key `concentrationPrompt-<Target>` (`savePromptService.js:53`), so N hits collapse to 1 stored prompt (client-side queue only survives via SSE echoes it happened to catch).
- `src/components/common/ConcentrationPromptModal.jsx` — the roll lane (`handleRoll` → `clearConcentrationPrompt`) and the new null-echo handler (`:88-97`, from `6b1800fa2`) clear/drop **by target**, not by `promptId`: `filter(p => p.targetName !== targetName || p.result)` wipes sibling queued prompts, and `clearConcentrationPrompt` DELETEs the key even when it holds a *different* promptId than the one just answered.

## Suggested fix
Make the lane promptId-scoped end-to-end (mirrors how the fix already stamps `resolvedPromptIds`):
1. Key prompts per promptId (e.g. `concentrationPrompt-<Target>-<promptId>`), or store an array/registry under the target key and DELETE only the answered member — the change-data wildcard lane already supports per-key routes (`server/routes/campaigns-changedata.js`).
2. Null-echo drop should remove only entries matching the cleared promptId (include promptId in the DELETE echo payload, or reconcile queue against the surviving stored value after the echo).
3. While answering A, if B is still stored under the key, do not DELETE the key (or re-POST B).
Minimum-invasive alternative: have `handleRoll`/`handleDismiss` advance the local queue and only clear the server key when the answered entry is the one the key actually holds (compare promptIds from the last non-null echo).
Investigate: how `savePromptService` DELETE echoes carry (or don’t carry) promptId — the echo shape decides whether option 2 is possible without a server change.

## Severity
Broken feature — concentration adjudication is silently skipped for multi-hit damage (the most common combat case: multiattack, or two attackers before the player clicks). Data-integrity-adjacent: the concentration buff that RAW might have broken persists, and the campaign log understates saves with zero user-visible feedback. Not a crash, and single-hit flows (the 6b1800fa2 contract) still work correctly.

## Intent evidence (this is NOT a by-design simplification)
- `ConcentrationPromptModal.test.jsx:190-205` PINS the queue affordance — `(1 of 2)` header and a `Next Check` button — proving multi-prompt queues are an intended, tested feature. Those pins use two DIFFERENT targets (`concentrationPrompt-<ROLLER>` + `concentrationPrompt-<ROLLER2>`), which work because keys differ; the SAME-target multi-hit case (one key, N promptIds) has no pin and collapses live.
- The `6b1800fa2` commit contract itself claims “one save, one result, one log row **per damage event**” — the live 2-hit repro yields ONE save for TWO damage events, violating its own stated contract.

