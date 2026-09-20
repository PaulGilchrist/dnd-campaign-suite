# BUG MA-0590 — Demilich "Howl" (actions[2], save, DC 19 Constitution) — FAIL

## Row (disk, public/data/monsters.json verbatim)
- save_dc 19, save_type "Constitution", damage_dice_primary "20d6" Psychic
- range "30-foot Emanation", recharge "5-6" (flat string)
- save_effect: "The target has the Frightened condition until the start of the demilich's next turn."
- dc_success ABSENT (default `half` via resolveBlockSaveDcSuccess, MonsterCardModal.jsx:152)

## Working (live evidence, test-campaign)
- DC 19 CON enforced: victim `roll save` entries stamp saveDc 19 / saveType Constitution (fail nat 5 vs 19; success rig 12+0+19 warding_bond=31).
- FAIL leg: full 20d6 psychic (nat-sum 78 applied, hp_change −78, Bandit 1 999→921) + `condition` Frightened applied (activeConditions ["frightened"] + badge + condition_clauses_advisory duration clock "until the start of the demilich's next turn (GM-enforced)").
- SUCCESS leg damage: half correct — raw 20d6 = 68, finalDamage 34 floored, hp_change −34 (999→965). dc_success default `half` honored (no MV-20 half/full leak here).
- RECHARGE economy fully live (MA-0031 machinery): spend at fire (ability_use "Recharge 5-6; unavailable until a d6 5+"), chip spent class `mc-dice-link-spell-spent`, re-click refuses: popup "Not Recharged ... (5+ to recharge)" + `howl_refused` log, zero spend no prompt; real d6 rolled at owner turn-start across rounds (d6: 2,1,4,2,1,4 → recharge_failed logs) then d6: 5 → `recharge` log "Howl recharged (d6: 5)"; post-recharge re-fire succeeded (chip clickable again, spend re-stamped).

## Defect (a) — AoE clause not honored (MA-0317 class)
"each creature in a 30-foot Emanation" does not parse in `breathAoeShape` (MonsterCardModal.jsx:49 — Cone/Line/zone.radius_ft/radius-token only; "Emanation" and the `range` field are grep-zero consumers, §62/§114). Live: clicking the DC 19 chip opened NO SaveAttackAoeModal picker — single-target degraded `fire()` against the armed target only. Bandit 2 (second victim staged adjacent, 999 HP) received zero damage, zero save, zero log on the Probe A turn. No affordance exists to add the second victim → AoE clause unenforced = FAIL(a).

## Defect (b) — Frightened NOT applied on successful save
Description: "**Failure or Success:** The target has the Frightened condition ...". Live success (lastAttack.saveResult "success", dcSuccess "half"): only half damage stamped; NO `condition` log entry and Bandit 2 `activeConditions` key ABSENT after the resolve.
Structural cause (two compounding gaps):
1. DATA: both-outcomes transport EXISTS (MA-0303 `parseBothOutcomesClause`, MonsterCardHelpers.js:163 — arms success-leg condition grants from the tail after byte-marker "Failure or Success:"), but demilich Howl's `save_effect` byte does NOT carry the marker (marker lives only in `description`, which the parser never reads). Row's save_effect should byte-carry "Failure or Success: The target has the Frightened condition until the start of the demilich's next turn." (same shape as Arch-hag Crackling Wave MA-0303 template).
2. TRANSPORT: even with the marker armed, `bothOutcomesClause` is forwarded ONLY into `setConePicker` (MonsterCardModal.jsx:311) / SaveAttackAoeModal resolveSaveFailGrant (:618) — the picker this row never reaches (defect (a) forces single-target `fire()`). saveProcessing single-target seam is fail-only (`applyFailedSaveConditions` early-returns on saveSuccess, saveProcessing.js:808; applyDamagelessSaveConditions :800 likewise). A fix must thread the success-leg grant through the degraded single-target save path as well.

## Suggested fix scope
- DATA: prepend "Failure or Success: " marker into Howl save_effect byte (arms parseBothOutcomesClause; re-run MA-0303 guardrail test which pins armed = ['Arch-hag / Crackling Wave'] — must be updated to include Demilich / Howl by orchestrator).
- TRANSPORT: route the both-outcomes tail through the non-picker single-target save fire() seam (buildAbilitySaveRollContext → saveProcessing success-leg grant + expiry clock "start of demilich's next turn"), and/or give emanation rows the MA-0317 multi-target picker route so "each creature" adjudicates all victims.
- Recharge economy requires NO work.

## Environment
test-campaign ONLY. Round walked 1→6; recharge recovery consumed 6 turn-starts (unlucky d6s). Cleanup: admin clear-change-data + clear-log + combatSummary re-seed; warding_bond rig stamp on Bandit 2 removed by change-data clear.
