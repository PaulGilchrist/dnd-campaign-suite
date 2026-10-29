# Bug: Multi-hit concentration saves collapse — resolving one queued prompt silently voids every other pending save for that target (no roll, no log, key deleted)

## Resolution (2026-10-29)

**FIXED.** Root cause confirmed exactly as diagnosed: `sendConcentrationPrompt`
POSTed every damage event to the SAME key `concentrationPrompt-<Target>`, and
both the roll/dismiss clear (DELETE by target name) and the 6b1800fa2
null-echo handler cleared/dropped **per target**, so resolving one queued save
silently voided every sibling save for that target.

**Fix — promptId-scoped lane end-to-end (option 1 of the suggested fix):**

- `src/services/combat/conditions/savePromptService.js` — new
  `concentrationPromptKey(targetName, promptId)` helper; `sendConcentrationPrompt`
  now writes `concentrationPrompt-<Target>-<promptId>` (N hits stack as N keys
  server-side instead of overwriting one), and `clearConcentrationPrompt` takes
  an optional `promptId` and deletes only that prompt's key. A missing
  promptId falls back to the legacy target-only key (staged/rig writes stay
  supported — the echo lane treats both shapes).
- `src/components/common/ConcentrationPromptModal.jsx` — `handleEvent` derives
  `targetName` from the payload (falling back to the key suffix minus the
  trailing promptId); the null-echo drop now removes **only the entry whose
  `<Target>-<promptId>` key was cleared**, while a bare-target null echo still
  performs the legacy target-wide drop (the 6b1800fa2 cross-tab contract).
  `handleRoll`/`handleDismiss` pass `current.promptId` into the clear.
- `src/services/rules/combat/applyDamage.js` — no change needed: it already
  generated a per-hit `promptId` and included it in the payload; the key
  construction lives in the service. Single `applyDamage.js` serves both
  rulesets (no 2024 sibling to mirror).

**Tests:**

- NEW `src/components/common/ConcentrationPromptModal.multi-hit.test.jsx` (4
  tests): same-target two-prompt queue `(1 of 2)` → Roll A → Next Check →
  Roll B with one `sendConcentrationResult` + one `clearConcentrationPrompt`
  per promptId; per-promptId null echo keeps the sibling save live; legacy
  bare-target null echo still target-wide drops; dismiss advances to B
  promptId-scoped.
- `src/components/common/ConcentrationPromptModal.cross-tab.test.jsx` /
  `.test.jsx` — mocks updated to the new per-promptId wire key shape and
  clear-call pins now include the promptId (legacy fallback proven by the
  multi-hit suite's bare-target test).
- `src/services/combat/conditions/savePromptService.test.js` — POST row pins
  the `<Target>-<promptId>` key; new DELETE row pins the promptId-scoped clear.

Results: new test 4/4; touched folders — `src/services/combat/conditions` 21
files/872 tests, `src/services/rules/combat/applyDamage*` 26/207,
`src/components/common` 49/540, all green. `npm run lint` zero warnings.

**Live re-verification (test-campaign, dev :5173, single tab + two-tab):**

- Repro pre-fix confirmed first: 2 hits → server key held only promptId B
  (A overwritten), answering A left `.cnp-overlay` = 0, 1 `roll:concentration-save`
  row for 2 `hp_change`s, conc intact.
- Post-fix: hit 1 stored `concentrationPrompt-AasimarTest-3b9b7908-…`; hit 2
  stored a SECOND key `…-7bc293d6-…` (both present simultaneously) while the
  modal showed `(1 of 2)`. Rolled A (MAINTAINED) → A's key gone, B's key
  still on the server; Done → **B's prompt appeared with its own Roll Con
  Save**, rolled it (Total 19 vs DC 10), Done → 0 overlays, both keys gone,
  exactly **2 new `roll:concentration-save` rows** (totals 19/19 in the log,
  the earlier 11 was the pre-fix leg) for the 2 damage instances.
- Adjacent sanity: single-hit flow still one save/one row; Dismiss path
  promptId-scoped; two-tab: prompt mirrored to passive tab (1 overlay each),
  acting tab's Roll closed the passive overlay in ~150ms with zero reloads,
  exactly one new save row, key cleared (6b1800fa2 contract intact —
  verified on the new keys; the failing-roll leg correctly nulled
  `creature.concentration`).
- Cleanup: admin clear-change-data `{}` + clear-log `[]` GET-verified after
  closing both tabs; dev server stopped.

## Summary
When a concentrating player takes damage more than once before a prompt is answered, each hit queues its own prompt (client modal even shows “(1 of 2)”), but the prompts all shared ONE server key `concentrationPrompt-<Target>`, and clearing/answering deleted by target name. Resolving the first save wiped the second save for a real, separate damage event — no save, no log row, concentration incorrectly persisted. Fixed by keying prompts per promptId (`concentrationPrompt-<Target>-<promptId>`) end-to-end: prompts stack on the server, clears and null-echo drops are promptId-scoped (bare-target echoes keep the legacy target-wide clear), and each damage instance now gets its own save, roll, and `roll:concentration-save` log row.

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

