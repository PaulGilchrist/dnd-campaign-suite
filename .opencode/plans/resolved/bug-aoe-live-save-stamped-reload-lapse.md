# Live AoE save resolution stamps a phantom "resolved after a page reload — effect not applied" lapse row and logs the target's save equation as a caster DAMAGE roll

## Summary
Resolving a sheet-cast Burning Hands save prompt entirely on one live page (no reload, no second window) writes an `automation` row claiming the save "was resolved after a page reload — the DivinationWizard awaiting it lapsed with the lost page (effect not applied, no chooser available)" — while the very next rows show the effect WAS applied (real 4 damage, HP 85/89). The same commit also logs the TARGET's save equation as if it were the CASTERS' damage roll: `DivinationWizard rolls Burning Hands damage: 21 (1d20+8)`.

## Steps to reproduce
1. Same rig as `bug-aoe-evasion-success-pays-half-damage` (test-campaign, overlay armed as DivinationWizard's target, Burning Hands cast, FeyRanger auto-preselected, Leading Evasion chooser Skip).
2. On FeyRanger's `Saving Throw Required` prompt press `Roll Save` (rolled 13 + 8 = 21 vs DC 19, SAVE SUCCESS), then `Done`. Do NOT reload the tab at any point (the casting tab was continuously mounted since campaign select).
3. Read the campaign log.

## Expected behavior
The consumerless-resolution lane (`resolveConsumerlessSavePrompt`, `src/services/automation/common/savePrompt.js:353`) no-ops on a same-page live chain — its own comment: "on a same-page live chain the registry check no-ops it, keeping every live lane byte-unchanged". No `save_lapsed` row; no contradictory "effect not applied" claim when the effect applies; damage roll rows describe the DAMAGE roll only (3d6 + 5 → 4), attributed to the caster.

## Actual behavior
Log rows written in one millisecond cluster (same commit), timestamps 1795527037200–7:
1. `save_result :: FeyRanger succeeded DEX save (DC 19, rolled 13 +8 = 21 — full success)` (honest).
2. `automation(save_lapsed) :: FeyRanger's DEX save (DC 19) against DivinationWizard was resolved after a page reload — the DivinationWizard awaiting it lapsed with the lost page (effect not applied, no chooser available).` — FALSE on all three claims: no reload happened, the awaiting chain was live (it applied damage two rows later), and a chooser had just been answered on the same page.
3. `roll :: DivinationWizard rolls Burning Hands damage: 21 (1d20+8)` — that "21 (1d20+8)" is FeyRanger's SAVING THROW equation (d20 13 + 8) re-labelled as a Burning Hands DAMAGE roll attributed to the caster. Burning Hands damage is 3d6 (+5 Empowered Evocation).
4. `hp_change :: FeyRanger takes 4 damage (85/89 HP)`.
5. `roll :: DivinationWizard rolls Burning Hands damage: 9 (3d6 + 5 [Empowered Evocation]) Fire → 4 final` — the honest damage row, duplicating the fake one above it.

Console was clean (0 errors). Single-tab session (no second window; the `livePeerProducer` ownerTab branch is not the live-foreign case).

## Likely location
- `resolveConsumerlessSavePrompt` early-return depends on the page-local `liveSaveListenerIds` set containing the resolved promptId. The AoE modal prompt lane evidently arms via the server-side `pendingSaveListenerPrompts` bucket but does NOT register into the page-local `liveSaveListenerIds` on the casting page (or the modal resolves with a promptId that differs from the registered one — `savePrompt-<target>` vs `savePrompt-<target>-<uuid>`), so the lapsed pair writes even though the caller's own live chain continues and applies damage right after. Start in `src/services/automation/common/savePrompt.js` (createSaveListener registration vs the SaveAttackAoeModal handleSaveResult/Done call site) and the modal-family arming site in the AoE chain.
- The mislabelled `21 (1d20+8)` roll row rides the same commit — look for a damage-row helper fed the save detail (`detail.saveRoll`/`saveBonus` total + formula `1d20+8`) instead of the actual damage dice; guess: the lapsed-resolution or adjudication path logs `damageRoll` copy with the detail's save-roll fields.

## Suggested fix
Log every armed AoE save prompt's id into `liveSaveListenerIds` (or pass the live-consumer token through to the modal's resolve call) so the registry check actually sees the casting page's own chain; add a regression pin that resolves an AoE save prompt on the mounting page and asserts ZERO `save_lapsed` rows. Then audit the commit's roll-row builder for the save-detail leak (the row should never print `1d20+8` as spell damage).

## Severity
Data integrity risk — the campaign log is the AI-memory/audit source of truth; a fabricated lapse claim ("effect not applied") beside a real damage application, plus a phantom damage roll, corrupt adjudication history every live AoE cast.

## Resolution
FIXED 2026-11-24 (fix-run). Reproduced live first (single :5173 tab, test-campaign, DivinationWizard target-armed on a placed sphere overlay, Burning Hands → picker → Leading Evasion Skip → Roll Save → Done, no reload): the log cluster carried the false `save_lapsed` "resolved after a page reload" row + its phantom generic `save_result` twin inside the same millisecond cluster as the real `hp_change` (16 damage applied), plus `roll | save-damage | DivinationWizard rolls Burning Hands damage: 14 (1d20+13)` — the target's save equation re-labelled as caster damage.

**Root cause #1 (phantom lapse pair) — as guessed.** `SaveAttackAoeModal.resolvePcTarget` (and the sibling `issuePlayerSavePrompt` in `AreaEffectSaveFlow.utils.js` for the condition-AoE modals) arm prompts by stamping the promptId into the campaign `pendingSaveListenerPrompts` book, but their live consumer is a page-local React `save-result`/`save-dismissed` listener — invisible to the page-local `liveSaveListenerIds` registry that only `createSaveListener` populates. `SavePromptModal`'s Done/Dismiss seam runs `resolveConsumerlessSavePrompt` BEFORE dispatching; with the registry blind to the modal chain and the bucket marker present, it wrote the lapse pair even though the caller's own chain applied the damage milliseconds later. The ids are identical (`event.data.promptId` rides the queue verbatim) — the "promptId differs" half of the guess did not apply.

**Fix #1:** `savePrompt.js` exports `registerLiveSaveListener`/`unregisterLiveSaveListener` over the existing registry; the listener-owning effects mark the queue's promptIds live for exactly their mount lifetime — `SaveAttackAoeModal`'s pendingPrompts effect (deps moved from `pendingPrompts.length` to `pendingPrompts` so drains clean settled ids and re-renders re-mark survivors) and `useSaveResultListener`/`useSaveDismissedListener` in `AreaEffectSaveFlow.utils.js`. Registration lands at listener MOUNT, not at the arm site: during the pre-commit arm window the listener genuinely cannot receive the dispatch, so a resolution there stays honestly "lapsed". A reload/unmount empties the registry, so the rescue lane keeps writing the lapse pair for a genuinely dead chain (byte-unchanged reload face; consumerless rescue tests re-verified).

**Root cause #2 (mislabelled damage row) — NOT the lapsed path as guessed.** `applyPlayerSaveDamage` logged the save-adjudication row itself with `rollType: 'save-damage'`, `characterName: <caster>`, `total: <save total>` and `formula: 1d20+<saveBonus>`; `logService.deriveAuditText` renders `save-damage` through `describeDamageRoll`, so the audit text read "Caster rolls <spell> damage: 21 (1d20+8)". The verified quick-roll lane already does this correctly: `buildSaveRollLogData` (`useLoggedDiceRollEventHandlers.js`) logs the save as `rollType: 'save'`, target-attributed, `attackerName` naming the caster, beside a separate honest damage row.

**Fix #2:** the modal's save row now mirrors that sibling: `rollType: 'save'`, `characterName: targetName`, `attackerName: playerStats.name`, and the `1d20…` formula field is gone. Renders/derives as "FeyRanger makes the DEX saving throw against Burning Hands: 24 +13 vs DC 19 — SUCCESS". The caster-attributed `save-damage` row from `buildPlayerSaveDamageLog` remains the single damage row (`3d6 + 5 [Empowered Evocation] Fire → 9 final`).

**Files changed:**
- `src/services/automation/common/savePrompt.js` — exported live-registry mark/clear helpers (no behavior change to existing lanes).
- `src/components/char-sheet/modals/shared/SaveAttackAoeModal.jsx` — picker-lane listener effect registers/unregisters; save row re-attributed as `rollType: 'save'`.
- `src/components/char-sheet/modals/shared/AreaEffectSaveFlow.utils.js` — `useSaveResultListener`/`useSaveDismissedListener` register/unregister for listener lifetime.
- New: `SaveAttackAoeModal.live-save-chain.test.jsx` (zero `save_lapsed` rows while the modal listener owns the queue; save-row/damage-row attribution pins; unmount keeps the honest lapse pair) and `AreaEffectSaveFlow.live-consumer-registration.test.jsx` (hook-lane suppression, survivor/drain re-mark discipline, dismiss seam, unmount reload face).

**Verified:** original repro re-run live post-fix — the Done cluster is exactly `roll|save` (target-attributed, no `1d20` damage text) + `hp_change` + one honest caster `save-damage` row: ZERO `save_lapsed` and ZERO phantom `save_result` rows; second live cast answered with un-rolled Dismiss on the same page → one honest `save_dismissed` row, no lapse pair, no damage (HP 64/89 unchanged), and both save buckets drain-to-evicted afterward. Tests: new files 7/7; touched areas `shared/` + `automation/common/` + `hooks/combat` = 382 files / 2935 tests green; full suite green; `npm run lint` clean. Dual-ruleset: these are shared ruleset-agnostic lanes (single implementation, no 2024 twin).

**Residuals noted (not touched):** (a) the condition-AoE modal family's `logSoulstitchAutoSave`/`logPlayerSaveSuccess` rows still carry `rollType: 'save-damage'` with caster attribution (they print `damage: ?` derived text on their own narrow lanes — no `1d20` equation leak, not part of this repro); (b) a second tab answering a modal-armed prompt still writes the lapse copy — the modal family never stamps the `pendingSavePrompts` ownerTab liveness token, so the "from another window" branch cannot fire there (cross-tab AoE adjudication is a separate pre-existing lane; this bug was scoped to the same-page face).
