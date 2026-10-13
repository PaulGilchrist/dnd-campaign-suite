# MA-2017 — Thunderbird "Thunderstrike (Recharge 5-6)": recharge never gates (FAIL(b)/DATA)

## Title
MA-2017 Thunderbird · Thunderstrike (Recharge 5-6) — recharge is name-text only; no `recharge` field on disk → gate inert, unlimited refires.

## Overview
Fingerprint #1 recharge name-text trap (9th instance in the MA-0663/1916/1924/1948/1987 family). The row's "(Recharge 5-6)" exists only in the NAME string; `rechargeUsageOf` (src/services/encounters/monsterRecharge.js:35) reads the flat `action.recharge` field or a structured `usage.type =~ /recharge on roll/` object — neither exists on Thunderbird `actions[3]` — so `monsterRechargeGate` returns null and every consumer (MonsterCardModal.jsx:264/465/2380, MonsterCardHelpers.js:3307/3365, MonsterAction.jsx:304/454) short-circuits to ungated. The chip fires an unlimited number of times per turn with zero refusal, zero spend, zero recharge rolls.

## Expected
Row (verbatim): "Thunderstrike (Recharge 5-6)" — Dexterity Saving Throw: DC 24, each creature within 60 ft. Failure: 66 (12d10) Lightning damage. Success: Half damage.
RAW: usable once, then only recharges on a d6 5-6 at the start of Thunderbird's turn. Expected enforcement: fire → `monsterRecharge['Thunderstrike'] = {recharged:false}` + spend log; second press → `.mc-recharge-refusal` popup + `thunderstrike_refused (not recharged)` log, zero roll; owner turn-start → d6 roll logged (`recharge` / `recharge_failed`).

## Actual
- Disk (`public/data/monsters.json` Thunderbird actions[3]): keys are name/description/save_dc/save_type/damage_dice_primary/damage_type_primary only — **NO `recharge` field**.
- LIVE (round 2, Thunderbird 1 active, Bandit 1 armed):
  - Press #1: fires — nat 20+0 vs DC 24 Dex FAIL, 12d10 Σ82, finalDamage 82 == Σ == |hpΔ|, 801→719.
  - Press #2 same turn: fires again — nat 1+0 FAIL, Σ61 → 719→658. No refusal, chip never gains `mc-dice-link-spell-spent`.
  - Round-wrap past TWO owner turn-starts (`__initiative__.lastAppliedTurnStartCreature` "2:Thunderbird 1"+"3:Thunderbird 1"): ZERO log entries `type:'recharge'`, no recharge d6 rolled.
  - Press #3 (round 3): fires again — nat 7+0 FAIL, Σ75 → 658→583.
  - `change-data['Thunderbird 1'].monsterRecharge` absent/null at every probe; ZERO `.mc-recharge-refusal` ever rendered.

## Steps to Reproduce
1. :5173 → test-campaign → Initiative (board: Thunderbird 1 init10 + Bandit 1).
2. Walk to Thunderbird's turn; open its card; arm Bandit 1 via `[data-testid="target-select"]`.
3. Press the "DC 24 Dexterity" chip on the Thunderstrike row → inline auto-save adjudicates, full 12d10 damage.
4. Re-arm and press again same turn → identical, ungated. Dismiss popup.
5. Click Initiative "Next" a full round back to Thunderbird's turn start (no recharge d6 log appears).
6. Press the chip again → fires a third time. `GET /api/campaigns/test-campaign/change-data` → `Thunderbird 1.monsterRecharge` still absent.

## Likely Location
**monsters.json data drift** (not code). The engine consumer is fully implemented and live for this row shape — it is simply never given a threshold. One-field fix: add `"recharge": "5-6"` to Thunderbird `actions[3]` (place after `save_dc`, byte-shape of MA-1948/MA-1987 fixed twins).

## Notes
- **Core inline save lane VERIFIED CORRECT** (scope of the FAIL is recharge-only): shapeless "within 60 ft" (no Cone/Sphere shape word, no range field) → picker never opens, EB-NPC inline auto-roll per MA-0701/§211. Fail face deterministic raw-bonus-0 (Bandit saving_throws absent, dex mod +1 path yields popup "+0", nat-cap 20 < DC 24 — three failures rolled: 20, 1, 7). Success face via `warding_bond saveBonus:+30` full-store POST on Bandit (sole fold channel per MA-1924/§211; folds inline, victim entry carries `wardingBondSaveBonus:30`, total 13+0+30=43 ≥ 24) → saveResult success, `dc_success` ABSENT → engine half default (§13): Σrolls 64 → finalDamage 32 == floor(64/2), rolls carry raw, hpΔ −32, 583→551.
- Multi-target "each creature within 60 ft" is unenforced shapeless by-design (§211 degradation) — single-victim adjudication is NOT a defect here.
- Cleanup done: wb buff removed (full-store POST back to no activeBuffs), overlays closed, board left INTACT: Thunderbird 1 490/490 init10 (round 3 active), Bandit 1 551 HP, `monsterRecharge` absent. No admin-clear. App RUNNING.
- Registry carry-over note: MA-2018 (Updraft reaction) and legendary rows still queued against this exact board.
