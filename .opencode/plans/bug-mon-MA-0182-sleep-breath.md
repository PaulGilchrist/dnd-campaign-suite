# Bug MA-0182 — Ancient Brass Dragon "Sleep Breath": first failed save over-applies Unconscious; no staged sleep

**Verdict: FAIL** (verified live 2026-09-15, test-campaign, gridless)

## Expected (authored staged saveEffect, verbatim from monsters.json actions[3].save_effect)
> "Failure: The target has the Incapacitated condition until the end of its next turn, at which point it repeats the save. Second Failure: The target has the Unconscious condition for 10 minutes. This effect ends for the target if it takes damage or a creature within 5 feet of it takes an action to wake it."

Reference implementation = MA-0068 fixed shape (Green/Copper sleep breaths): row carries `dc_success:"none"` + `staged_sleep:{unconscious_minutes:10}` → `sleepStagingForAction` (MonsterCardModal.jsx:141-143) routes picker through SaveAttackAoeModal `sleepStaging` → `sleepService.stageSleepTargets` grants `sleep_staged` targetEffect {saveType,stage,dc} + **Incapacitated only**; NPC turn-END auto repeat save / PC queued "(repeat save)" prompt; 2nd fail → Unconscious + expiry {rounds:100} + auto-remove te; wake-on-damage via SP-107 wakeSleepOnDamage.

## Actual (live captures, self-issued localhost fetches)
- **Cast 1** — ElderPaladin, CON save FAIL (nat 10 + 10 aura = 20 < DC 21, save_result ts 1789450421908):
  - `ElderPaladin.activeConditions` = `["incapacitated","unconscious"]` — **BOTH applied simultaneously on FIRST failure**
  - No `sleep_staged` targetEffect anywhere in change-data (`targetEffects` key absent entirely)
  - `ElderPaladin.pendingExpirations` = `[]` — no rounds:100 / 10-minute clock
  - `pendingSavePrompts` = null — no turn-END repeat-save seam
  - Log ts 1789450429901: condition applied "Incapacitated, Unconscious"; description boilerplate ends "(GM-enforced)" — admits no automation
- **Cast 2** — FeyRanger, CON save FAIL (nat 15 − 1 = 14 < 21): identical double-apply (log ts 1789450525269), same "(GM-enforced)" boilerplate, no te/clock/repeat
- **Cast 3 (success branch)** — ElderPaladin, CON save SAVE OK (nat 19 + 5 = 24 ≥ 21): ability_use only, zero condition entries, nothing new applied ✓ (only leg that works)
- Picker copy is generic: "On a failed save, target is Incapacitated, Unconscious" — not the MA-0068 staged copy. No-recharge/no-gate noise: ability re-fires freely each activation (row authors no `recharge` — informational only, sleep breath is unlimited by design).

## Steps to reproduce
1. test-campaign → Encounters → search "Ancient Brass Dragon" → Join.
2. Initiative → dragon avatar card → "DC 21 Constitution" (Sleep Breath) → cone picker → tick one PC → confirm "Sleep Breath (1)".
3. Roll save → on FAIL, read `/api/campaigns/test-campaign/change-data` → `d['<PC>'].activeConditions` = both conditions at once; no te, no expirations, no prompts.

## Likely Location
- **Data**: `public/data/monsters.json` ancient-brass-dragon.actions[3] lacks `dc_success:"none"` + `staged_sleep:{unconscious_minutes:10}` (re-verified this run: keys are only name/description/save_dc/save_type/save_effect — unchanged since MA-0179).
- **Engine seam exists**: MonsterCardModal.jsx:141 `sleepStagingForAction` returns null without `action.staged_sleep`, so generic applyFailedSaveConditions path applies both extracted conditions at once (MA-0068 fingerprint). Data-only fix expected.

## Notes
- Wake-on-5-ft-shake has no UI producer app-wide (§7 Sleep-spell gap, MA-0068 residual) — GM-advisory even on the fixed path.
- Save prompt boilerplate "Half damage on successful save" prints on this damageless row (MV-29 noise).

## Evidence
`/tmp/cd-MA0182.json` + log curl at 2026-09-15T05:35:45Z; ts chain: ability_use 1789450411411 → save fail 1789450421908 → condition 1789450429901; cast2 1789450501694/1789450525269; success 1789450528679.
