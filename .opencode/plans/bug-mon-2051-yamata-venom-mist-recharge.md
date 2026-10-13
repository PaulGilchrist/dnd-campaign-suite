# MA-2051 — Yamata no Orochi "Venom Mist (Recharge 5-6)": recharge is name-text only, never gates — FAIL(b)/DATA (recharge-scoped)

## Title
MA-2051 Yamata no Orochi Venom Mist (Recharge 5-6) — missing flat `recharge` field makes the recharge gate structurally inert (11th instance of the recharge name-text trap; MA-2017/MA-2041 twin family).

## Overview
Venom Mist renders a working inline block-save lane (DC 26 Constitution auto-roll vs armed Bandit 1, 22d6 Poison, half-on-success engine default) — core numerics verified EXACT live across 4 presses — but the "(Recharge 5-6)" recharge gate is **display text only**. The disk row carries NO `recharge` field and NO structured `usage` object, so `rechargeUsageOf()` returns null, `monsterRechargeGate()` returns null at every seam, and the ability fires unlimited times — including twice on Orochi's own turns AFTER `rollMonsterRecharges` ran at two turn-starts — with zero refusal, zero spend, zero recovery.

## Expected (row + monsters.json)
Row MA-2051 (actions[2]): "Constitution Saving Throw: DC 26, each creature within 90 ft. Failure: 77 (22d6) Poison damage. Success: Half damage." — name declares "(Recharge 5-6)", so per RAW the ability must spend on fire (`monsterRecharge: {"venom mist": {recharged:false}}` + `ability_use` log), refuse re-presses (`.mc-recharge-refusal` + `venom_mist_refused`), and roll a d6 5+ regain at Orochi's own-turn-start.
monsters.json disk row (re-cited 2026-10-12 by this subagent): keys = `damage_dice_primary/damage_type_primary/description/name/save_dc/save_type` — **no `recharge` key** (orchestrator disk-confirmed; prior subagent's contrary claim overridden).

## Actual
- Recharge inert: 4/4 presses resolved full saves+damage — #1 r1 (active AasimarTest), #2 SAME turn/boundary, #3 r2 ON Orochi's own turn (`__initiative__.lastAppliedTurnStartCreature`="2:Yamata no Orochi 1" — turn-start recharge roll ran, silent no-op), #4 r3 on Orochi's own turn again (stamp "3:Yamata no Orochi 1"). Zero `.mc-recharge-refusal` in DOM, zero refusal/`venom_mist_refused` automation log entries (count=0), zero Orochi `ability_use` logs, `change-data['Yamata no Orochi 1'].monsterRecharge` null at every probe, chip never gained `mc-dice-link-spell-spent`.
- Core numerics (scope guard — NOT the bug): every press triple = `roll save` (Bandit 1, saveDc 26, Constitution, raw nats 14/18/7/15 — deterministic fail face vs DC26) + `roll save-damage` (formula "22d6", len 22, Σ=79/90/79/60 == finalDamage, damageType Poison) + `hp_change` (Δ −79/−90/−79/−60 == |Σ|; Bandit 861→782→692→613→553). Exact.
- Half-face skipped (MA-2041 §211 pin): prose "within 90 ft" has NO Cone/Line/Sphere/Radius noun → picker-inert, inline auto-roll lane only; that lane reads `saving_throws.<abbr>.modifier`/`ability_score_modifiers` only (getCreatureSaveModifier, MonsterCardHelpers.js:633-643) and ignores stamped saveBonuses — success leg live-unreachable without a DB fold rig. Half-on-success is engine default (`dc_success ?? 'half'`), documented elsewhere.

## Steps to Reproduce
1. :5173 → test-campaign → Initiative (board: Yamata no Orochi 1 511/511 + Bandit 1 999-rig AC12).
2. Open Orochi `.mc-overlay`; row "Venom Mist (Recharge 5-6)" shows chip "DC 26 Constitution".
3. Arm Bandit 1 via `[data-testid="target-select"]`, tap chip → full save+damage resolves inline. Done.
4. Re-arm, press SAME chip again same boundary → resolves again (no refusal).
5. `.mc-close`, Next → until activeCreatureName = Yamata no Orochi 1 (r2), reopen, press → resolves on own turn post-turn-start (no recharge rolled, nothing spent).
6. Repeat walk to r3 own-turn → press #4 resolves. GET change-data → `Yamata no Orochi 1.monsterRecharge` still null; log grep: zero refused/recharge-control entries.

## Likely Location
**monsters.json data drift** (`public/data/monsters.json`, Yamata no Orochi actions[2]) vs a fully-wired consumer. Consumer chain live and correct: `rechargeUsageOf` (src/services/encounters/monsterRecharge.js:35-47 — returns null at :37/:46 because `action.recharge == null` and no `usage.type =~ /recharge on roll/`), `monsterRechargeGate` (:58-64 first-line null), `spendMonsterRecharge` (:88-94 gate-null bail), `rollMonsterRecharges` (turn-start silent no-op). No code change needed.

## Fix (one field)
`public/data/monsters.json` → Yamata no Orochi → actions[2] add: `"recharge": "5-6"`.
After edit: admin-clear cd+log → reload → re-select → EB re-join → reopen card (name "(Recharge 5-6)" display unchanged).

## Notes
- 11th instance of the recharge name-text family (MA-1996 Smaug, MA-2017 Thunderbird Thunderstrike, MA-2041 Typhon Storm Breach twins); per-row disk `recharge` audit remains the decisive probe.
- NEW PITFALL: log text-search /recharge/i on this board hits ONLY the row-name inside `roll` entries' `name` field ("Venom Mist (Recharge 5-6)") — adjudicate recharge truth by `type==='automation'&&automationType=~/refused/` + cd `monsterRecharge` + DOM `.mc-recharge-refusal`, never by naive string grep. PC turn-start ambience (FeyRanger Ambusher's Leap ability_use) also lands mid-walk — exclude from attacker ledger.
- Board left INTACT for MA-2052..55: round 3, active=Yamata no Orochi 1 (both mirrors), Orochi 511/511 AC21, Bandit 1 rig-restored 999/999 AC12, legendary fresh (monsterLegendaryUses absent), recharge cd null (inert), overlays+popups closed, NO admin-clear, app RUNNING. Carry-over baseline: Bandit hp 999.
