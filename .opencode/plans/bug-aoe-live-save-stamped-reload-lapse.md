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
