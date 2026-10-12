# MA-1927 — Jormungandr Venom Drip: Poisoned rider never granted (`conditions` authored, attack lane reads `hit_conditions` only)

**Verdict: FAIL(b)/DATA — one-field fix.**

## Title
Jormungandr legendary "Venom Drip" hits for exact 4d8+1 Poison damage but never applies the Poisoned condition — row authors `conditions:["poisoned"]`, which no attack-path consumer reads.

## Overview
MA-1927 / `jormungandr|legendary_actions|2`. Numeric self-resolving legendary ranged attack (attack_bonus 17, "4d8 + 1" Poison, range 60 ft., no delegates_to, no save — RAW hit-condition rider, correct axis). The +17 chip self-suppresses Expend and rides the shared header gate (§204/MA-1846/MA-1925 census): both presses spent-then-attacked honestly at fresh boundaries with MA-1926 composite byte-shape. All numerics verified exact. The condition axis fails: on 2/2 hit presses the target receives ZERO Poisoned — the row authors `conditions:["poisoned"]`, but `buildHitConditionClause` (src/services/rules/encounters/MonsterCardHelpers.js:752) consumes ONLY structured `action.hit_conditions`; manifest-extracted `conditions[]` and prose are never consumed on the attack path (§153/§399, MA-0291/0361 Brown Bear Claw family, MA-1435/1541/1520).

## Expected (row + disk)
Row: "Ranged Attack Roll: +17, range 60 ft., one target. Hit: 18 (4d8+1) Poison damage and the target has the Poisoned condition until the end of its next turn."
Disk legendary_actions[2]: `{name:"Venom Drip", attack_bonus:17, range:"60 ft.", damage_dice_primary:"4d8 + 1", damage_type_primary:"Poison", conditions:["poisoned"]}` — with `hit_conditions:["poisoned"]` the rider should grant on every hit: `condition applied` Poisoned on Bandit 1 + change-data `activeConditions:["poisoned"]` + meta source "Jormungandr 1".

## Actual (live, test-campaign 2026-10-11)
Press #1 (boundary `1:AberrantSorcerer`): spend "expends a legendary use for Venom Drip after AberrantSorcerer's turn — 2 of 3 left (regain at the start of Jormungandr 1's turn; 4 in lair advisory)" → nat 10 +17=27 vs AC12 HIT → "4d8 + 1" Poison rolls [8,3,3,4] total/fd 19 → hp_change −19 exact unclamped (cs 999→980). **Zero Poisoned.**
Press #2 (boundary `1:Disciplined_Monk`): spend "…after Disciplined_Monk's turn — 1 of 3 left…" → nat 6 +17=23 HIT → [6,5,1,3]+1 fd 16 → hp_change −16 exact (980→964). **Zero Poisoned.**
Counters: monsterLegendaryUses {max:3, used:1}→{used:2}, delta 1/press. Miss unreachable honestly (nat1 floor 18≥AC12, MA-1840). Poison axis: per-entry whole-log scan — no `condition applied` naming Poisoned, whole-log "poisoned" absent, te/hit_target_effect writes 0, saveConditions 0; Bandit cd activeConditions stayed pre-cleared `[]`, meta null.
Console: 0 errors.
CONTROL (same session, same lane, alive): regular Tail chip hit (nat14+19=33) → `condition applied` Prone reason "Tail (escape DC —)" + Bandit activeConditions ["prone"] + meta source "Jormungandr 1". Proves the hit-clause grant lane functions live while THIS row's key is inert — consumption defect, lane not dead.

## Steps
1. :5173 → test-campaign → EB exact "Jormungandr" ×1 Join → cs confirm (idx0 AC24/697).
2. EB exact-td "Bandit" ×1 Join → full-store cs POST Bandit currentHp+maxHp=999; Bandit change-data POST activeConditions:[]; arm Bandit 1 on Jormungandr own-card target-select.
3. Walk Next to fresh non-Jorm boundary (card closed); unstick cs.activeCreatureName=lastAppliedTruth via full-store cs POST (MA-1852).
4. Open card → row strong startsWith "Venom Drip" → press "+17" `span.mc-dice-link` → HIT popup Done (`button.dice-roll-reroll-btn`).
5. Repeat at a second fresh boundary. GET /log + GET change-data: damage lands, no Poisoned on either press.

## Likely Location
DATA: `public/data/monsters.json` jormungandr legendary_actions[2] — rename/add field `conditions:["poisoned"]` → `hit_conditions:["poisoned"]` (MA-0621/MA-0763 trailing-key byte-shape). Consumer (`buildHitConditionClause`, MonsterCardHelpers.js:752; applied in handlePlainDamage.js) is live and proven this session via the Tail control — no code change needed. Brown Bear Claw MA-0291/0361 family precedent.

## Notes
- Post-fix residual (§346): pure hit_conditions lane carries NO addExpiration clock — prose "until the end of its next turn" stays advisory even after the one-field fix (persistent-prone standard precedent §70; grants verified by grant-log + meta, not expiry).
- Prose avg "18" vs dice avg 19 (4d8+1) — cosmetic drift in description only; dice bytes are RAW-legal, no numerics defect.
- Prior partial evidence: MA-1925 header test fired this row once (nat11+17=28 fd15==hpD, zero-grant §153 advisory) — MA-1927 converts that advisory to a conclusive FAIL(b)/DATA verdict with 2 fresh hits + live control contrast.
- Cleanup done: admin clear cd+log → `{}`/`[]` quiet 15s; no manifest/registry writes.
