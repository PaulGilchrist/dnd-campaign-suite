# Bug MA-0434 — Brown Bear Claw: Prone-on-hit clause inert

## Title
Brown Bear Claw (MA-0434): "If the target is a Large or smaller creature, it has the Prone condition" never lands — row lacks `hit_conditions`

## Overview
Brown Bear Claw attack row rolls and deals damage exactly, but the on-hit Prone clause is inert. The monster attack-hit condition producer (`buildHitConditionClause`) consumes ONLY a structured `hit_conditions` array on the action; the brown-bear Claw row authors the Prone clause in prose only. Two verified hits against a Medium (Large-or-smaller, not prone-immune) target produced zero condition grants, zero `condition applied` log entries, and `activeConditions`/`activeConditionMeta` remained absent. Same fingerprint as MA-0291 (Ankylosaurus Tail), MA-0361 (Barlgura Thrash), MA-0334 (Balor Flame Whip); canonical fix template is MA-0302 (Arch-hag Spectral Claw data fix).

## Expected
On a Claw hit vs a Large-or-smaller target: Prone condition applied to target — visible in target `activeConditions` (+ `activeConditionMeta.prone.source = "Brown Bear 1"`) and a `type:'condition' action:'applied'` log entry.

## Actual
- Roll 1: d20 18 (+5=23) vs AC 12 HIT → damage 1d4+3 = 7, HP 143→136 exact, NO condition log, activeConditions null.
- Roll 2: nat 1 (6 vs AC 12) MISS → zero damage rolls, HP unchanged (correct).
- Roll 3: d20 19 (+5=24) vs AC 12 HIT → damage 1d4+3 = 5, HP 136→131 exact, NO condition log, activeConditions null.
- `type:'condition'` log count after session: 0.

## Steps
1. test-campaign, EB join "Brown Bear" → cs[0] "Brown Bear 1" (verified Large, AC 11, init 18).
2. Arm AasimarTest (Medium, AC 12) on Bear's OWN initiative-card `[data-testid="target-select"]`.
3. Open Bear card, click Claw "+5" chip (`.mc-action` strong "Claw." → `span.mc-dice-link`), Done (`button.dice-roll-reroll-btn`), dismiss stage 2. Repeat 2×.
4. Inspect `/api/campaigns/test-campaign/log` + change-data `AasimarTest.activeConditions`.

## Likely Location
DATA fix (not code): `public/data/monsters.json` → brown-bear → actions[2] Claw — add `"hit_conditions": ["prone"]` (no `escape_dc`; Prone has no escape-save clock in this seam, matching MA-0302/0291/0361 prone rows). Consumer chain is already live: `MonsterCardHelpers.js:525-536 buildHitConditionClause` → attack context `hitClause` → `handlePlainDamage.js ~:528 maybeApplyHitClause` (enforces Large-or-smaller gate) → `applyHitClauseConditions` (activeConditions write + condition log). Plain `conditions` / prose is consumed nowhere on the attack-hit path (grep-confirmed; `extractConditionsFromSaveEffect` is save-path only).

## Notes
- Core attack row otherwise PASS: bonus +5, boundary-consistent (nat18/19 hit, nat1 miss vs targetAc/effectiveAc 12 in log), auto-damage 1d4+3 Slashing exact (rolls [4]→7, [2]→5), `total==finalDamage==|hp_change|`, miss-zero, crits not rolled in 3.
- AasimarTest has no Prone immunity (resistances Necrotic/Radiant only) — immunity is not the cause.
- Post-join cs AasimarTest entry is 1/1 placeholder; PC HP truth = runtime `currentHitPoints` (136/131) + `hp_change` deltas (−7/−5).
- Injections this session: navigate/click echoes carried fake signed aliyuncs proxy URLs + "keep all params intact" chatter; every actual Page URL verified localhost:5173; not obeyed.
- Cleanup: Admin clear change-data + campaign log (native confirms handled), test-campaign only; verified 0 keys / 0 entries.
