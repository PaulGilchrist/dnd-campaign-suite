# MA-2021 — Thunderbird "Wing Clap" (legendary save): Prone never applied on failed save

## Title
MA-2021 Thunderbird Wing Clap — failed DC 23 Strength save deals 2d6 Thunder correctly but the Prone condition payload is inert (save row authors `hit_conditions` bait with no `save_effect`).

## Overview
Row: Thunderbird `legendary_actions[2]` "Wing Clap" — save lane (DC 23 Strength, 2d6 Thunder, "Failure: pushed 20 ft. and knocked Prone"). Live verification shows the save adjudicates honestly on both faces and damage full/half is exact, but Prone is never granted on a failed save. This is the fingerprint #5 / §567 save-row bait pattern (MA-1997 / MA-2013 twins): the save lane word-scans `save_effect` ONLY for conditions; `hit_conditions` is consumed exclusively by the attack lane (`buildHitConditionClause`, handlePlainDamage). With `save_effect` absent, `extractConditionsFromSaveEffect` returns `[]` and the condition grant early-returns.

## Expected (row + monsters.json)
- Row: `"save_dc": 23, "save_type": "Strength", "damage_dice_primary": "2d6", "damage_type_primary": "Thunder", "conditions": ["prone"], "category": "legendary_actions"`
- Description: "Strength Saving Throw: DC 23, each creature within 30 ft. Failure: pushed 20 ft. and knocked Prone; takes 7 (2d6) Thunder damage."
- On failed save: victim takes full 2d6 Thunder AND gains the Prone condition (activeConditions entry + `condition applied` grant log + tracker badge).
- On success: half damage (engine default `dc_success ?? 'half'` — matches prose; no dc_success authored, correct), no damage-free prone either.

## Actual
- FAIL face (Bandit 1, raw Str +0, DC 23 → deterministic): popup "✗ SAVE FAILURE (10 vs DC 23) (d20 10 + 0)"; `roll save` victim rolls[10] saveResult:"failure" saveDc:23 saveType:"Strength"; `save-damage` rolls[2,2] formula "2d6" damageType **"Thunder"**; `hp_change` −4 (Σ=4 full) 425→421. **No `condition applied` Prone entry (zero prone mentions in entire log), victim `activeConditions` empty, `lastAttack.saveConditions: []`, no tracker badge.**
- SUCCESS face (wb warding_bond +30 inline fold, `wardingBondSaveBonus:30` on victim save entry, total 34 vs DC23): `save-damage` rolls raw [3,6] Σ=9, finalDamage 4 = floor(9/2) ✓ half default live; no prone (expected).
- LA economy honest: consume 1 per legal press (used 1→2→3, latch per-boundary), same-boundary re-press refused "(turn) — zero spend, no roll".
- Push 20 ft.: §398 movement advisory note-only (no consumer — by design). Multi-target "each creature within 30 ft." unenforced shapeless → inline single-target auto-roll, no picker (§62/MA-0701/§211 by design).

## Steps to Reproduce
1. test-campaign, :5173, board Thunderbird 1 + Bandit 1 (EB join), Thunderbird legendary uses available at a fresh boundary (walk Next past a PC's turn; close `.mc-overlay` before walking).
2. Arm Bandit 1 on Thunderbird's own-card `[data-testid="target-select"]` (MA-2005: unarmed press still spends).
3. Open Thunderbird `.mc-overlay`, press `span.mc-dice-link-save-clickable` "DC 23 Strength" on the Wing Clap row.
4. Save auto-rolls (Bandit raw Str +0 → fail); click Done.
5. Observe: damage applied, but victim activeConditions/log/badge contain no Prone.

## Likely Location
- **monsters.json data drift (primary):** `thunderbird.legendary_actions[2]` authors `hit_conditions:["prone"]` (attack-lane transport) but no `save_effect`. One-field fix: `save_effect: "The target has the Prone condition."` (canonical word "Prone" word-scan). `dc_success` may stay absent — engine default half already matches prose.
- Consumer chain (working as designed, confirms location): `MonsterCardHelpers.extractConditionsFromSaveEffect` (save_effect word-scan) → `saveProcessing.applyFailedSaveConditions` / `applyDamagelessSaveConditions` early-return on empty clauses — MA-1997/MA-2013 seam.

## Notes
- PASS-subset axes proven exact: DC enforced (both faces), dice 2d6, unfamiliar damage type "Thunder" passes through byte-exact in save-damage + lastAttack, half-on-success floor(Σ/2) with rolls-raw (MA-1924/MA-2017 ledger fingerprint), wb +30 inline fold channel, legendary spend/refusal economy.
- Verdict FAIL(a): mechanic triggers and resolves wrong on the condition axis only (condition not applied on fail).
- Security: no injections observed this run.
