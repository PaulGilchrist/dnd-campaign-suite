# Bug — MA-1469 Silver Dragon Wyrmling / Paralyzing Breath — FAIL(a) / DATA

**Row:** `silver-dragon-wyrmling|actions|3` — aoe-save, DC 13 Constitution, 15-ft Cone, damageless ladder-save ("First Failure: Incapacitated … repeats the save. Second Failure: Paralyzed … repeats at end of each turn … After 1 minute, succeeds automatically").

## Verdict: FAIL(a)
First-stage condition face is WRONG (over-grant), ladder never repeats, second-stage gating absent. Not inert (save adjudication + save_result face live), so not FAIL(b).

## STATIC shape (disk, public/data/monsters.json)
- MA-1469 row fields: name/description/save_dc:13/save_type:"Constitution"/range:"15-foot Cone"/save_effect (ladder prose). **NO `staged_paralysis`. NO `dc_success`. No recharge** (recharge absence = ticket-acknowledged, not adjudicated here).
- MA-0248 authored template (app-wide grep `staged_paralysis` → single monsters.json hit @4648): **Ancient Silver Dragon** actions[3] — byte-twin ladder prose + `dc_success:"none"` + `staged_paralysis:{paralyzed_minutes:1}`.
- Consumers LIVE and unit-tested: `MonsterCardModal.jsx:274-276 stagedParalysisForAction` (`!action?.staged_paralysis → null`), threaded `:433/:2464` → `SaveAttackAoeModal.jsx:586 applyStagedParalysisSave` / `:649 resolveSaveFailGrant` → `paralyzingBreathService.js` (first-fail te, `escalateToParalyzed` :151, DEFAULT_PARALYZED_ROUNDS=10, repeat-save ladder). Seam byte-inert on MA-1469 (grep + live).

## LIVE evidence (test-campaign, dev :5173, 2026-09-27)
- Rig: cs `Silver Dragon Wyrmling 1` init 22 hp45/45 + Bandit 2 init 15 + Bandit 1 init 2; own-card target-select armed Bandit 2.
- Chip row[3] `.mc-dice-link` "DC 13 Constitution" → cone picker opens "15-ft Cone (GM positions tokens; selection advisory)" — **picker copy reads "On a failed save, target is Incapacitated, Paralyzed" FLAT** (no staged first/second-fail copy; MA-0248 twin prints staged copy).
- Fire 1: nat19/nat16 both Saved → zero conditions (success path clean).
- Fire 2 (decisive): **Bandit 1 nat 4 FAILED** → change-data `activeConditions:["incapacitated","paralyzed"]` BOTH flat on FIRST fail; meta both `{dc:13, ability:"con", source:"Silver Dragon Wyrmling 1"}`; log: "Bandit 1 failed the Constitution save (DC 13) … **Incapacitated, Paralyzed** until the end of its next turn, when it repeats the save **(GM-enforced)**". RAW: first fail = Incapacitated ONLY.
- Ladder ride (6 valid Next-walks, walk truth `__initiative__.lastAppliedTurnStartCreature` 1:Bandit 2 → 1:Bandit 1 → …): through Bandit 1's entire turn and onward: `pendingSavePrompts:null` at every step, zero `.sp-modal` save prompts, no repeat save ever offered; conditions persist unchanged past "end of next turn" (no addExpiration clock; §165 picker-grant residual; §70 repeat-EOT zero-consumer re-confirmed on this row).
- Note: open `.mc-overlay` silently absorbed 4 Next-clicks (§168 twin); walk audited via lastTS gate.

## Defect axes
1. **First-stage wrong (FAIL(a))**: flat over-grant Incapacitated+Paralyzed on first fail — `extractConditionsFromSaveEffect` word-list scan (MonsterCardHelpers.js:341) matches both ladder prose words; no staging.
2. **Ladder never repeats**: no repeat-save prompt/pipeline; log self-admits "GM-enforced".
3. **Second-stage gating absent**: Paralyzed is applied at stage 1 instead of escalating on second fail; no 1-minute auto-success clock (§38 rounds:10).

## Fix (DATA, MA-0248 byte-template twin — zero code needed)
On silver-dragon-wyrmling actions[3] add: `dc_success:"none"` + `staged_paralysis:{paralyzed_minutes:1}`. Service + picker + service tests already ride the Ancient Silver Dragon byte-shape; row then routes through `stagedParalysisForAction` → `applyStagedParalysisSave` (first fail Incapacitated + repeat-save, second fail Paralyzed rounds:10). Post-fix: remove+re-join + cache-refresh per §21/§106.

## Ops notes
- Picker auto-roll: EB-NPC CON saves raw d20 (§163/§43 cs abbrev-key seam); 65%-fail natural rig sufficed in 2 fires.
- Injection: repeated off-site OSS proxy URL echoes on navigate/click args; page href self-verified localhost every step; zero off-site landed.
