# Bug: Beguiling Twist keeps its own raw `save-result` listener forever when the save prompt is dismissed (one window-listener leak per dismissed cast)

## Summary
The 2026-11-05 save-dismiss fix (commit `fa7a628ff`) made `SavePromptModal` broadcast `save-dismissed` and made `createSaveListener()` detach its own listeners on dismissal — but `CharReactions.jsx` `handleBeguilingTwistConfirm` registers its **own raw** `window.addEventListener('save-result', handleSaveResult)` (line 803) *in addition to* using `createSaveListener` for the promptId. That raw listener is only removed at line 800 when a matching `save-result` arrives. When the GM clicks **Dismiss** on the queued WIS prompt, no `save-result` ever fires, so the listener is **never removed** — it captures `targetName`, `conditionKey`, `promptId`, `playerStats`, `campaignName` closures and leaks one window listener per dismissed cast. The outcome is safe (the stale listener can never match a future promptId, so no wrong effect ever fires), but it is a permanent listener/memory leak for the whole page session, and the abandoned cast applies no state with no producer-side detach path. `saveOnlyHandler.js:142` registers the same shape of raw listener with the same leak on Dismiss.

## Steps to reproduce
The leak is not visible in the UI — make it observable by counting listeners in-page:
1. In `test-campaign`, put a Warlock with the **Beguiling Twist** reaction on a combat board (check `docs/test-character-registry.json`; the reaction arms when the character fails or is subjected to a charm/fright effect per the feature).
2. In `browser_run_code_unsafe`, wrap the listener APIs BEFORE triggering:
   `window.__adds=[]; window.__removes=[]; const oa=window.addEventListener, or=window.removeEventListener; window.addEventListener=function(t,f){if(t==='save-result')window.__adds.push(f);return oa.apply(this,arguments)}; window.removeEventListener=function(t,f){if(t==='save-result')window.__removes.push(f);return or.apply(this,arguments)};`
3. Trigger Beguiling Twist → choose target in the chooser → confirm → a WIS save prompt queues (an `ability_use` row "…must make WIS save (DC N)…" is logged, see `CharReactions.jsx:756`).
4. On the save prompt click **Dismiss** (do NOT roll).
5. Evaluate `window.__adds.filter(f=>window.__removes.indexOf(f)<0).length` — the handleSaveResult closure for this cast counts as **leaked** (added, never removed).

## Expected behavior
On dismissal of its prompt, Beguiling Twist's raw `save-result` listener is detached (e.g. by also listening for `save-dismissed` gated on `promptId`, removing both listeners and optionally logging an abandonment/refusal row) — zero net listeners added per dismissed cast.

## Actual behavior
- `save-dismissed` fires (SavePromptModal) and `createSaveListener`'s internal listener detaches itself (`savePrompt.js:150-172`), but the CharReactions raw listener at `CharReactions.jsx:803` is untouched: its only `removeEventListener` call (line 800) is inside the matching-`save-result` branch that never runs.
- One leaked `save-result` listener per dismissed Beguiling Twist cast, each retaining the cast's closures for the whole session. No log row marks the abandoned cast beyond the initial `ability_use` spend.

## Likely location
Confident from code read:
- `src/components/char-sheet/CharReactions.jsx` — `handleBeguilingTwistConfirm` (:742-811): raw `save-result` listener (:803), removal only on matched result (:800); nothing subscribes to `save-dismissed`.
- Same shape: `src/services/automation/handlers/combat/saveOnlyHandler.js:142` (removal only at :139 inside the result branch). Also audit the other raw-listener producers for whether they already handle dismissal: `StepsOfTheFeyTauntModal.jsx:255` (has sibling `StepsOfTheFeyTauntModal.saveListenerCleanup.test.jsx` — check what it locks), `HurlThroughHellModal.jsx:214`, `EyebiteEffectModal.jsx:391`, `counterSpellHandler.js:167`, `beguilingDefensesHandler.js:194`, `tempTeleportHandler.js:196`, `reactionDebuffHandler.js:349`, `reactionSaveHealHandler.js:229`, `reactionDamageHandler.js:302`, `bonusAttacksHandler.js:266`, `postCastRiderHandler.js:129`, `relentlessRageService.js:251`, `sanctuarySave.js:65`, `handleSanctuarySave.js:63`, `handlePlainDamage.js:221`, `hitResolution.js:50`. Grep census: `addEventListener('save-result'` in `src/` (non-test hits above).

## Suggested fix
Mirror the established post-fix pattern (DivineSparkModal + `createSaveListener` in `savePrompt.js:150-172`): in `handleBeguilingTwistConfirm`, register a `save-dismissed` companion listener gated on the same `promptId` that removes BOTH listeners and logs a `save_result`-shaped abandonment or `beguiling_twist_refused` automation row (zero further state — the reaction/charge economics stay in the accepted §9 pay-early family). Do NOT invent a new event type; `save-dismissed` already carries `promptId`. Fix `saveOnlyHandler.js` the same way (its result-leg listener also leaks on Dismiss). For the wider census, at minimum verify each producer and record which still leak in `docs/test-setup-playbook.md` notes (separate tickets if any of them produce *wrong state* on dismissal, not just leaks — leak-only ones need not block here).

## Severity
Minor (integrity/leak). No wrong game state is produced today — the leaked listener can never match a later promptId — but it is a permanent per-dismissal listener + closure leak on the longest-lived pages (character sheets), and it leaves an abandoned cast with only a spend row in the log. Explicitly flagged as follow-up owed when the `save-dismissed` family fix landed.

## Resolution (2026-11-05)

**Status: FIXED.** Diagnosis confirmed live before touching code: with `window.addEventListener` wrapped in-page, one dismissed Beguiling Twist cast in test-campaign showed `adds=2, removes=1, leaked=1` — exactly the raw `handleSaveResult` closure at `CharReactions.jsx:803` stranded forever (the `createSaveListener` companion detached itself correctly).

**What was actually wrong:** both raw per-cast `save-result` producers (`CharReactions.jsx` `handleBeguilingTwistConfirm` and `saveOnlyHandler.js` `handle`) removed their listener only inside the matching-`save-result` branch. `SavePromptModal`'s un-rolled Dismiss never dispatches `save-result` (dismiss doctrine), so each dismissed cast leaked one window listener + closure set and left the log with only the spend row.

**Fix (mirrors `savePrompt.js:167-172` / DivineSparkModal exactly — no new event types):**
- `src/components/char-sheet/CharReactions.jsx` — added a promptId-gated `save-dismissed` companion listener that removes BOTH listeners and logs an `automation` row `beguiling_twist_refused` / reason `save_dismissed` (zero further state; the reaction spend stays — §9 pay-early family, copy matches DivineSparkModal's `refuse()` row). The result branch now detaches both listeners at arrival (idempotent across the two paths).
- `src/services/automation/handlers/combat/saveOnlyHandler.js` — same companion; reuses the existing `saveOnlyRefusal()` helper so the row is `<feature-slug>_refused` / `save_dismissed` (e.g. `stunning_strike_refused`).
- Rulesets: both touched handlers are ruleset-agnostic (no 5e/2024 branches) — dual-ruleset safe.

**Regression tests (new):**
- `src/components/char-sheet/CharReactions.beguiling-twist-dismiss.test.jsx` — leak ledger (add/remove counting, per-handler identity): confirm registers exactly 1 `save-result` + 1 `save-dismissed` producer listener; matching dismiss → ledger open=0, refusal row logged, zero `activeConditions` writes / `addExpiration` / `save_result` rows; mismatched promptId inert; resolved-result twin drains the dismissed companion (no phantom refusal after real resolution).
- `src/services/automation/handlers/combat/saveOnlyHandler.dismiss.test.js` — same four pins for the save_only producer.
- Per-test unique promptIds (saveOnlyHandler.test.js:46-49 doctrine) — a shared id let earlier tests' stale listeners pollute later ledgers (found live while writing these).

**Results:** new tests 8/8 pass; sibling suites (cla034, saveOnlyHandler.test, savePrompt.dismiss-detach, SavePromptModal.save-dismissed, DivineSparkModal.save-dismissed, StepsOfTheFeyTauntModal.saveListenerCleanup) 34/34 pass; `src/services/automation/handlers/combat` folder 799/799; `src/components/char-sheet` folder 5294/5294; `npm run lint` zero warnings; `no-timers-guard` OK.

**Live re-verification (test-campaign, :5173, FeyRanger rigged to Fey Wanderer for the row):**
- Dismiss path post-fix: `adds=2, removes=2, leaked=0` for BOTH `save-result` and `save-dismissed`; log row `automation / beguiling_twist_refused / save_dismissed — "Beguiling Twist refused — HexWarlock's save prompt was dismissed, no condition applied."`; HexWarlock change-data bucket NEVER created (zero state writes).
- Happy path: fresh cast → Roll Save → SAVE SUCCESS 23 vs DC 17 → both `save_result` rows log as before (producer row + canonical `save-dismissed`-untouched lane), listeners drain on Done, no phantom refusal row.
- Rig cleanup: FeyRanger.json restored byte-identical (md5 f62bd593…, git porcelain empty); admin clear-change-data + clear-log two-pass quiet-tab → `{}` / `[]`.

**Census outcome (grep `addEventListener('save-result'` in `src/`, non-test):**
- Already dismiss-clean: `savePrompt.js` `createSaveListener` (self-detaches both), `DivineSparkModal.jsx` (opts into `save-dismissed`), plus this fix's two sites.
- **Still leak on dismiss (leak-only, all promptId-gated on `createSaveListener`/`utils.guid()` unique ids → safe outcome):** `beguilingDefensesHandler.js:194`, `tempTeleportHandler.js:196`, `counterSpellHandler.js:167`, `reactionDebuffHandler.js:349`, `reactionSaveHealHandler.js:229` (+ its death-save twin lane), `reactionDamageHandler.js:302`, `bonusAttacksHandler.js:266`, `postCastRiderHandler.js:129`, `relentlessRageService.js:251` (+ death-save twin), `sanctuarySave.js:65`, `handleSanctuarySave.js:63`, `handlePlainDamage.js:221`, `hitResolution.js:50` (Majesty lane), `HurlThroughHellModal.jsx:214`, `ClairvoyantCombatantModal.jsx:176`.
- **Mount-scoped (component effect + unmount cleanup — NO per-cast listener leak; a dismissed save can strand the modal's pending-prompt row — the divine-spark-dismiss-softlock family, not a listener leak):** `StepsOfTheFeyTauntModal.jsx` (unmount drain pinned by `saveListenerCleanup.test.jsx`), `AreaEffectTargetModalBase.jsx`, `MassSuggestionModal.jsx`, `SaveAttackAoeModal.jsx`, `AreaEffectSaveFlow.utils.js`, `AOEConditionModal.jsx`, `EyebiteEffectModal.jsx`, `ElementalAttunementModal.jsx`.
- **Not leaks / false positives:** `useLoggedDiceRollEventHandlers.js:569` is a once-per-page singleton (`__pendingResultHandlersInstalled`); `attackRollRiders.js:182` gates `bardic-inspiration-offense-result` and `hitResolution.js:72` gates `veer-confirm` (different event channels — veer's id IS deterministic (`veer-<target>`) but it is NOT a `save-result` listener and Dismiss never strands it since the save queue doesn't broadcast veer-confirm).
- **Wrong-state producers: NONE found** — every remaining raw `save-result` listener gates on a per-mint unique promptId, so a stale listener can never match a future prompt. No separate tickets owed on state grounds; leak-only follow-ups remain.
