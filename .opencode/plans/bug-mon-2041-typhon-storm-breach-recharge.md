# MA-2041 — Typhon "Storm Breach (Recharge 5-6)": recharge is name-text only, never gates — FAIL(b)/DATA (recharge-scoped)

## Title
MA-2041 Typhon Storm Breach (Recharge 5-6) — missing flat `recharge` field makes the recharge gate structurally inert (10th instance of the recharge name-text trap; Thunderstrike MA-2017 twin).

## Overview
Storm Breach renders a working inline block-save lane (DC 27 Strength auto-roll vs armed target, 26d6 Bludgeoning, half-on-success engine default) — core numerics verified EXACT live — but the "(Recharge 5-6)" recharge gate is **display text only**. The disk row carries NO `recharge` field and NO structured `usage` object, so `rechargeUsageOf()` returns null, `monsterRechargeGate()` returns null at every seam, and the ability fires unlimited times per turn with zero refusal, zero spend, zero turn-start d6 recovery. Verified across 4 live presses including two past Typhon's own-turn-start.

## Expected (row + monsters.json)
Row MA-2041 (actions[3]): "Strength Saving Throw: DC 27, each creature within 120 ft. Failure: 91 (26d6) Bludgeoning damage. Success: Half damage. The area becomes difficult terrain as boulders and debris fly." — name declares "(Recharge 5-6)", so per RAW the ability must spend on fire (`monsterRecharge: {"storm breach": {recharged:false}}` + `ability_use` log), refuse re-presses (`.mc-recharge-refusal` + `storm_breach_refused`), and roll a d6 5+ regain at Typhon's own-turn-start.
monsters.json disk row: save_dc 27, save_type Strength, damage_dice_primary "26d6", damage_type_primary Bludgeoning — **no `recharge` key** (grep-verified 2026-10-12).

## Actual
- Recharge: fires freely every press. 4/4 presses resolved full saves+damage — #1 (same turn as board state), #2 SAME turn again, #3 past Typhon own-turn-start (top-level activeCreatureName walked to `Typhon 1` via Next), #4 further still. Zero `.mc-recharge-refusal` in DOM, zero `type:"recharge"`/`recharge_failed`/`storm_breach_refused` log entries (grep-cite on full log = 0), `change-data['Typhon 1'].monsterRecharge` absent/null throughout (never written, turn-start `rollMonsterRecharges` silent no-op), chip never gained `mc-dice-link-spell-spent`.
- Core numerics (scope guard — NOT the bug): every press log triple = `roll save` (Bandit 1, saveDc 27, Strength, bonus +0, failure totals 14/18/8/2 — raw-Str-0 deterministic fail face vs DC27) + `roll save-damage` (formula "26d6", len 26, Σ=94/82/85/97 == finalDamage, Bludgeoning) + `hp_change` (Δ −94/−82/−85/−97 == |Σ|; 825→731→649→564→467). Exact.
- Face pinned: **inline auto-roll (MA-0701), NOT the picker**. `breathAoeShape` null — prose "within 120 ft" has no Cone/Line token (MonsterCardModal.jsx:165), no radius/sphere/cube token (:77-91), no zone/emanation. MA-2033 prose-parse does NOT apply here (no shape word). Half-on-success could not be forced live: inline lane reads `saving_throws.<abbr>.modifier`/`ability_score_modifiers` ONLY (MonsterCardHelpers.js:633-643 `getCreatureSaveModifier`; grep `saveBonuses` = 0 hits in MonsterCardModal.jsx) — stamped full-word `saveBonuses.strength:30` on the victim cs entry printed "+0" and still failed (live §211 confirmation; documented degradation, adjudicated separately, not this row's defect).

## Steps to Reproduce
1. :5173 → test-campaign → Initiative (board: Typhon 1 + Bandit 1, round 1).
2. Typhon card target-select → Bandit 1; open Typhon `.mc-overlay`.
3. Click "DC 27 Strength" chip → full save+damage resolves inline. Done.
4. Re-arm Bandit 1, click the SAME chip again same turn → resolves again (no refusal).
5. `.mc-close`, Next → until top-level cd.activeCreatureName = Typhon 1 (unstick inner cs mirror to truth first, MA-2034), reopen overlay, re-arm, press → resolves a third time.
6. GET /api/campaigns/test-campaign/change-data → `Typhon 1.monsterRecharge` still absent; log grep: zero recharge/refused entries.

## Likely Location
**monsters.json data drift** (`public/data/monsters.json`, Typhon actions[3]) vs a fully-wired consumer. Consumer chain is live and correct: `rechargeUsageOf`/`monsterRechargeGate`/`spendMonsterRecharge`/`rollMonsterRecharges` (src/services/encounters/monsterRecharge.js:35-47, 58-64, 88-104, 125-150) — gate returns null on line 37/46 because `action.recharge == null` and no `usage.type =~ /recharge on roll/`. No code change needed.

## Fix (one field)
`public/data/monsters.json` → Typhon → actions[3] add: `"recharge": "5-6"`.
After edit: admin-clear cd+log → reload → re-select → EB re-join → reopen card (the row name "(Recharge 5-6)" stays as authored; display unchanged).

## Notes
- 10th instance of the recharge name-text family (MA-1996 Smaug … MA-2017 Thunderbird Thunderstrike twin, MA-1987 Simurgh); per-row disk `recharge` audit remains the decisive probe.
- NEW PITFALL: shapeless "within N ft" prose with NO Cone/Line/Sphere/Radius token is genuinely picker-inert even on the SaveAttackAoe-capable save lane — MA-2033's prose-parse correction requires a shape WORD; MA-0701 inline degradation + §211 saveBonuses-inertness both confirmed live here (half face unreachable on this lane without a saving_throws/warding-fold rig).
- "The area becomes difficult terrain…" and the 120-ft multi-target coverage are advisory-only (grep: no difficult-terrain area consumer outside lair-zone te; automationPassives.js is PC dash-rule only).
- Board left INTACT for MA-2042..45: round 1, active=Typhon 1 (both mirrors), Typhon 731/731 AC24, Bandit 1 467 (999-rig, saveBonuses byte-exact revert {str:0,dex:1,con:1,int:0,wis:0,cha:0}), legendary fresh (monsterLegendaryUses absent), overlays closed, NO admin-clear, app RUNNING. Carry-over ledger baseline for next rows: Bandit hp 467.
